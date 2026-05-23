import { spawn } from 'node:child_process';
import { access, constants, mkdir } from 'node:fs/promises';
import { createRequire } from 'node:module';
import path from 'node:path';
import ffmpegPath from 'ffmpeg-static';

const require = createRequire(import.meta.url);
const { YOUTUBE_DL_PATH: ytDlpPath } = require('yt-dlp-exec/src/constants');
const packagedYtDlpPath = resolveExecutablePath(ytDlpPath);
const packagedFfmpegPath = ffmpegPath ? resolveExecutablePath(ffmpegPath) : null;

export const DOWNLOADS_DIR = path.resolve(process.env.STREAMVAULT_DOWNLOADS_DIR ?? 'downloads');
export const QUALITY_PRESETS = new Set(['best', '2160', '1440', '1080', '720', '480', '360']);

function resolveExecutablePath(filePath) {
  return filePath.replace('app.asar', 'app.asar.unpacked');
}

export function getRuntimePaths() {
  return {
    ytDlp: packagedYtDlpPath,
    ffmpeg: packagedFfmpegPath,
  };
}

export function normalizeUrl(rawUrl) {
  if (typeof rawUrl !== 'string') {
    throw new TypeError('URL must be a string.');
  }

  const trimmed = rawUrl.trim();
  if (!trimmed) {
    throw new Error('Enter a video URL.');
  }

  let parsed;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error('Enter a valid URL.');
  }

  if (!['http:', 'https:'].includes(parsed.protocol)) {
    throw new Error('Only HTTP and HTTPS URLs are supported.');
  }

  return parsed.toString();
}

export function normalizeQuality(rawQuality = 'best') {
  const quality = String(rawQuality || 'best').trim();
  if (!QUALITY_PRESETS.has(quality)) {
    throw new Error('Unsupported quality preset.');
  }

  return quality;
}

export function getFormatSelector(quality = 'best') {
  const normalized = normalizeQuality(quality);

  if (normalized === 'best') {
    return 'bv*+ba/b';
  }

  return `bv*[height<=${normalized}]+ba/b[height<=${normalized}]/b`;
}

export function createDownloadArgs({ url, quality = 'best', outputDir = DOWNLOADS_DIR }) {
  const normalizedUrl = normalizeUrl(url);
  const formatSelector = getFormatSelector(quality);
  const outputTemplate = path.join(outputDir, '%(title).200B [%(id)s].%(ext)s');

  if (!packagedFfmpegPath) {
      throw new Error('Packaged FFmpeg binary is not available for this platform.');
  }

  return [
    '--newline',
    '--no-playlist',
    '--windows-filenames',
    '--restrict-filenames',
    '--merge-output-format',
    'mp4',
    '--ffmpeg-location',
    packagedFfmpegPath,
    '--format',
    formatSelector,
    '--output',
    outputTemplate,
    normalizedUrl,
  ];
}

export async function assertExecutableAvailable(binary, versionArgs = ['--version']) {
  await new Promise((resolve, reject) => {
    const child = spawn(binary, versionArgs, { stdio: ['ignore', 'ignore', 'ignore'] });
    child.once('error', reject);
    child.once('exit', (code) => {
      if (code === 0) {
        resolve();
      } else {
        reject(new Error(`${binary} exited with code ${code}.`));
      }
    });
  });
}

export async function checkPrerequisites() {
  const binaries = getRuntimePaths();

  if (!binaries.ffmpeg) {
    throw new Error('Packaged FFmpeg binary is not available for this platform.');
  }

  await assertExecutableAvailable(binaries.ytDlp);
  await assertExecutableAvailable(binaries.ffmpeg, ['-version']);
  await mkdir(DOWNLOADS_DIR, { recursive: true });
  await access(DOWNLOADS_DIR, constants.W_OK);
}

export function startDownload({ url, quality = 'best', outputDir = DOWNLOADS_DIR, onLine }) {
  const args = createDownloadArgs({ url, quality, outputDir });
  const child = spawn(packagedYtDlpPath, args, {
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  const emit = (kind, chunk) => {
    const lines = chunk
      .toString('utf8')
      .split(/\r?\n/)
      .map((line) => line.trim())
      .filter(Boolean);

    for (const line of lines) {
      onLine?.({ kind, line, progress: parseProgress(line) });
    }
  };

  child.stdout.on('data', (chunk) => emit('stdout', chunk));
  child.stderr.on('data', (chunk) => emit('stderr', chunk));

  return {
    child,
    done: new Promise((resolve, reject) => {
      child.once('error', reject);
      child.once('exit', (code) => {
        if (code === 0) {
          resolve();
        } else {
          reject(new Error(`yt-dlp exited with code ${code}.`));
        }
      });
    }),
  };
}

export function parseProgress(line) {
  const match = line.match(/\[download]\s+([0-9.]+)%/);
  return match ? Number(match[1]) : null;
}
