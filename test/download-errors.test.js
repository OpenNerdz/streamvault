import assert from 'node:assert/strict';
import { EventEmitter } from 'node:events';
import { describe, it } from 'node:test';
import { startDownload } from '../src/downloader.js';

describe('download errors', () => {
  it('uses the last yt-dlp stderr line as the failure message', async () => {
    const child = new EventEmitter();
    child.stdout = new EventEmitter();
    child.stderr = new EventEmitter();

    const download = startDownload({
      url: 'https://youtu.be/example',
      outputDir: '/tmp',
      spawnDownload: () => child,
    });

    queueMicrotask(() => {
      child.stderr.emit(
        'data',
        Buffer.from('ERROR: unable to download video data: HTTP Error 403: Forbidden\n'),
      );
      child.emit('exit', 1);
    });

    await assert.rejects(
      download.done,
      /ERROR: unable to download video data: HTTP Error 403: Forbidden/,
    );
  });
});
