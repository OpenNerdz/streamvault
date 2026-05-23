# StreamVault

StreamVault is a small local web app for saving online videos through a packaged
`yt-dlp` binary. It keeps the UI clean, uses best available quality by default,
and leaves the actual download engine to proven tools instead of reimplementing
video extraction.

## Features

- Clean browser UI with progress updates.
- Best available quality by default via `yt-dlp` format selector `bv*+ba/b`.
- Optional maximum quality presets.
- Local-only download queue.
- Bundled `yt-dlp` and FFmpeg binaries through npm dependencies.
- Health check for the packaged downloader tools.
- Focused tests for URL validation, quality selection, command construction, and API validation.

## Requirements

- Node.js 20 or newer.

No separate `yt-dlp` or FFmpeg install is needed. They are installed with the app
dependencies.

## Run

```bash
npm install
npm start
```

Open `http://localhost:4137`.

Downloaded files are written to `downloads/`.

## Test

```bash
npm test
```

The tests do not call YouTube. They verify the downloader uses the best-quality
format selector by default and that the API rejects invalid input before a job is
created.

## Notes

Only download media that you have the right to save. Availability, formats, and
site support are handled by `yt-dlp`, so keeping that tool up to date is the best
way to keep StreamVault working.
