/*
 * db_fetch.js
 * Connects to a Postgres (Supabase) DB, fetches all rows from `clients` table,
 * writes them to data/clients.json and POSTs the payload to an n8n webhook.
 *
 * Usage: copy .env.example to .env and fill in values, then run:
 *   npm run fetch-clients
 */

import dotenv from 'dotenv';
dotenv.config();

import { Pool } from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sendToWebhook from './utils/sendToWebhook.js';
import { createClient } from '@supabase/supabase-js';

// CONTRACT (inputs/outputs)
// - Inputs: env vars DB_HOST, DB_PORT, DB_USER, DB_PASSWORD, DB_NAME, N8N_WEBHOOK_URL
// - Output: writes data/clients.json (array) and POSTs same array to webhook

// Basic env validation
const {
  DB_HOST,
  DB_PORT,
  DB_USER,
  DB_PASSWORD,
  DB_NAME,
  N8N_WEBHOOK_URL,
  // Optional single connection string (postgres://...)
  DB_URL,
  // Supabase service role mode (preferred if set)
  SUPABASE_URL,
  SUPABASE_SERVICE_ROLE,
} = process.env;

// If SUPABASE_URL + SUPABASE_SERVICE_ROLE are set, we will use the Supabase client
// (server-side service_role) to fetch rows. Otherwise, fall back to pg using either
// DB_URL or the individual DB_* variables.

if (!((SUPABASE_URL && SUPABASE_SERVICE_ROLE) || DB_URL || (DB_HOST && DB_USER && DB_PASSWORD && DB_NAME))) {
  console.error('Missing DB connection info. Provide SUPABASE_URL & SUPABASE_SERVICE_ROLE OR DB_URL OR DB_HOST, DB_USER, DB_PASSWORD, DB_NAME.');
  process.exit(1);
}

// Build a pg Pool only if we're not using the Supabase service_role client
let pool = null;
if (!(SUPABASE_URL && SUPABASE_SERVICE_ROLE)) {
  const poolConfig = DB_URL
    ? { connectionString: DB_URL, ssl: { rejectUnauthorized: false }, max: 5, idleTimeoutMillis: 30000 }
    : {
        host: DB_HOST,
        port: DB_PORT ? Number(DB_PORT) : 5432,
        user: DB_USER,
        password: DB_PASSWORD,
        database: DB_NAME,
        ssl: { rejectUnauthorized: false },
        max: 5,
        idleTimeoutMillis: 30000,
      };

  pool = new Pool(poolConfig);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, 'data');
const OUT_FILE = path.join(DATA_DIR, 'clients.json');

function formatTimestamp(ts) {
  if (ts === null || ts === undefined) return null;
  // pg may return Date objects already; guard for strings too
  const d = ts instanceof Date ? ts : new Date(ts);
  // produce ISO with +00:00 instead of Z for explicit offset if UTC
  const iso = d.toISOString();
  return iso.endsWith('Z') ? iso.replace('Z', '+00:00') : iso;
}

async function fetchClients() {
  // If SUPABASE service role credentials are provided, use the Supabase client
  if (SUPABASE_URL && SUPABASE_SERVICE_ROLE) {
    const supa = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE, {
      // use server-side mode; this runs on server/trusted environment
      auth: { persistSession: false },
    });

    const { data, error } = await supa.from('call_records').select('id,name,phone_number,email,last_visit,details,update_call_summary,retell_call_id,status,created_at,updated_at');
    if (error) throw new Error(`Supabase query error: ${error.message}`);

    const rows = data || [];

    return rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone_number: r.phone_number,
      email: r.email,
      last_visit: r.last_visit,
      details: r.details === undefined ? null : r.details,
      update_call_summary: r.update_call_summary === undefined ? null : r.update_call_summary,
      retell_call_id: r.retell_call_id === undefined ? null : r.retell_call_id,
      status: r.status,
      created_at: formatTimestamp(r.created_at),
      updated_at: formatTimestamp(r.updated_at),
    }));
  }

  // Otherwise, use pg Pool
  const client = await pool.connect();
  try {
    const q = `SELECT id, name, phone_number, email, last_visit, details, update_call_summary, retell_call_id, status, created_at, updated_at FROM clients`;
    const res = await client.query(q);

    const rows = res.rows || [];

    // Map rows into clean JSON shape required
    const clean = rows.map((r) => ({
      id: r.id,
      name: r.name,
      phone_number: r.phone_number,
      email: r.email,
      last_visit: r.last_visit,
      details: r.details === undefined ? null : r.details,
      update_call_summary: r.update_call_summary === undefined ? null : r.update_call_summary,
      retell_call_id: r.retell_call_id === undefined ? null : r.retell_call_id,
      status: r.status,
      created_at: formatTimestamp(r.created_at),
      updated_at: formatTimestamp(r.updated_at),
    }));

    return clean;
  } finally {
    client.release();
  }
}

async function ensureDataDir() {
  try {
    await fs.promises.mkdir(DATA_DIR, { recursive: true });
  } catch (err) {
    // ignore if exists
    if (err.code !== 'EEXIST') throw err;
  }
}

async function main() {
  console.log('Starting clients fetch...');

  try {
    const data = await fetchClients();

    await ensureDataDir();

    // Write to file (overwrite if exists)
    await fs.promises.writeFile(OUT_FILE, JSON.stringify(data, null, 2), 'utf8');

    console.log(`Wrote ${data.length} client(s) to ${OUT_FILE}`);

    if (!N8N_WEBHOOK_URL) {
      console.warn('N8N_WEBHOOK_URL not set; skipping webhook POST. If you want to POST set the env var in .env');
      return;
    }

    // Send to webhook
    try {
      const resp = await sendToWebhook(N8N_WEBHOOK_URL, data, { timeoutMs: 15000 });
      console.log('Webhook POST successful. Response:', resp);
    } catch (err) {
      console.error('Failed to POST to webhook:', err.message || err);
    }
  } catch (err) {
    console.error('Error during fetch:', err.message || err);
    process.exitCode = 2;
  } finally {
    await pool.end();
  }
}

// If run directly
const mainInvokedDirectly = process.argv[1] === fileURLToPath(import.meta.url);

if (mainInvokedDirectly) {
  main();
}

export { fetchClients };
