import assert from 'node:assert/strict';
import test from 'node:test';
import { createDeployedCacheReader } from './deployed-cache.mjs';

function httpError(status) {
  return Object.assign(new Error(`HTTP ${status}`), { status });
}

test('reads the remote cache with the requested timeout and attempts', async () => {
  const calls = [];
  const read = createDeployedCacheReader({
    baseUrl: 'https://example.test/app/',
    fetchRemoteJson: async (url, options) => {
      calls.push({ url, options });
      return { remote: true };
    },
    readLocalJson: async () => ({ local: true }),
  });

  assert.deepEqual(await read('data/item.json', { remoteTimeoutMs: 5_000, remoteAttempts: 1 }), { remote: true });
  assert.equal(calls[0].url, 'https://example.test/app/data/item.json');
  assert.equal(calls[0].options.timeoutMs, 5_000);
  assert.equal(calls[0].options.attempts, 1);
});

test('opens the shared circuit after service failures and then uses checkout cache', async () => {
  let remoteCalls = 0;
  const localPaths = [];
  const warnings = [];
  const circuit = { open: false, consecutiveFailures: 0, failureThreshold: 2, reported: false };
  const read = createDeployedCacheReader({
    baseUrl: 'https://example.test/app/',
    fetchRemoteJson: async () => {
      remoteCalls += 1;
      throw httpError(503);
    },
    readLocalJson: async (relativePath) => {
      localPaths.push(relativePath);
      return { relativePath };
    },
    warn: (message) => warnings.push(message),
  });

  await read('data/one.json', { remoteCircuit: circuit });
  await read('data/two.json', { remoteCircuit: circuit });
  await read('data/three.json', { remoteCircuit: circuit });

  assert.equal(remoteCalls, 2);
  assert.equal(circuit.open, true);
  assert.deepEqual(localPaths, ['data/one.json', 'data/two.json', 'data/three.json']);
  assert.equal(warnings.length, 1);
});

test('bounds concurrent cache failures and keeps the shared circuit open', async () => {
  let remoteCalls = 0;
  let releaseRequests;
  const requestGate = new Promise((resolve) => { releaseRequests = resolve; });
  const warnings = [];
  const circuit = { open: false, consecutiveFailures: 0, failureThreshold: 2, reported: false };
  const read = createDeployedCacheReader({
    baseUrl: 'https://example.test/app/',
    fetchRemoteJson: async () => {
      remoteCalls += 1;
      await requestGate;
      throw httpError(503);
    },
    readLocalJson: async (relativePath) => ({ relativePath }),
    warn: (message) => warnings.push(message),
  });

  const firstBatch = ['one', 'two', 'three'].map((name) => (
    read(`data/${name}.json`, { remoteCircuit: circuit })
  ));
  assert.equal(remoteCalls, 3);
  releaseRequests();
  await Promise.all(firstBatch);

  assert.equal(circuit.open, true);
  assert.equal(warnings.length, 1);
  assert.deepEqual(
    await read('data/four.json', { remoteCircuit: circuit }),
    { relativePath: 'data/four.json' },
  );
  assert.equal(remoteCalls, 3);
});

test('treats a public-cache 403 as a host failure but not a missing file 404', async () => {
  const queue = [httpError(404), httpError(403)];
  const circuit = { open: false, consecutiveFailures: 0, failureThreshold: 1, reported: false };
  const read = createDeployedCacheReader({
    baseUrl: 'https://example.test/app/',
    fetchRemoteJson: async () => {
      throw queue.shift();
    },
    readLocalJson: async () => null,
    warn: () => {},
  });

  await read('data/missing.json', { remoteCircuit: circuit });
  assert.equal(circuit.open, false);
  await read('data/forbidden.json', { remoteCircuit: circuit });
  assert.equal(circuit.open, true);
});

test('a successful remote read resets consecutive failures before the circuit opens', async () => {
  const queue = [httpError(503), { ok: true }, httpError(503)];
  const circuit = { open: false, consecutiveFailures: 0, failureThreshold: 2, reported: false };
  const read = createDeployedCacheReader({
    baseUrl: 'https://example.test/app/',
    fetchRemoteJson: async () => {
      const next = queue.shift();
      if (next instanceof Error) throw next;
      return next;
    },
    readLocalJson: async () => null,
    warn: () => {},
  });

  await read('data/one.json', { remoteCircuit: circuit });
  assert.equal(circuit.consecutiveFailures, 1);
  assert.deepEqual(await read('data/two.json', { remoteCircuit: circuit }), { ok: true });
  assert.equal(circuit.consecutiveFailures, 0);
  await read('data/three.json', { remoteCircuit: circuit });
  assert.equal(circuit.open, false);
  assert.equal(circuit.consecutiveFailures, 1);
});
