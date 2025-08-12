-- Create id_cards table
CREATE TABLE IF NOT EXISTS id_cards (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id INTEGER NOT NULL,
  display_name TEXT NOT NULL,
  attributes TEXT NOT NULL, -- store JSON as TEXT in D1/SQLite
  image_url TEXT,
  public_id TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME
);

-- Index for user_id
CREATE INDEX IF NOT EXISTS idx_id_cards_user_id ON id_cards(user_id);

-- Trigger to keep updated_at in sync
CREATE TRIGGER IF NOT EXISTS trg_id_cards_updated
AFTER UPDATE ON id_cards
FOR EACH ROW BEGIN
  UPDATE id_cards SET updated_at = CURRENT_TIMESTAMP WHERE id = OLD.id;
END;
