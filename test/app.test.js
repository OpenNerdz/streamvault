import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import request from 'supertest';
import { createApp } from '../src/app.js';

describe('api', () => {
  it('serves the app shell', async () => {
    const response = await request(createApp()).get('/').expect(200);
    assert.match(response.text, /StreamVault/);
  });

  it('rejects invalid download requests without starting a job', async () => {
    const response = await request(createApp())
      .post('/api/downloads')
      .send({ url: 'not a url', quality: 'best' })
      .expect(400);

    assert.match(response.body.error, /valid URL/);
  });

  it('rejects unsupported quality presets', async () => {
    const response = await request(createApp())
      .post('/api/downloads')
      .send({ url: 'https://youtu.be/example', quality: '9999' })
      .expect(400);

    assert.match(response.body.error, /Unsupported quality/);
  });

  it('opens the downloads folder through the API', async () => {
    let opened = false;

    await request(
      createApp({
        openFolder: async () => {
          opened = true;
        },
      }),
    )
      .post('/api/downloads/open-folder')
      .expect(204);

    assert.equal(opened, true);
  });

  it('reports downloads folder open failures', async () => {
    const response = await request(
      createApp({
        openFolder: async () => {
          throw new Error('open failed');
        },
      }),
    )
      .post('/api/downloads/open-folder')
      .expect(500);

    assert.equal(response.body.error, 'open failed');
  });
});
