import { Database } from "bun:sqlite";

export class Cache {
  private static instance: Cache;
  private db: Database;
  private readonly TTL: number = 5 * 60 * 1000; // 5 minutes default TTL

  private constructor() {
    this.db = new Database("cache.sqlite");
    this.initializeDatabase();
  }

  private initializeDatabase() {
    // Create cache table if it doesn't exist
    this.db.run(`
      CREATE TABLE IF NOT EXISTS cache (
        key TEXT PRIMARY KEY,
        data TEXT NOT NULL,
        timestamp INTEGER NOT NULL
      )
    `);

    // Create index on timestamp for faster cleanup
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_timestamp 
      ON cache(timestamp)
    `);
  }

  static getInstance(): Cache {
    if (!Cache.instance) {
      Cache.instance = new Cache();
    }
    return Cache.instance;
  }

  set(key: string, value: any): void {
    const stmt = this.db.prepare(`
      INSERT OR REPLACE INTO cache (key, data, timestamp)
      VALUES (?, ?, ?)
    `);

    stmt.run(key, JSON.stringify(value), Date.now());
  }

  get(key: string): any | null {
    // Clean expired entries first
    this.cleanExpired();

    const stmt = this.db.prepare(`
      SELECT data, timestamp
      FROM cache
      WHERE key = ?
    `);

    const result = stmt.get(key) as { data: string; timestamp: number } | null;

    if (!result) return null;

    // Check if data is expired
    if (Date.now() - result.timestamp > this.TTL) {
      this.delete(key);
      return null;
    }

    return JSON.parse(result.data);
  }

  private delete(key: string): void {
    const stmt = this.db.prepare(`
      DELETE FROM cache
      WHERE key = ?
    `);

    stmt.run(key);
  }

  private cleanExpired(): void {
    const stmt = this.db.prepare(`
      DELETE FROM cache
      WHERE timestamp < ?
    `);

    stmt.run(Date.now() - this.TTL);
  }

  clear(): void {
    this.db.run(`DELETE FROM cache`);
  }

  // Optional: Get cache statistics
  getStats(): { totalEntries: number; oldestEntry: number } {
    const result = this.db
      .prepare(
        `
      SELECT COUNT(*) as count, MIN(timestamp) as oldest
      FROM cache
    `
      )
      .get() as { count: number; oldest: number };

    return {
      totalEntries: result.count,
      oldestEntry: result.oldest || Date.now(),
    };
  }
}
