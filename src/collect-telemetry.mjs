import fs from 'node:fs';
import {gpuStatus,processCleanup} from './maintenance.mjs';
import os from 'node:os';
import { pathToFileURL } from 'node:url';
import pg from 'pg';

const SOURCE = 'server-hetzner';
const INTERVAL_MS = 15_000;
const SYSTEM_USER = 'VForgeLab Telemetry';
const gib = bytes => `${(bytes / 1024 ** 3).toFixed(1)}G`;

// Read operating-system measurements only. No GPU or model health is inferred.
export function collectMetrics() {
  const disk = fs.statfsSync('/');
  const diskTotal = disk.blocks * disk.bsize;
  const diskUsed = (disk.blocks - disk.bfree) * disk.bsize;
  const diskFree = disk.bavail * disk.bsize;
  const diskPct = Math.round(100 * diskUsed / (diskUsed + diskFree));
  const ramTotal = os.totalmem();
  const ramFree = os.freemem();
  const load = os.loadavg();
  return {
    source: SOURCE,
    observed_at: new Date().toISOString(),
    disco: { total: gib(diskTotal), usado: gib(diskUsed), libre: gib(diskFree), pct: `${diskPct}%` },
    ram: { total_mb: Math.round(ramTotal / 1024 ** 2), libre_mb: Math.round(ramFree / 1024 ** 2) },
    load,
    uptime_seconds: os.uptime(),
    cpu_count: os.cpus().length,
    platform: os.platform(),
    disk_pct: diskPct,
    disk_free_gb: diskFree / 1024 ** 3,
    disk_total_bytes: diskTotal,
    disk_used_bytes: diskUsed,
    disk_free_bytes: diskFree,
    ram_total_bytes: ramTotal,
    ram_free_bytes: ramFree,
    daemon: null,
    procesos: [],
  };
}

async function telemetryUser(pool) {
  const db = await pool.connect();
  try {
    await db.query('BEGIN');
    await db.query('SELECT pg_advisory_xact_lock(hashtextextended($1,0))', ['vforgelab:telemetry-user']);
    const existing = await db.query('SELECT id FROM app.users WHERE display_name=$1 ORDER BY created_at,id LIMIT 1', [SYSTEM_USER]);
    const user = existing.rows[0] ?? (await db.query('INSERT INTO app.users (display_name) VALUES ($1) RETURNING id', [SYSTEM_USER])).rows[0];
    await db.query('COMMIT');
    return user.id;
  } catch (error) {
    await db.query('ROLLBACK').catch(() => {});
    throw error;
  } finally {
    db.release();
  }
}

const errorCode = error => /^[A-Za-z0-9_]{1,50}$/.test(error?.code ?? '') ? error.code : 'collection_failed';

export async function runCollector({ env = process.env, once = false } = {}) {
  if (!env.DATABASE_URL) throw Object.assign(new Error('Database configuration missing'), { code: 'database_not_configured' });
  // Keep TLS verification from the protected DATABASE_URL; never disable it.
  const pool = new pg.Pool({ connectionString: env.DATABASE_URL, max: 5, connectionTimeoutMillis: 10_000, idleTimeoutMillis: 30_000 });
  pool.on('error', error => console.error(JSON.stringify({ error: errorCode(error) })));
  let stopped = false;
  let timer;
  let wake;
  const stop = () => { stopped = true; clearTimeout(timer); wake?.(); };
  process.once('SIGTERM', stop);
  process.once('SIGINT', stop);
  try {
    let userId;
    do {
      const started = Date.now();
      try {
        userId ??= await telemetryUser(pool);
        const metrics = collectMetrics();
        metrics.gpus = await gpuStatus();
        metrics.cleanup = await processCleanup(pool);
        await pool.query('INSERT INTO app.telemetry_events (user_id,source,observed_at,metrics) VALUES ($1,$2,$3,$4)', [userId, SOURCE, metrics.observed_at, metrics]);
      } catch (error) {
        console.error(JSON.stringify({ error: errorCode(error) }));
        if (once) throw error;
      }
      if (once || stopped) break;
      await new Promise(resolve => { wake = resolve; timer = setTimeout(resolve, Math.max(0, INTERVAL_MS - (Date.now() - started))); });
      wake = undefined;
    } while (!stopped);
  } finally {
    process.removeListener('SIGTERM', stop);
    process.removeListener('SIGINT', stop);
    clearTimeout(timer);
    await pool.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  runCollector({ once: process.argv.includes('--once') }).catch(error => {
    console.error(JSON.stringify({ error: errorCode(error) }));
    process.exitCode = 1;
  });
}
