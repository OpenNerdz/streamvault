const form = document.querySelector('#downloadForm');
const jobsEl = document.querySelector('#jobs');
const healthEl = document.querySelector('#health');
const openFolderButton = document.querySelector('#openDownloadsFolder');
const refreshButton = document.querySelector('#refreshJobs');
const submitButton = form.querySelector('button[type="submit"]');
const streams = new Map();

function setHealth(ok, message) {
  const dot = healthEl.querySelector('.dot');
  dot.className = `dot ${ok ? 'ready' : 'error'}`;
  healthEl.querySelector('span:last-child').textContent = message;
}

async function checkHealth() {
  try {
    const response = await fetch('/api/health');
    const payload = await response.json();
    if (!response.ok) {
      setHealth(false, payload.error || 'Missing tools');
      return;
    }

    setHealth(true, 'Ready');
  } catch {
    setHealth(false, 'Server offline');
  }
}

function renderJobs(jobs) {
  if (!jobs.length) {
    jobsEl.innerHTML = '<div class="empty">No downloads yet.</div>';
    return;
  }

  jobsEl.innerHTML = jobs
    .map(
      (job) => `
        <article class="job" data-job-id="${job.id}">
          <div class="job-main">
            <div>
              <div class="url" title="${escapeHtml(job.url)}">${escapeHtml(job.url)}</div>
              <div class="meta">${escapeHtml(job.message || '')}</div>
            </div>
            <div class="status ${job.status}">${job.status}</div>
          </div>
          <div class="bar" aria-label="Progress">
            <div class="fill" style="width: ${Math.max(0, Math.min(100, job.progress || 0))}%"></div>
          </div>
        </article>
      `,
    )
    .join('');
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

async function loadJobs() {
  const response = await fetch('/api/jobs');
  const payload = await response.json();
  renderJobs(payload.jobs);

  for (const job of payload.jobs) {
    if (['queued', 'running'].includes(job.status) && !streams.has(job.id)) {
      watchJob(job.id);
    }
  }
}

function watchJob(id) {
  const source = new EventSource(`/api/jobs/${id}/events`);
  streams.set(id, source);

  source.onmessage = () => loadJobs();
  source.onerror = () => {
    source.close();
    streams.delete(id);
  };
}

form.addEventListener('submit', async (event) => {
  event.preventDefault();

  const data = new FormData(form);
  submitButton.disabled = true;

  try {
    const response = await fetch('/api/downloads', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: data.get('url'),
        quality: data.get('quality'),
      }),
    });

    const payload = await response.json();
    if (!response.ok) {
      throw new Error(payload.error || 'Download could not be started.');
    }

    form.reset();
    watchJob(payload.job.id);
    await loadJobs();
  } catch (error) {
    setHealth(false, error.message);
  } finally {
    submitButton.disabled = false;
  }
});

refreshButton.addEventListener('click', loadJobs);

openFolderButton.addEventListener('click', async () => {
  openFolderButton.disabled = true;

  try {
    const response = await fetch('/api/downloads/open-folder', {
      method: 'POST',
    });

    if (!response.ok) {
      const payload = await response.json();
      throw new Error(payload.error || 'Could not open the downloads folder.');
    }
  } catch (error) {
    setHealth(false, error.message);
  } finally {
    openFolderButton.disabled = false;
  }
});

await checkHealth();
await loadJobs();
