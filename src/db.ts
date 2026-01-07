import { ScrapedCode } from './types'

// Peta Base URL untuk setiap game
const REDEMPTION_BASE_URLS: Record<string, string> = {
	genshin: 'https://genshin.hoyoverse.com/en/gift?code=',
	hsr: 'https://hsr.hoyoverse.com/gift?code=',
	zzz: 'https://zenless.hoyoverse.com/redemption?code=',
}

export async function saveCodes(
	db: D1Database,
	gameSlug: string,
	codes: ScrapedCode[]
) {
	if (codes.length === 0) return

	// Siapkan URL Generator berdasarkan Slug game yang sedang di-scrape
	const baseUrl = REDEMPTION_BASE_URLS[gameSlug] || ''

	const statements = codes.map((item) => {
		// Generate URL lengkap
		// Jika game tidak dikenal, biarkan null atau string kosong
		const redemptionUrl = baseUrl ? `${baseUrl}${item.code}` : null

		return db
			.prepare(
				`
      INSERT INTO game_codes (game_slug, code, server, rewards, duration, status, last_checked, redemption_url)
      VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, ?)
      ON CONFLICT(game_slug, code) DO UPDATE SET
        server=excluded.server,
        rewards=excluded.rewards,
        duration=excluded.duration,
        status=excluded.status,
        last_checked=CURRENT_TIMESTAMP,
        redemption_url=excluded.redemption_url
    `
			)
			.bind(
				gameSlug,
				item.code,
				item.server,
				item.rewards,
				item.duration,
				item.status,
				redemptionUrl
			)
	})

	// Batch execute dengan chunking agar aman
	const chunkSize = 50
	for (let i = 0; i < statements.length; i += chunkSize) {
		await db.batch(statements.slice(i, i + chunkSize))
	}

	console.log(`[${gameSlug}] Saved/Updated ${codes.length} codes with URLs.`)
}
