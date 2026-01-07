import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { saveCodes } from './db'

// --- REGISTER SCRAPER MODUL DISINI ---
import GenshinScraper from './scrapers/genshin'
import HsrScraper from './scrapers/hsr'
import ZzzScraper from './scrapers/zzz'

const REGISTERED_GAMES = [GenshinScraper, HsrScraper, ZzzScraper]

// Pastikan nama ini sesuai dengan wrangler.toml Anda!
// Jika di wrangler.toml [[d1_databases]] binding = "DB", maka ubah di sini jadi DB
type Bindings = { DB: D1Database }

const app = new Hono<{ Bindings: Bindings }>()

app.use('*', cors())
app.use('*', async (c, next) => {
	await next()
	c.header('X-Content-Type-Options', 'nosniff')
	c.header('X-Frame-Options', 'DENY')
	c.header('X-XSS-Protection', '1; mode=block')
	c.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
	// Content-Security-Policy disesuaikan agar bisa load gambar dari domain luar (fandom/wiki) nanti
	c.header(
		'Content-Security-Policy',
		"default-src 'self'; img-src 'self' https: data:;"
	)
})

// --- PUBLIC API ---

app.get('/api/codes', async (c) => {
	const url = new URL(c.req.url)

	// --- 1. Parameters ---
	const game = url.searchParams.get('game')?.replace(/[^a-z0-9_-]/gi, '')
	const status = url.searchParams.get('status')?.replace(/[^a-zA-Z]/g, '')
	const search = url.searchParams.get('search')?.trim()

	// Pagination
	const page = Math.max(1, parseInt(url.searchParams.get('page') || '1'))
	const limit = Math.max(
		1,
		Math.min(100, parseInt(url.searchParams.get('limit') || '20'))
	)
	const offset = (page - 1) * limit

	// Sorting Logic
	// Default: date (id), desc (terbaru diatas)
	const sortByParam = url.searchParams.get('sort_by') // 'date' | 'status'
	const orderParam = url.searchParams.get('order')?.toLowerCase() // 'asc' | 'desc'

	// --- 2. Build SQL WHERE ---
	let whereClause = 'WHERE 1=1'
	const params: any[] = []

	if (game && game !== 'all') {
		whereClause += ' AND lower(game_slug) = lower(?)'
		params.push(game)
	}
	if (status && status !== 'all') {
		whereClause += ' AND lower(status) = lower(?)'
		params.push(status)
	}
	if (search) {
		whereClause +=
			' AND (lower(code) LIKE lower(?) OR lower(rewards) LIKE lower(?))'
		const p = `%${search}%`
		params.push(p, p)
	}

	// --- 3. Build SQL ORDER BY (Safe Whitelisting) ---
	let orderByClause = 'ORDER BY id ASC' // Default

	// Validasi input user secara ketat (Security)
	if (sortByParam === 'status') {
		// Jika sort by Status: Urutkan status dulu, lalu urutkan ID (biar yg baru tetap diatas)
		// Active (A) < Expired (E). Jadi ASC = Active First.
		const dir = orderParam === 'desc' ? 'DESC' : 'ASC'
		orderByClause = `ORDER BY status ${dir}, id DESC`
	} else {
		// Default sort by Date (ID)
		const dir = orderParam === 'asc' ? 'ASC' : 'DESC'
		orderByClause = `ORDER BY id ${dir}`
	}

	// --- 4. Query Execution ---
	// Count Total
	const countQuery = `SELECT COUNT(*) as total FROM game_codes ${whereClause}`
	const countResult = await c.env.DB.prepare(countQuery)
		.bind(...params)
		.first()
	const totalItems = (countResult?.total as number) || 0
	const totalPages = Math.ceil(totalItems / limit)

	// Fetch Data
	const dataQuery = `SELECT * FROM game_codes ${whereClause} ${orderByClause} LIMIT ? OFFSET ?`
	const dataParams = [...params, limit, offset]

	const { results } = await c.env.DB.prepare(dataQuery)
		.bind(...dataParams)
		.all()

	// Parsing JSON (Sama seperti sebelumnya)
	const parsedResults = results.map((item: any) => {
		try {
			item.rewards = JSON.parse(item.rewards)
		} catch (e) {
			item.rewards = [item.rewards]
		}
		try {
			item.duration = JSON.parse(item.duration)
		} catch (e) {
			item.duration = [{ label: 'Info', value: item.duration }]
		}
		return item
	})

	return c.json({
		meta: {
			success: true,
			page,
			per_page: limit,
			total_items: totalItems,
			total_pages: totalPages,
			sort: { by: sortByParam || 'date', order: orderParam || 'desc' },
		},
		data: parsedResults,
	})
})

app.get('/api/games', (c) => {
	return c.json({
		meta: { success: true },
		data: REGISTERED_GAMES.map((g) => ({ slug: g.slug, name: g.name })),
	})
})

// --- CRON JOB HANDLER ---
async function runAllScrapers(db: D1Database) {
	console.log('Starting scheduled scrape...')

	// 5. OPTIMASI: Gunakan allSettled agar satu error tidak mematikan proses lain
	const results = await Promise.allSettled(
		REGISTERED_GAMES.map(async (scraper) => {
			console.log(`Scraping ${scraper.name}...`)
			try {
				const codes = await scraper.scrape()
				await saveCodes(db, scraper.slug, codes)
				return `${scraper.name}: Success (${codes.length} codes)`
			} catch (err) {
				console.error(`FAILED scraping ${scraper.name}:`, err)
				throw err
			}
		})
	)

	// Logging hasil status
	results.forEach((res) => {
		if (res.status === 'fulfilled') console.log(res.value)
		else console.error('Scraper Job Failed:', res.reason)
	})

	console.log('Cron Job finished.')
}

export default {
	fetch: app.fetch,
	async scheduled(
		event: ScheduledEvent,
		env: Bindings,
		ctx: ExecutionContext
	) {
		ctx.waitUntil(runAllScrapers(env.DB)) // Pastikan env.DB sesuai
	},
}
