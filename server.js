// Simple backend server to bridge frontend actions to Node scripts and n8n callbacks
// ESM module (package.json has "type":"module")
import express from 'express';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawn } from 'child_process';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT ? Number(process.env.PORT) : 4000;

app.use(express.json());

// Paths
const DATA_DIR = path.resolve(__dirname, 'data');
const CLIENTS_FILE = path.join(DATA_DIR, 'clients.json');
const COUNTER_FILE = path.join(DATA_DIR, 'counter.json');

async function ensureDataDir() {
  await fs.promises.mkdir(DATA_DIR, { recursive: true }).catch(() => {});
}

async function readCounter() {
  try {
    const raw = await fs.promises.readFile(COUNTER_FILE, 'utf8');
    return JSON.parse(raw);
  } catch (err) {
    return { total: 0, success: 0, lastRun: null, lastUpdate: null };
  }
}

async function writeCounter(counter) {
  await ensureDataDir();
  const body = JSON.stringify(counter, null, 2);
  await fs.promises.writeFile(COUNTER_FILE, body, 'utf8');
}

// Start calls by spawning the existing db_fetch.js script
app.post('/api/start-calls', async (req, res) => {
  await ensureDataDir();

  // Reset counter when a new run starts (success 0, total set after run)
  const startTime = new Date().toISOString();
  await writeCounter({ total: 0, success: 0, lastRun: startTime, lastUpdate: startTime });

  const child = spawn(process.execPath, ['db_fetch.js'], {
    cwd: __dirname,
    stdio: ['ignore', 'pipe', 'pipe'],
    env: process.env,
  });

  let stdout = '';
  let stderr = '';
  child.stdout.on('data', (d) => (stdout += d.toString()));
  child.stderr.on('data', (d) => (stderr += d.toString()));

  child.on('close', async (code) => {
    // Try to read clients length on completion
    let total = 0;
    try {
      const raw = await fs.promises.readFile(CLIENTS_FILE, 'utf8');
      const arr = JSON.parse(raw);
      if (Array.isArray(arr)) total = arr.length;
    } catch {}

    const now = new Date().toISOString();
    const current = await readCounter();
    await writeCounter({ ...current, total, lastUpdate: now });

    // Log nicely in server output
    console.log(`db_fetch.js exited with code ${code}\n--- stdout ---\n${stdout}\n--- stderr ---\n${stderr}`);
  });

  // Respond immediately; frontend can poll /api/counter for updates
  res.json({ started: true, message: 'Fetch + webhook process started', pid: child.pid });
});

// n8n HTTPS POST node should call this endpoint on successful execution
// Accept flexible payloads: { success: true } OR { status: 'ok' } OR { flag: 'success' }
app.post('/api/n8n/callback', async (req, res) => {
  const body = req.body || {};
  const success = Boolean(body.success) || body.status === 'ok' || body.flag === 'success' || body.result === 'success';
  if (!success) {
    return res.status(400).json({ ok: false, message: 'Expected success flag in payload' });
  }

  const counter = await readCounter();
  const now = new Date().toISOString();
  const updated = { ...counter, success: (counter.success || 0) + 1, lastUpdate: now };
  await writeCounter(updated);
  res.json({ ok: true, counter: updated });
});

// Expose current counter for the frontend to poll
app.get('/api/counter', async (_req, res) => {
  const counter = await readCounter();
  res.json(counter);
});

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, uptime: process.uptime(), timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
