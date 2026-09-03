import assert from 'node:assert/strict';
import test from 'node:test';

import { buildBrokerBranchRadar } from './broker-branch-radar.mjs';

const INPUT = {
  stockMetaList: [
    {
      code: '2330',
      name: '台積電',
      dailyTradeValue: 1000000000,
      avgTradeValue: 1000000000,
      close: 1000,
      liquidityTier: { key: 'very-high' },
    },
  ],
  selectionRadar: {
    institutionalResonance: [{ code: '2330', name: '台積電' }],
  },
  generatedAt: '2026-09-03T00:00:00.000Z',
  marketDate: '2026-09-03',
};

function jsonResponse(value) {
  return new Response(JSON.stringify(value), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}

function htmlResponse(
  body = '<html><body><table id="CPHB1_bt1_g"></table><script>var jsonDatas = {}</script><div class="t4t1">主力進出</div><span>/forum/stock/2330?s=broker</span></body></html>',
  init = {},
) {
  return new Response(body, {
    status: init.status ?? 200,
    headers: init.headers,
  });
}

function createRuntime(fetchImpl, policy = {}) {
  let currentTime = Date.parse('2026-09-03T00:00:00.000Z');
  const sleeps = [];

  return {
    runtime: {
      fetch: fetchImpl,
      sleep: async (milliseconds) => {
        sleeps.push(milliseconds);
        currentTime += milliseconds;
        await Promise.resolve();
      },
      random: () => 0.5,
      clock: { now: () => currentTime },
      logger: { warn() {} },
      policy: {
        timeoutMs: 100,
        maxAttempts: 3,
        baseBackoffMs: 10,
        maxBackoffMs: 40,
        maxRetryAfterMs: 3000,
        histockMinIntervalMs: 10,
        histockJitterMs: 4,
        histockCircuitThreshold: 2,
        histockCircuitCooldownMs: 1000,
        ...policy,
      },
    },
    sleeps,
  };
}

test('serializes HiStock requests per host and honors Retry-After before retrying', async () => {
  let histockFetchCount = 0;
  let activeHistockFetches = 0;
  let maxActiveHistockFetches = 0;
  const histockUserAgents = new Set();

  const fetchImpl = async (url, options = {}) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) {
      return jsonResponse([]);
    }

    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      activeHistockFetches += 1;
      maxActiveHistockFetches = Math.max(maxActiveHistockFetches, activeHistockFetches);
      histockUserAgents.add(options.headers?.['user-agent']);
      await Promise.resolve();
      activeHistockFetches -= 1;

      if (histockFetchCount === 1) {
        return htmlResponse('rate limited', {
          status: 429,
          headers: { 'retry-after': '2' },
        });
      }

      return htmlResponse();
    }

    return htmlResponse();
  };
  const { runtime, sleeps } = createRuntime(fetchImpl);
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(maxActiveHistockFetches, 1);
  assert.equal(histockFetchCount, 13, '12 logical HiStock requests plus one retry');
  assert.equal(histockUserAgents.size, 1, 'the client keeps one stable identity');
  assert.ok(sleeps.includes(2000), 'Retry-After seconds are converted to milliseconds');
  assert.ok(sleeps.includes(12), 'subsequent requests include the configured interval and jitter');
  assert.deepEqual(
    {
      attempted: result.sourceHealth.histock.attempted,
      succeeded: result.sourceHealth.histock.succeeded,
      failed: result.sourceHealth.histock.failed,
      skipped: result.sourceHealth.histock.skipped,
    },
    { attempted: 12, succeeded: 12, failed: 0, skipped: 0 },
  );
  assert.equal(result.coverage.completeStockCount, 1);
  assert.equal(result.coverage.qualityGate.shouldReplaceExisting, true);
});

test('retries 408 and 5xx responses with exponential backoff', async () => {
  let histockFetchCount = 0;

  const fetchImpl = async (url) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) {
      return jsonResponse([]);
    }

    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      if (histockFetchCount === 1) return htmlResponse('timeout', { status: 408 });
      if (histockFetchCount === 2) return htmlResponse('upstream unavailable', { status: 503 });
    }

    return htmlResponse();
  };
  const { runtime, sleeps } = createRuntime(fetchImpl, { histockCircuitThreshold: 3 });
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 14, '12 logical requests plus two retries');
  assert.ok(sleeps.includes(10));
  assert.ok(sleeps.includes(20));
  assert.equal(result.sourceHealth.histock.succeeded, 12);
  assert.deepEqual(result.sourceHealth.histock.failureCodes, {});
});

test('aborts a timed-out source request and retries it', async () => {
  let histockFetchCount = 0;

  const fetchImpl = async (url, options = {}) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) {
      return jsonResponse([]);
    }

    if (href.includes('histock.tw')) {
      histockFetchCount += 1;

      if (histockFetchCount === 1) {
        return new Promise((resolve, reject) => {
          options.signal.addEventListener(
            'abort',
            () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })),
            { once: true },
          );
        });
      }
    }

    return htmlResponse();
  };
  const { runtime, sleeps } = createRuntime(fetchImpl, { timeoutMs: 5 });
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 13);
  assert.ok(sleeps.includes(10));
  assert.equal(result.sourceHealth.histock.succeeded, 12);
});

test('keeps the timeout active while reading a stalled response body', async () => {
  let histockFetchCount = 0;
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);
    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) return jsonResponse([]);
    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      if (histockFetchCount === 1) {
        return {
          ok: true,
          status: 200,
          headers: new Headers({ 'content-type': 'text/html' }),
          text: () => new Promise((resolve, reject) => {
            options.signal.addEventListener(
              'abort',
              () => reject(Object.assign(new Error('body read aborted'), { name: 'AbortError' })),
              { once: true },
            );
          }),
        };
      }
    }
    return htmlResponse();
  };
  const { runtime, sleeps } = createRuntime(fetchImpl, { timeoutMs: 5 });
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 13);
  assert.ok(sleeps.includes(10));
  assert.equal(result.sourceHealth.histock.succeeded, 12);
});

test('opens the HiStock circuit after consecutive 429s while Fubon and CMoney still run', async () => {
  let histockFetchCount = 0;
  let fubonFetchCount = 0;
  let cmoneyFetchCount = 0;

  const fetchImpl = async (url) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) {
      return jsonResponse([]);
    }

    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      return htmlResponse('rate limited', { status: 429 });
    }

    if (href.includes('fubon-ebrokerdj')) {
      fubonFetchCount += 1;
      return htmlResponse();
    }

    if (href.includes('cmoney.tw')) {
      cmoneyFetchCount += 1;
      return htmlResponse();
    }

    throw new Error(`Unexpected test URL: ${href}`);
  };
  const { runtime } = createRuntime(fetchImpl);
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 2, 'the open circuit prevents a 429 request storm');
  assert.equal(fubonFetchCount, 1);
  assert.equal(cmoneyFetchCount, 1);
  assert.deepEqual(result.sourceHealth.histock.failureCodes, {
    CIRCUIT_OPEN: 11,
    HTTP_429: 1,
  });
  assert.equal(result.sourceHealth.histock.attempted, 1);
  assert.equal(result.sourceHealth.histock.failed, 1);
  assert.equal(result.sourceHealth.histock.skipped, 11);
  assert.deepEqual(result.sourceHealth.histock.skippedStocks, [
    { code: '2330', name: '台積電', errorCode: 'CIRCUIT_OPEN' },
  ]);
  assert.equal(result.sourceHealth.fubon.succeeded, 1);
  assert.equal(result.sourceHealth.cmoney.succeeded, 1);
  assert.equal(result.coverage.succeededStockCount, 1);
  assert.equal(result.coverage.partialStockCount, 1);
  assert.equal(result.coverage.qualityGate.shouldReplaceExisting, false);
  assert.equal(result.coverage.qualityGate.recommendation, 'preserve-existing');
  assert.deepEqual(result.coverage.qualityGate.reasons, [
    'PRIMARY_SOURCE_COVERAGE_BELOW_THRESHOLD',
    'BRANCH_SOURCE_COVERAGE_BELOW_THRESHOLD',
  ]);
  assert.doesNotMatch(JSON.stringify(result.sourceHealth), /https?:\/\//);
});

test('opens the HiStock circuit immediately on a 403 block without suppressing fallback sources', async () => {
  let histockFetchCount = 0;
  let fubonFetchCount = 0;
  let cmoneyFetchCount = 0;

  const fetchImpl = async (url) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) {
      return jsonResponse([]);
    }

    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      return htmlResponse('forbidden', { status: 403 });
    }

    if (href.includes('fubon-ebrokerdj')) {
      fubonFetchCount += 1;
      return htmlResponse();
    }

    if (href.includes('cmoney.tw')) {
      cmoneyFetchCount += 1;
      return htmlResponse();
    }

    throw new Error(`Unexpected test URL: ${href}`);
  };
  const { runtime } = createRuntime(fetchImpl);
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 1);
  assert.equal(fubonFetchCount, 1);
  assert.equal(cmoneyFetchCount, 1);
  assert.deepEqual(result.sourceHealth.histock.failureCodes, {
    CIRCUIT_OPEN: 11,
    HTTP_403: 1,
  });
  assert.equal(result.coverage.sourceCounts.histock.skipped, 1);
  assert.equal(result.coverage.sourceCounts.fubon.succeeded, 1);
  assert.equal(result.coverage.sourceCounts.cmoney.succeeded, 1);
  assert.equal(result.coverage.qualityGate.shouldReplaceExisting, false);
});

test('treats an HTTP 200 Cloudflare challenge as BLOCK_PAGE and still runs fallback sources', async () => {
  let histockFetchCount = 0;
  let fubonFetchCount = 0;
  let cmoneyFetchCount = 0;

  const fetchImpl = async (url) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) {
      return jsonResponse([]);
    }

    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      return htmlResponse('<html><title>Just a moment...</title><div id="cf-chl-widget">Checking</div></html>');
    }

    if (href.includes('fubon-ebrokerdj')) {
      fubonFetchCount += 1;
      return htmlResponse();
    }

    if (href.includes('cmoney.tw')) {
      cmoneyFetchCount += 1;
      return htmlResponse();
    }

    throw new Error(`Unexpected test URL: ${href}`);
  };
  const { runtime } = createRuntime(fetchImpl);
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 1);
  assert.equal(fubonFetchCount, 1);
  assert.equal(cmoneyFetchCount, 1);
  assert.deepEqual(result.sourceHealth.histock.failureCodes, {
    BLOCK_PAGE: 1,
    CIRCUIT_OPEN: 11,
  });
  assert.equal(result.sourceHealth.histock.succeeded, 0);
  assert.equal(result.sourceHealth.histock.failed, 1);
  assert.equal(result.coverage.sourceCounts.histock.succeeded, 0);
  assert.equal(result.coverage.sourceCounts.fubon.succeeded, 1);
  assert.equal(result.coverage.sourceCounts.cmoney.succeeded, 1);
  assert.equal(result.coverage.qualityGate.shouldReplaceExisting, false);
});

test('does not count an unrecognized HTTP 200 page as source coverage', async () => {
  let histockFetchCount = 0;
  let fubonFetchCount = 0;
  let cmoneyFetchCount = 0;
  const fetchImpl = async (url) => {
    const href = String(url);
    if (href.includes('openapi.twse.com.tw') || href.includes('tpex.org.tw/openapi')) return jsonResponse([]);
    if (href.includes('histock.tw')) {
      histockFetchCount += 1;
      return htmlResponse('<html><head><title>Temporary page</title></head><body>maintenance</body></html>');
    }
    if (href.includes('fubon-ebrokerdj')) {
      fubonFetchCount += 1;
      return htmlResponse();
    }
    if (href.includes('cmoney.tw')) {
      cmoneyFetchCount += 1;
      return htmlResponse();
    }
    throw new Error(`Unexpected test URL: ${href}`);
  };
  const { runtime } = createRuntime(fetchImpl);
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(histockFetchCount, 1);
  assert.equal(fubonFetchCount, 1);
  assert.equal(cmoneyFetchCount, 1);
  assert.deepEqual(result.sourceHealth.histock.failureCodes, {
    CIRCUIT_OPEN: 11,
    UNEXPECTED_PAGE: 1,
  });
  assert.equal(result.coverage.qualityGate.shouldReplaceExisting, false);
});

test('bounds a stalled active-quote bootstrap request with timeout and retry', async () => {
  let twseFetchCount = 0;
  const fetchImpl = async (url, options = {}) => {
    const href = String(url);

    if (href.includes('openapi.twse.com.tw')) {
      twseFetchCount += 1;
      return new Promise((resolve, reject) => {
        options.signal?.addEventListener(
          'abort',
          () => reject(Object.assign(new Error('active quote request aborted'), { name: 'AbortError' })),
          { once: true },
        );
      });
    }

    if (href.includes('tpex.org.tw/openapi')) return jsonResponse([]);
    return htmlResponse();
  };
  const { runtime, sleeps } = createRuntime(fetchImpl, { timeoutMs: 5, maxAttempts: 2 });
  const result = await buildBrokerBranchRadar(INPUT, runtime);

  assert.equal(twseFetchCount, 2);
  assert.ok(sleeps.includes(10));
  assert.ok(result);
});
