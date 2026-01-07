import * as cheerio from 'cheerio'
import { RewardItem } from './types'

export function parseRewards(htmlContent: string): RewardItem[] {
	if (!htmlContent) return []

	return htmlContent
		.split(/<br\s*\/?>/i) // Split item berdasarkan baris baru HTML
		.map((part) => {
			const $ = cheerio.load(part)

			// 1. Ambil URL Gambar (Prioritas data-src untuk lazyload)
			let imgUrl = $('img').attr('data-src') || $('img').attr('src') || ''

			// 2. Bersihkan URL Fandom
			// Hapus bagian revisi/scale agar dapat gambar resolusi penuh
			if (imgUrl) {
				imgUrl = imgUrl.split('/revision')[0]
			}

			// 3. Ambil Label (Teks) dan bersihkan spasi
			const label = $.text().trim()

			if (!label) return null

			return { label, image: imgUrl }
		})
		.filter((item): item is RewardItem => item !== null)
}
