// scripts/migrate.mjs
// Applies migrations/001_init.sql to Supabase

import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { createClient } from '@supabase/supabase-js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(__dirname, '../migrations/001_init.sql'), 'utf-8');

const SUPABASE_URL = 'https://phnfuitohipjijtxymhmhz.supabase.co';
const SERVICE_ROLE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBobmZ1aXRvaGlwaml0eHltbWh6Iiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3MjM2ODM1NSwiZXhwIjoyMDg3OTQ0MzU1fQ.QakDhp_UZWsKny7pN5E2KBzV_kY1N-XNU6s1SrJdEvU';

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE);

async function tablesExist() {
  const { error } = await supabase.from('transactions').select('id').limit(1);
  // error code 42P01 = relation does not exist
  return !error || error.code !== '42P01';
}

async function run() {
  console.log('⏳ Checking Supabase connection...\n');

  const exists = await tablesExist();
  if (exists) {
    console.log('✅ Tables already exist — migration skipped.');
    return;
  }

  console.log('📦 Tables not found. Creating via Supabase Management API...\n');
  // The Management API requires a personal access token (sbp_...).
  // Since only project keys are available, print instructions.
  console.log('─────────────────────────────────────────────────────────');
  console.log('ACTION REQUIRED: Run the following SQL in Supabase dashboard');
  console.log('  → https://supabase.com/dashboard/project/phnfuitohipjijtxymhmhz/sql/new');
  console.log('─────────────────────────────────────────────────────────\n');
  console.log(sql);
}

run().catch((err) => {
  console.error('❌ Error:', err.message);
});

