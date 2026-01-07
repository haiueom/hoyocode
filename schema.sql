DROP TABLE IF EXISTS game_codes;

CREATE TABLE game_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_slug TEXT NOT NULL,
    code TEXT NOT NULL,
    server TEXT DEFAULT 'All',
    rewards TEXT,
    duration TEXT,
    status TEXT DEFAULT 'Active',
    last_checked DATETIME DEFAULT CURRENT_TIMESTAMP,
    redemption_url TEXT,

    UNIQUE(game_slug, code)
);

CREATE INDEX idx_game_status ON game_codes(game_slug, status);
