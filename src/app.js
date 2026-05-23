import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { checkPrerequisites, normalizeQuality, normalizeUrl } from './downloader.js';
import { cancelJob, createJob, getJob, listJobs, subscribeToJob } from './jobs.js';
import { openDownloadsFolder } from './open-folder.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const publicDir = path.resolve(__dirname, '..', 'public');

export function createApp({ openFolder = openDownloadsFolder } = {}) {
  const app = express();

  app.use(express.json({ limit: '32kb' }));
  app.use(express.static(publicDir));

  app.get('/api/health', async (_req, res) => {
    try {
      await checkPrerequisites();
      res.json({ ok: true });
    } catch (error) {
      res.status(503).json({ ok: false, error: error.message });
    }
  });

  app.get('/api/jobs', (_req, res) => {
    res.json({ jobs: listJobs() });
  });

  app.post('/api/downloads', (req, res) => {
    try {
      const url = normalizeUrl(req.body?.url);
      const quality = normalizeQuality(req.body?.quality);
      const job = createJob({ url, quality });
      res.status(202).json({ job });
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  });

  app.post('/api/downloads/open-folder', async (_req, res) => {
    try {
      await openFolder();
      res.status(204).end();
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  });

  app.post('/api/jobs/:id/cancel', (req, res) => {
    if (!cancelJob(req.params.id)) {
      res.status(404).json({ error: 'Job not found or already finished.' });
      return;
    }

    res.status(204).end();
  });

  app.get('/api/jobs/:id/events', (req, res) => {
    const job = getJob(req.params.id);
    if (!job) {
      res.status(404).json({ error: 'Job not found.' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    });

    const send = (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    };

    send({
      id: job.id,
      url: job.url,
      quality: job.quality,
      status: job.status,
      progress: job.progress,
      message: job.message,
      createdAt: job.createdAt,
      updatedAt: job.updatedAt,
    });

    const unsubscribe = subscribeToJob(req.params.id, send);
    req.on('close', () => unsubscribe?.());
  });

  return app;
}
