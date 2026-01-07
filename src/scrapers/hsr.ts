import * as cheerio from 'cheerio'
import { GameScraper, ScrapedCode } from '../types'
import { parseRewards } from '../utils'

const HsrScraper: GameScraper = {
	slug: 'hsr',
	name: 'Honkai: Star Rail',

	scrape: async () => {
		const URL = 'https://honkai-star-rail.fandom.com/wiki/Redemption_Code'
		const results: ScrapedCode[] = []

		try {
			const response = await fetch(URL, {
				headers: {
					'User-Agent': 'Mozilla/5.0 (Compatible; HoyoCodeBot/1.0)',
				},
			})
			const html = await response.text()
			const $ = cheerio.load(html)

			$('table.wikitable').each((_, table) => {
				$(table)
					.find('tr')
					.each((rowIndex, row) => {
						if (rowIndex === 0) return

						const cols = $(row).find('td')
						if (cols.length >= 4) {
							// --- 1. CLEANING CODE (PERBAIKAN UTAMA) ---
							const codeCell = $(cols[0]).clone()

							// Hapus footnote [1], [4] dst
							codeCell.find('sup').remove()
							codeCell.find('br').replaceWith('\n')

							let rawCodeText = codeCell.text()

							// Hapus teks "Quick Redeem" yang terlihat di screenshot
							rawCodeText = rawCodeText.replace(
								/Quick Redeem/gi,
								''
							)

							// Hapus sisa kurung siku [...] jika ada
							rawCodeText = rawCodeText.replace(/\[.*?\]/g, '')

							// Hapus spasi aneh (Non-breaking space)
							rawCodeText = rawCodeText.replace(/\u00A0/g, ' ')

							// Split & Filter
							const rawCodes = rawCodeText
								.split(/[\n\s]+/)
								.map((c) => c.trim())
								.filter((c) => c.length > 4) // Filter kode pendek/sampah

							// --- 2. DURATION PROCESSING (PEMBERSIHAN DUPLIKAT) ---
							const durationCell = $(cols[3]).clone()

							// Hapus elemen pengganggu penyebab teks ganda
							durationCell.find('.timeago').remove()
							durationCell.find('.local-time').remove()
							durationCell.find('sup').remove()

							// Formatting Header
							durationCell.find('b').each((_, el) => {
								$(el).before('\n')
							})
							durationCell.find('br').replaceWith('\n')

							const durationArray = durationCell
								.text()
								.split('\n')
								.map((l) => l.trim())
								.filter((l) => l.length > 0)
								.map((line) => {
									const idx = line.indexOf(':')
									let value =
										idx > -1
											? line.substring(idx + 1).trim()
											: line

									// Regex: Ambil hanya pola tanggal "Month DD, YYYY" yang valid
									// Ini mencegah masalah "July 2, 2025July 2, 2025"
									const dateMatch = value.match(
										/([A-Za-z]+ \d{1,2}, \d{4})/
									)

									if (dateMatch) {
										value = dateMatch[0]
									} else if (
										value
											.toLowerCase()
											.includes('indefinite')
									) {
										value = '(indefinite)'
									}

									return {
										label:
											idx > -1
												? line.substring(0, idx).trim()
												: 'Info',
										value,
									}
								})
							const duration = JSON.stringify(durationArray)

							// --- 3. REWARDS PROCESSING (Use Helper) ---
							const rewardCell = $(cols[2]).clone()
							const rewardList = parseRewards(
								rewardCell.html() || ''
							)
							const rewards = JSON.stringify(rewardList)

							// --- 4. COMMON FIELDS ---
							const server = $(cols[1]).text().trim()
							const isExpired = durationArray.some((d) =>
								d.label.toLowerCase().includes('expired')
							)
							const status = isExpired ? 'Expired' : 'Active'

							rawCodes.forEach((code) => {
								if (code)
									results.push({
										code,
										server,
										rewards,
										duration,
										status,
									})
							})
						}
					})
			})
		} catch (error) {
			console.error('Error scraping HSR:', error)
		}
		return results
	},
}

export default HsrScraper
