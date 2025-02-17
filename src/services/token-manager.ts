import { Database } from "bun:sqlite";

class TokenManager {
  private db: Database;

  constructor() {
    this.db = new Database(":memory:");
    this.init();
  }

  private init() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS tokens (
        key TEXT PRIMARY KEY,
        value TEXT NOT NULL,
        expires_at INTEGER NOT NULL
      )
    `);
  }

  async set(token: string, expiresIn: number) {
    const expiresAt = Date.now() + expiresIn * 1000;
    this.db.run(
      "INSERT OR REPLACE INTO tokens (key, value, expires_at) VALUES (?, ?, ?)",
      ["reddit_token", token, expiresAt]
    );
  }

  get(): string | null {
    const row = this.db
      .query(
        "SELECT value, expires_at FROM tokens WHERE key = ? AND expires_at > ?"
      )
      .get("reddit_token", Date.now());

    return row ? (row as { value: string }).value : null;
  }

  clear() {
    this.db.run("DELETE FROM tokens WHERE key = ?", ["reddit_token"]);
  }
}

export const tokenManager = new TokenManager();
