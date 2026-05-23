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
});
