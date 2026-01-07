export interface RewardItem {
	label: string
	image: string
}

export interface ScrapedCode {
	code: string
	server: string
	rewards: string // Disimpan sebagai JSON String di DB
	duration: string // Disimpan sebagai JSON String di DB
	status: 'Active' | 'Expired'
}

export interface GameScraper {
	slug: string
	name: string
	scrape: () => Promise<ScrapedCode[]>
}
