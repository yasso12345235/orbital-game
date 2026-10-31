/**
 * ORBITAL server — SQLite via sql.js (pure JS/WASM, no native build).
 * Persists to server/data/orbital.db on every write; loads on boot.
 *
 * sql.js Statement API used here:
 *   stmt.bind([params]) → stmt.step() → stmt.getAsObject() → stmt.free()
 *   stmt.run([params]) → { changes }
 */
import initSqlJs from 'sql.js';
import fs from 'fs';
import path from 'path';

export interface SqlJsRow {
  [key: string]: unknown;
}

type SqlJsInit = Awaited<ReturnType<typeof initSqlJs>>; // { Database: ... }
type SqlJsDb = InstanceType<NonNullable<SqlJsInit['Database']>>;

const DATA_DIR = path.join(process.cwd(), 'data');
const DB_PATH = path.join(DATA_DIR, 'orbital.db');
const WASM_PATH = path.join(process.cwd(), 'node_modules', 'sql.js', 'dist', 'sql-wasm.wasm');

let sql: SqlJsInit | null = null;

async function init(): Promise<SqlJsDb> {
  if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!sql) {
    sql = await initSqlJs({ locateFile: () => WASM_PATH });
  }

  let db: SqlJsDb;
  if (fs.existsSync(DB_PATH)) {
    const buf = fs.readFileSync(DB_PATH);
    db = new sql.Database(buf);
  } else {
    db = new sql.Database();
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS saves (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      label TEXT,
      data TEXT NOT NULL,
      saved_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_saves_user_updated ON saves(user_id, updated_at DESC);

    CREATE TABLE IF NOT EXISTS scores (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      username TEXT NOT NULL DEFAULT '',
      mission_id TEXT NOT NULL,
      score INTEGER NOT NULL,
      grade TEXT NOT NULL,
      difficulty TEXT NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_scores_mission_score ON scores(mission_id, score DESC);
  `);

  return db;
}

/** Export the database to the persistence file. */
export function persist(db: SqlJsDb): void {
  const data = db.export();
  fs.writeFileSync(DB_PATH, Buffer.from(data));
}

/** Execute a statement returning the first row as an object, or undefined. */
export function queryRow(db: SqlJsDb, sql: string, params: unknown[] = []): SqlJsRow | undefined {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const hasRow = stmt.step();
  const row = hasRow ? stmt.getAsObject() : undefined;
  stmt.free();
  return row;
}

/** Execute a statement returning all rows as objects. */
export function queryAll(db: SqlJsDb, sql: string, params: unknown[] = []): SqlJsRow[] {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows: SqlJsRow[] = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

/** Execute a write statement. */
export async function queryRun(db: SqlJsDb, sql: string, params: unknown[] = []): Promise<{ changes: number }> {
  const stmt = db.prepare(sql);
  const safeParams = params.map((p) => (p === undefined ? null : p));
  const res = stmt.run(safeParams as any[]);
  stmt.free();
  return res;
}

export async function openDb() {
  const db = await init();
  return { db, persist };
}
