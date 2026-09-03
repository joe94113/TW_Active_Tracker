import assert from 'node:assert/strict';
import test from 'node:test';
import { createResilientRequester } from './resilient-request.mjs';

function response(body, { status = 200, statusText = 'OK', headers = {} } = {}) {
  return new Response(body, { status, statusText, headers });
}

test('retries a 2xx HTML body and accepts JSON served as text/html', async () => {
  const queue = [
    response('<html><head><title>blocked</title></head></html>', { headers: { 'content-type': 'text/html' } }),
    response('{"ok":true}', { headers: { 'content-type': 'text/html' } }),
  ];
  const waits = [];
  const request = createResilientRequester({
    fetchImpl: async () => queue.shift(),
    sleep: async (ms) => waits.push(ms),
    random: () => 0,
    warn: () => {},
  });

  const payload = await request({ url: 'https://example.test/data', responseType: 'json' });
  assert.deepEqual(payload, { ok: true });
  assert.deepEqual(waits, [1200]);
});

test('accepts JSON served as application/octet-stream', async () => {
  const request = createResilientRequester({
    fetchImpl: async () => response('[{"Date":"20260902"}]', { headers: { 'content-type': 'application/octet-stream' } }),
    warn: () => {},
  });

  assert.deepEqual(
    await request({ url: 'https://example.test/taifex', responseType: 'json' }),
    [{ Date: '20260902' }],
  );
});

test('honours Retry-After and jitter for HTTP 429', async () => {
  const queue = [
    response('rate limited', { status: 429, statusText: 'Too Many Requests', headers: { 'retry-after': '3' } }),
    response('{"ok":true}'),
  ];
  const waits = [];
  const request = createResilientRequester({
    fetchImpl: async () => queue.shift(),
    sleep: async (ms) => waits.push(ms),
    random: () => 0.5,
    warn: () => {},
  });

  await request({ url: 'https://example.test/rate-limit', responseType: 'json' });
  assert.deepEqual(waits, [3200]);
});

test('retries a final 307 response but does not retry 403', async () => {
  const redirectQueue = [
    response('', { status: 307, statusText: 'Temporary Redirect' }),
    response('{"ok":true}'),
  ];
  const redirectRequest = createResilientRequester({
    fetchImpl: async () => redirectQueue.shift(),
    sleep: async () => {},
    random: () => 0,
    warn: () => {},
  });
  assert.deepEqual(
    await redirectRequest({ url: 'https://example.test/redirect', responseType: 'json' }),
    { ok: true },
  );

  let forbiddenCalls = 0;
  const forbiddenRequest = createResilientRequester({
    fetchImpl: async () => {
      forbiddenCalls += 1;
      return response('', { status: 403, statusText: 'Forbidden' });
    },
    sleep: async () => {},
    warn: () => {},
  });
  await assert.rejects(
    forbiddenRequest({ url: 'https://example.test/forbidden', responseType: 'json' }),
    /HTTP 403 Forbidden/,
  );
  assert.equal(forbiddenCalls, 1);
});

test('can accept a manual redirect response for cookie bootstrapping', async () => {
  const request = createResilientRequester({
    fetchImpl: async () => response('', {
      status: 302,
      statusText: 'Found',
      headers: { 'set-cookie': 'session=abc' },
    }),
    warn: () => {},
  });

  const result = await request({
    url: 'https://example.test/bootstrap',
    responseType: 'response',
    acceptResponse: (candidate) => candidate.ok || (candidate.status >= 300 && candidate.status < 400),
  });
  assert.equal(result.status, 302);
  assert.match(result.headers.get('set-cookie'), /session=abc/);
});

test('invalid JSON exposes only a short compact preview after retry exhaustion', async () => {
  const request = createResilientRequester({
    fetchImpl: async () => response(`{${'x'.repeat(500)}`),
    sleep: async () => {},
    random: () => 0,
    warn: () => {},
  });

  await assert.rejects(
    request({ url: 'https://example.test/broken', responseType: 'json', attempts: 1 }),
    (error) => error.code === 'INVALID_PAYLOAD' && error.payloadPreview.length <= 183,
  );
});

test('host policy limits concurrent requests to the same host', async () => {
  let active = 0;
  let maxActive = 0;
  const releases = [];
  const request = createResilientRequester({
    hostPolicies: {
      'limited.example.test': { concurrency: 1 },
    },
    fetchImpl: async () => {
      active += 1;
      maxActive = Math.max(maxActive, active);
      await new Promise((resolve) => releases.push(resolve));
      active -= 1;
      return response('{"ok":true}');
    },
    warn: () => {},
  });

  const first = request({ url: 'https://limited.example.test/first', responseType: 'json' });
  const second = request({ url: 'https://limited.example.test/second', responseType: 'json' });
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 1);
  assert.equal(releases.length, 1);

  releases.shift()();
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(active, 1);
  assert.equal(releases.length, 1);
  releases.shift()();
  await Promise.all([first, second]);
  assert.equal(maxActive, 1);
});

test('keeps timeout and retry coverage active while consuming a response body', async () => {
  let calls = 0;
  const request = createResilientRequester({
    fetchImpl: async (url, options) => {
      calls += 1;
      if (calls > 1) return response('recovered');
      return {
        ok: true,
        status: 200,
        text: () => new Promise((resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('body aborted'), { name: 'AbortError' })),
            { once: true },
          );
        }),
      };
    },
    sleep: async () => {},
    random: () => 0,
    warn: () => {},
  });

  assert.equal(
    await request({ url: 'https://example.test/stalled-body', responseType: 'text', timeoutMs: 5 }),
    'recovered',
  );
  assert.equal(calls, 2);
});
