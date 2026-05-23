import { EventEmitter } from 'node:events';
import crypto from 'node:crypto';
import { startDownload } from './downloader.js';

const jobs = new Map();

function snapshot(job) {
  return {
    id: job.id,
    url: job.url,
    quality: job.quality,
    status: job.status,
    progress: job.progress,
    message: job.message,
    createdAt: job.createdAt,
    updatedAt: job.updatedAt,
  };
}

function update(job, patch) {
  Object.assign(job, patch, { updatedAt: new Date().toISOString() });
  job.events.emit('update', snapshot(job));
}

export function listJobs() {
  return [...jobs.values()].map(snapshot).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export function getJob(id) {
  return jobs.get(id);
}

export function createJob({ url, quality }) {
  const job = {
    id: crypto.randomUUID(),
    url,
    quality,
    status: 'queued',
    progress: 0,
    message: 'Queued',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    events: new EventEmitter(),
    child: null,
  };

  jobs.set(job.id, job);

  queueMicrotask(() => {
    update(job, { status: 'running', message: 'Starting download' });

    const download = startDownload({
      url,
      quality,
      onLine: ({ line, progress }) => {
        if (progress !== null) {
          update(job, { progress, message: line });
        } else if (!line.includes('[download] Destination:')) {
          update(job, { message: line });
        }
      },
    });

    job.child = download.child;

    download.done
      .then(() => update(job, { status: 'complete', progress: 100, message: 'Download complete' }))
      .catch((error) => update(job, { status: 'failed', message: error.message }));
  });

  return snapshot(job);
}

export function cancelJob(id) {
  const job = jobs.get(id);
  if (!job || !['queued', 'running'].includes(job.status)) {
    return false;
  }

  job.child?.kill('SIGTERM');
  update(job, { status: 'canceled', message: 'Canceled' });
  return true;
}

export function subscribeToJob(id, listener) {
  const job = jobs.get(id);
  if (!job) {
    return null;
  }

  job.events.on('update', listener);
  return () => job.events.off('update', listener);
}
