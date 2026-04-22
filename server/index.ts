/**
 * SoGoJet VPS API server — drop-in replacement for Vercel serverless functions.
 *
 * Auto-mounts every handler under /root/SwypeFly/api/**\/*.ts at its matching route.
 * Vercel-style dynamic segments ([id]) are translated to Express (:id).
 * File-private modules prefixed with `_` are skipped (they are helpers, not routes).
 *
 * Listens on 127.0.0.1:7778, proxied by nginx at sogojet.com.
 */
import express, { type Request, type Response, type NextFunction } from 'express';
import fs from 'fs';
import path from 'path';
import cron from 'node-cron';

const PORT = Number(process.env.PORT || 7778);
const HOST = process.env.HOST || '127.0.0.1';
const API_DIR = path.resolve(__dirname, '..', 'api');
const CRON_SECRET = process.env.CRON_SECRET || '';

const app = express();

// Trust nginx's X-Forwarded-* headers
app.set('trust proxy', 'loopback');

// Body parsing — Vercel parses JSON automatically into req.body
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));
app.use(express.text({ type: ['text/*', 'application/xml'], limit: '10mb' }));

// Request logging with prefix for journalctl filtering
app.use((req: Request, _res: Response, next: NextFunction) => {
  const ts = new Date().toISOString();
  console.log(`[sogojet-api] ${ts} ${req.method} ${req.originalUrl}`);
  next();
});

/**
 * Walk api/ recursively and collect handler files.
 * Returns list of { filePath, routePath, methods }.
 */
function collectRoutes(dir: string, base = ''): Array<{ file: string; route: string }> {
  const out: Array<{ file: string; route: string }> = [];
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      // Skip private dirs starting with _ or .
      if (entry.name.startsWith('_') || entry.name.startsWith('.')) continue;
      out.push(...collectRoutes(full, path.posix.join(base, entry.name)));
      continue;
    }
    if (!entry.isFile()) continue;
    // Only *.ts handlers (skip .bak, .d.ts, files starting with _)
    if (!entry.name.endsWith('.ts')) continue;
    if (entry.name.endsWith('.d.ts')) continue;
    if (entry.name.startsWith('_')) continue;

    // Filename → route segment
    // foo.ts → /foo, [id].ts → /:id, sitemap.xml.ts → /sitemap.xml
    const raw = entry.name.replace(/\.ts$/, '');
    const seg = raw.replace(/^\[(.+)\]$/, ':$1');
    const route = path.posix.join('/api', base, seg);
    out.push({ file: full, route });
  }
  return out;
}

/**
 * Wrap a Vercel-style handler as Express middleware.
 * Vercel's req/res API is a superset-compatible subset of Express.
 */
function wrapHandler(handler: (req: Request, res: Response) => Promise<void> | void) {
  return async (req: Request, res: Response, next: NextFunction) => {
    try {
      // Vercel merges dynamic params into req.query; Express keeps them separate.
      // Merge so handlers work unchanged.
      // Express 5 makes req.query a non-writable getter. Merge params in
      // without mutating the property — redefine it on this request only.
      const merged = { ...req.query, ...req.params };
      Object.defineProperty(req, 'query', {
        value: merged,
        writable: true,
        configurable: true,
        enumerable: true,
      });
      await handler(req, res);
    } catch (err) {
      console.error(`[sogojet-api] handler error on ${req.originalUrl}:`, err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'INTERNAL_ERROR', message: 'Handler threw' });
      } else {
        next(err);
      }
    }
  };
}

async function loadRoutes() {
  const routes = collectRoutes(API_DIR);
  console.log(`[sogojet-api] mounting ${routes.length} routes from ${API_DIR}`);
  for (const { file, route } of routes) {
    try {
      const mod = await import(file);
      const handler = mod.default || mod.handler;
      if (typeof handler !== 'function') {
        console.warn(`[sogojet-api] SKIP ${route} — no default export in ${file}`);
        continue;
      }
      // Register for all common HTTP verbs + OPTIONS; handler decides what to do.
      app.all(route, wrapHandler(handler));
      console.log(`[sogojet-api] mounted ${route}  <-  ${path.relative(API_DIR, file)}`);
    } catch (err) {
      console.error(`[sogojet-api] FAILED to load ${file}:`, err);
    }
  }
}

// Health check
app.get('/health', (_req, res) => {
  res.json({ ok: true, service: 'sogojet-api', ts: new Date().toISOString() });
});

// 404 handler
function install404() {
  app.use((req: Request, res: Response) => {
    res.status(404).json({ error: 'NOT_FOUND', path: req.originalUrl });
  });
}

/**
 * Internal cron dispatcher — hits our own API routes with cron auth headers,
 * mirroring the behaviour of Vercel Cron.
 */
function scheduleCrons() {
  if (!CRON_SECRET) {
    console.warn('[sogojet-api] CRON_SECRET unset — skipping cron schedule');
    return;
  }

  const jobs: Array<{ name: string; schedule: string; pathAndQuery: string; method?: 'GET' | 'POST' }> = [
    { name: 'prices/refresh',          schedule: '0 * * * *',    pathAndQuery: '/api/prices/refresh' },
    { name: 'prices/refresh-hotels',   schedule: '0 18 * * *',   pathAndQuery: '/api/prices/refresh-hotels' },
    { name: 'images/refresh',          schedule: '0 12 * * *',   pathAndQuery: '/api/images/refresh' },
    { name: 'alerts?action=check',     schedule: '0 8 * * *',    pathAndQuery: '/api/alerts?action=check' },
    { name: 'prices/refresh-calendar', schedule: '0 */2 * * *',  pathAndQuery: '/api/prices/refresh-calendar' },
    { name: 'newsletter',              schedule: '0 10 * * 1',   pathAndQuery: '/api/newsletter' },
  ];

  for (const job of jobs) {
    cron.schedule(job.schedule, async () => {
      const url = `http://127.0.0.1:${PORT}${job.pathAndQuery}`;
      const started = Date.now();
      console.log(`[sogojet-cron] firing ${job.name} -> ${url}`);
      try {
        const r = await fetch(url, {
          method: job.method || 'GET',
          headers: {
            'Authorization': `Bearer ${CRON_SECRET}`,
            'x-vercel-cron': '1',
            'User-Agent': 'sogojet-internal-cron',
          },
        });
        const ms = Date.now() - started;
        console.log(`[sogojet-cron] ${job.name} -> ${r.status} in ${ms}ms`);
      } catch (err) {
        console.error(`[sogojet-cron] ${job.name} failed:`, err);
      }
    }, { timezone: 'UTC' });
    console.log(`[sogojet-api] scheduled cron ${job.name} (${job.schedule} UTC)`);
  }
}

(async () => {
  await loadRoutes();
  install404();
  scheduleCrons();
  app.listen(PORT, HOST, () => {
    console.log(`[sogojet-api] listening on http://${HOST}:${PORT}`);
  });
})().catch((err) => {
  console.error('[sogojet-api] startup failed:', err);
  process.exit(1);
});
