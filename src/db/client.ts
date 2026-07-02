import Database from "better-sqlite3";
import { readFileSync, readdirSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { env } from "../config/env";

const __dirname = dirname(fileURLToPath(import.meta.url));

function ensureDataDirExists() {
  const dir = dirname(env.DATABASE_PATH);
  mkdirSync(dir, { recursive: true });
}

function runMigrations(db: Database.Database) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at INTEGER NOT NULL
    );
  `);

  const migrationsDir = join(__dirname, "migrations");
  const migrationFiles = readdirSync(migrationsDir)
    .filter((f) => f.endsWith(".sql"))
    .sort();

  for (const filename of migrationFiles) {
    const alreadyApplied = db.prepare("SELECT 1 FROM _migrations WHERE name = ?").get(filename);

    if (alreadyApplied) continue;

    const sql = readFileSync(join(__dirname, "migrations", filename), "utf-8");
    db.exec(sql);
    db.prepare("INSERT INTO _migrations (name, applied_at) VALUES (?, ?)").run(
      filename,
      Math.floor(Date.now() / 1000)
    );

    console.log(`Applied migration: ${filename}`);
  }
}

ensureDataDirExists();

export const db = new Database(env.DATABASE_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

runMigrations(db);

export function closeDb() {
  db.close();
}
