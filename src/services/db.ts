import { Database } from "bun:sqlite";

interface Event {
  type: string;
  subreddit: string;
  data: any;
  created_at?: number;
  new_items_count?: number;
}

export class DB {
  private static instance: DB;
  private db: Database;

  private constructor() {
    this.db = new Database("events.sqlite");
    this.initializeDatabase();
  }

  private initializeDatabase() {
    this.db.run(`
      CREATE TABLE IF NOT EXISTS events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        type TEXT NOT NULL,
        subreddit TEXT NOT NULL,
        data TEXT NOT NULL,
        created_at INTEGER NOT NULL,
        new_items_count INTEGER
      )
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_type_subreddit 
      ON events(type, subreddit)
    `);
  }

  static getInstance(): DB {
    if (!DB.instance) {
      DB.instance = new DB();
    }
    return DB.instance;
  }

  async createEvent(event: Event): Promise<void> {
    const stmt = this.db.prepare(`
      INSERT INTO events (type, subreddit, data, created_at, new_items_count)
      VALUES (?, ?, ?, ?, ?)
    `);

    stmt.run(
      event.type,
      event.subreddit,
      JSON.stringify(event.data),
      event.created_at || Date.now(),
      event.new_items_count || null
    );
  }

  async getLastEvent(subreddit: string, type: string): Promise<Event | null> {
    const stmt = this.db.prepare(`
      SELECT type, subreddit, data, created_at, new_items_count
      FROM events
      WHERE type = ? AND subreddit = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const result = stmt.get(type, subreddit) as any;

    if (!result) return null;

    return {
      type: result.type,
      subreddit: result.subreddit,
      data: JSON.parse(result.data),
      created_at: result.created_at,
      new_items_count: result.new_items_count,
    };
  }

  async itemExists(subreddit: string, fullname: string): Promise<boolean> {
    const stmt = this.db.prepare(`
      SELECT 1 FROM events 
      WHERE type = 'modqueue.full' 
      AND subreddit = ? 
      AND json_extract(data, '$.items') LIKE ?
      LIMIT 1
    `);

    const result = stmt.get(subreddit, `%"fullname":"${fullname}"%`) as any;
    return !!result;
  }
}

export const db = DB.getInstance();
