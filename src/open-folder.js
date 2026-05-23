import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { DOWNLOADS_DIR } from './downloader.js';

export async function openDownloadsFolder(dirPath = DOWNLOADS_DIR) {
  await mkdir(dirPath, { recursive: true });

  const [command, args] = getOpenCommand(dirPath);
  const child = spawn(command, args, {
    detached: true,
    stdio: 'ignore',
  });

  child.unref();
}

export function getOpenCommand(dirPath) {
  if (process.platform === 'win32') {
    return ['explorer', [dirPath]];
  }

  if (process.platform === 'darwin') {
    return ['open', [dirPath]];
  }

  return ['xdg-open', [dirPath]];
}
