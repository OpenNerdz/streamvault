import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  checkPrerequisites,
  createDownloadArgs,
  getFormatSelector,
  getRuntimePaths,
  normalizeQuality,
  normalizeUrl,
  parseProgress,
} from '../src/downloader.js';

describe('downloader options', () => {
  it('uses best video plus best audio by default', () => {
    assert.equal(getFormatSelector(), 'bv*+ba/b');
  });

  it('limits quality when a maximum height is selected', () => {
    assert.equal(getFormatSelector('1080'), 'bv*[height<=1080]+ba/b[height<=1080]/b');
  });

  it('builds yt-dlp args with a best-quality format selector', () => {
    const args = createDownloadArgs({
      url: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
      outputDir: '/tmp/downloads',
    });

    assert.deepEqual(args.slice(0, 10), [
      '--newline',
      '--no-playlist',
      '--windows-filenames',
      '--restrict-filenames',
      '--merge-output-format',
      'mp4',
      '--ffmpeg-location',
      getRuntimePaths().ffmpeg,
      '--format',
      'bv*+ba/b',
    ]);

    assert.equal(args.at(-1), 'https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    assert.ok(args.includes('/tmp/downloads/%(title).200B [%(id)s].%(ext)s'));
  });

  it('uses packaged downloader and ffmpeg binaries', () => {
    const paths = getRuntimePaths();

    assert.match(paths.ytDlp, /yt-dlp-exec/);
    assert.match(paths.ffmpeg, /ffmpeg-static/);
  });

  it('can execute the packaged downloader tools', async () => {
    await checkPrerequisites();
  });
});

describe('input normalization', () => {
  it('accepts http and https URLs', () => {
    assert.equal(normalizeUrl(' https://youtu.be/example '), 'https://youtu.be/example');
  });

  it('rejects unsupported protocols', () => {
    assert.throws(() => normalizeUrl('file:///tmp/video.mp4'), /Only HTTP and HTTPS/);
  });

  it('rejects unsupported quality values', () => {
    assert.throws(() => normalizeQuality('9999'), /Unsupported quality/);
  });
});

describe('progress parsing', () => {
  it('extracts yt-dlp download progress', () => {
    assert.equal(parseProgress('[download]  42.7% of 40.00MiB at 4.00MiB/s ETA 00:06'), 42.7);
  });

  it('ignores unrelated output', () => {
    assert.equal(parseProgress('[Merger] Merging formats into file.mp4'), null);
  });
});
