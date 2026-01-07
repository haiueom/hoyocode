import * as cheerio from 'cheerio'
import { GameScraper, ScrapedCode } from '../types'
import { parseRewards } from '../utils'

const GenshinScraper: GameScraper = {
	slug: 'genshin',
	name: 'Genshin Impact',

	scrape: async () => {
		const URL = 'https://genshin-impact.fandom.com/wiki/Promotional_Codes'
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
							// --- 1. CLEANING CODE ---
							const codeCell = $(cols[0]).clone()
							codeCell.find('sup').remove()
							codeCell.find('br').replaceWith('\n')
							let rawCodeText = codeCell
								.text()
								.replace(/\[.*?\]/g, '') // Hapus [Note]
								.replace(/\u00A0/g, ' ') // Hapus non-breaking space

							const rawCodes = rawCodeText
								.split(/[\n\s]+/)
								.map((c) => c.trim())
								.filter((c) => c.length > 4)

							// --- 2. DURATION PROCESSING ---
							const durationCell = $(cols[3]).clone()
							durationCell
								.find('.timeago, .local-time, sup')
								.remove()
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

									// Regex Clean Date (Month DD, YYYY)
									const dateMatch = value.match(
										/([A-Za-z]+ \d{1,2}, \d{4})/
									)
									if (dateMatch) value = dateMatch[0]
									else if (
										value
											.toLowerCase()
											.includes('indefinite')
									)
										value = '(indefinite)'

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
			console.error('Error scraping Genshin:', error)
		}
		return results
	},
}

export default GenshinScraper
