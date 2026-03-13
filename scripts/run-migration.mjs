/**
 * scripts/run-migration.mjs
 *
 * Esegue una o tutte le migration SQL su Supabase via connessione Postgres diretta.
 *
 * Prerequisito: DATABASE_URL impostata in .env.local
 *   Trovala in: Supabase Dashboard → Settings → Database → Connection string → URI
 *
 * Uso:
 *   npm run db:migrate                              → esegue TUTTE le migration
 *   npm run db:migrate -- 012_auth                 → esegue solo quella specifica
 *   npm run db:migrate:list                        → lista le migration disponibili
 */

import pg from 'pg';
import { readFileSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join, basename } from 'path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const MIGRATIONS_DIR = join(ROOT, 'supabase', 'migrations');

// ─── Carica .env.local ────────────────────────────────────────────────────────
function loadEnv() {
  try {
    const raw = readFileSync(join(ROOT, '.env.local'), 'utf-8');
    for (const line of raw.split('\n')) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;
      const idx = trimmed.indexOf('=');
      if (idx === -1) continue;
      const key = trimmed.slice(0, idx).trim();
      const val = trimmed.slice(idx + 1).trim();
      if (!process.env[key]) process.env[key] = val;
    }
  } catch {
    // ignore
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function getMigrationFiles(filter) {
  const files = readdirSync(MIGRATIONS_DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort();
  if (!filter) return files;
  return files.filter((f) => f.includes(filter));
}

async function runMigration(client, filePath) {
  const sql = readFileSync(filePath, 'utf-8');
  const name = basename(filePath);
  try {
    await client.query(sql);
    console.log(`  ✅  ${name}`);
  } catch (err) {
    if (err.code === '42P07' || err.message?.includes('already exists')) {
      console.log(`  ⏭️   ${name}  (già esiste — skip)`);
    } else {
      console.error(`  ❌  ${name}  →  ${err.message}`);
      throw err;
    }
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  loadEnv();

  const args = process.argv.slice(2);

  // --list non richiede connessione DB
  if (args.includes('--list')) {
    const files = getMigrationFiles();
    console.log('\nMigration disponibili:\n');
    files.forEach((f) => console.log(`  ${f}`));
    console.log();
    return;
  }

  const DATABASE_URL = process.env.DATABASE_URL;
  if (!DATABASE_URL || DATABASE_URL.includes('[PASSWORD]')) {
    console.error('\n❌  DATABASE_URL non impostata o contiene ancora il segnaposto [PASSWORD].');
    console.error('   1. Vai su: Supabase Dashboard → Settings → Database → Connection string → URI');
    console.error('   2. Copia la stringa (es. postgresql://postgres:PASSWORD@db.xxx.supabase.co:5432/postgres)');
    console.error('   3. Incollala in .env.local come DATABASE_URL=postgresql://...\n');
    process.exit(1);
  }

  const filter = args[0] && !args[0].startsWith('--') ? args[0] : null;
  const files = getMigrationFiles(filter);

  if (files.length === 0) {
    console.error(`\n❌  Nessuna migration trovata${filter ? ` per filtro "${filter}"` : ''}.\n`);
    process.exit(1);
  }

  console.log(`\n🔌  Connessione a Supabase...\n`);

  const { Client } = pg;
  const client = new Client({
    connectionString: DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  console.log(`✅  Connesso.\n`);

  console.log(`📦  Esecuzione di ${files.length} migration:\n`);
  for (const file of files) {
    await runMigration(client, join(MIGRATIONS_DIR, file));
  }

  await client.end();
  console.log('\n✅  Completato.\n');
}

main().catch((err) => {
  console.error('\n❌  Errore fatale:', err.message);
  process.exit(1);
});
