const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_ATTEMPTS = 3;
const MAX_RETRY_DELAY_MS = 60_000;

function createTimeoutSignal(timeoutMs, callerSignal) {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);

  if (!callerSignal) return timeoutSignal;
  if (typeof AbortSignal.any === 'function') {
    return AbortSignal.any([callerSignal, timeoutSignal]);
  }

  return callerSignal;
}

function compactPreview(value, limit = 180) {
  const text = String(value ?? '').replace(/\s+/g, ' ').trim();
  return text.length > limit ? `${text.slice(0, limit)}...` : text;
}

function looksLikeHtml(value) {
  return /^\s*(?:<!doctype\s+html|<html\b|<head\b|<body\b)/i.test(String(value ?? ''));
}

function parseRetryAfter(value, nowMs) {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  const seconds = Number(text);
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }

  const dateMs = Date.parse(text);
  return Number.isFinite(dateMs) ? Math.max(0, dateMs - nowMs) : 0;
}

function makeHttpError(response, nowMs) {
  const error = new Error(`HTTP ${response.status} ${response.statusText}`.trim());
  error.name = 'HttpRequestError';
  error.status = response.status;
  error.retryAfterMs = parseRetryAfter(response.headers?.get?.('retry-after'), nowMs);
  return error;
}

function makeInvalidPayloadError(reason, body, contentType) {
  const preview = compactPreview(body) || '<empty>';
  const typeNote = contentType ? `，Content-Type ${contentType}` : '';
  const error = new Error(`Invalid JSON payload (${reason}${typeNote})，preview: ${preview}`);
  error.name = 'InvalidPayloadError';
  error.code = 'INVALID_PAYLOAD';
  error.retryable = true;
  error.payloadPreview = preview;
  return error;
}

async function decodeJson(response) {
  const body = await response.text();
  const contentType = response.headers?.get?.('content-type') ?? '';

  if (!body.trim()) {
    throw makeInvalidPayloadError('empty body', body, contentType);
  }

  if (looksLikeHtml(body)) {
    throw makeInvalidPayloadError('HTML body', body, contentType);
  }

  try {
    return JSON.parse(body);
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'malformed JSON';
    throw makeInvalidPayloadError(reason, body, contentType);
  }
}

function defaultIsRetryable(error) {
  if (error?.retryable === true || error?.code === 'INVALID_PAYLOAD') return true;

  const status = Number(error?.status ?? error?.cause?.status ?? 0);
  if (status === 307 || status === 308 || status === 408 || status === 425 || status === 429 || status >= 500) return true;

  const code = String(error?.cause?.code ?? error?.code ?? '').toUpperCase();
  if (
    code === 'UND_ERR_CONNECT_TIMEOUT' ||
    code === 'UND_ERR_HEADERS_TIMEOUT' ||
    code === 'UND_ERR_BODY_TIMEOUT' ||
    code === 'ETIMEDOUT' ||
    code === 'ECONNRESET' ||
    code === 'EAI_AGAIN' ||
    code === 'ENOTFOUND'
  ) {
    return true;
  }

  const message = String(error?.message ?? '').toLowerCase();
  return message.includes('fetch failed') || message.includes('timeout') || message.includes('aborted');
}

/**
 * Creates one deep request interface: status handling, timeout, Retry-After,
 * jittered backoff, per-host scheduling, and JSON body validation all stay
 * behind this seam. Callers only configure the varying hostPolicies adapter.
 */
export function createResilientRequester({
  fetchImpl = globalThis.fetch,
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
  random = Math.random,
  now = Date.now,
  warn = console.warn,
  hostPolicies = {},
} = {}) {
  if (typeof fetchImpl !== 'function') {
    throw new TypeError('fetchImpl must be a function');
  }

  const hostGates = new Map();

  function getHostGate(url) {
    let hostname;
    try {
      hostname = new URL(url).hostname.toLowerCase();
    } catch {
      return null;
    }

    const policy = hostPolicies[hostname];
    if (!policy) return null;
    if (hostGates.has(hostname)) return hostGates.get(hostname);

    const concurrency = Math.max(1, Number(policy.concurrency) || 1);
    const minIntervalMs = Math.max(0, Number(policy.minIntervalMs) || 0);
    const intervalJitterMs = Math.max(0, Number(policy.jitterMs) || 0);
    const queue = [];
    let active = 0;
    let nextStartAt = 0;
    let waiting = false;

    const drain = () => {
      if (!queue.length || active >= concurrency || waiting) return;

      const waitMs = Math.max(0, nextStartAt - now());
      if (waitMs > 0) {
        waiting = true;
        sleep(waitMs).then(() => {
          waiting = false;
          drain();
        });
        return;
      }

      while (queue.length && active < concurrency && nextStartAt <= now()) {
        const resolve = queue.shift();
        active += 1;
        nextStartAt = now() + minIntervalMs + Math.floor(Math.max(0, Number(random()) || 0) * intervalJitterMs);
        let released = false;
        resolve(() => {
          if (released) return;
          released = true;
          active -= 1;
          drain();
        });

        if (nextStartAt > now()) {
          drain();
          break;
        }
      }
    };

    const gate = () => new Promise((resolve) => {
      queue.push(resolve);
      drain();
    });
    hostGates.set(hostname, gate);
    return gate;
  }

  return async function request({
    url,
    options = {},
    label = url,
    timeoutMs = DEFAULT_TIMEOUT_MS,
    attempts = DEFAULT_ATTEMPTS,
    responseType = 'response',
    isRetryable = defaultIsRetryable,
    acceptResponse = (response) => response.ok,
  }) {
    let lastError = null;
    const attemptCount = Math.max(1, Number(attempts) || DEFAULT_ATTEMPTS);

    for (let attempt = 1; attempt <= attemptCount; attempt += 1) {
      let releaseHost = null;
      try {
        const hostGate = getHostGate(url);
        releaseHost = hostGate ? await hostGate() : null;
        const response = await fetchImpl(url, {
          ...options,
          signal: createTimeoutSignal(timeoutMs, options.signal),
        });

        if (!acceptResponse(response)) {
          throw makeHttpError(response, now());
        }

        if (responseType === 'json' || responseType === 'json-with-response') {
          const data = await decodeJson(response);
          return responseType === 'json-with-response' ? { data, response } : data;
        }

        if (responseType === 'text') {
          return await response.text();
        }

        if (responseType === 'array-buffer') {
          return await response.arrayBuffer();
        }

        return response;
      } catch (error) {
        releaseHost?.();
        releaseHost = null;
        lastError = error;

        if (attempt >= attemptCount || !isRetryable(error)) {
          throw error;
        }

        const exponentialMs = Math.min(1200 * 2 ** (attempt - 1), 5000);
        const retryAfterMs = Math.max(0, Number(error?.retryAfterMs) || 0);
        const jitterMs = Math.floor(Math.max(0, Number(random()) || 0) * 400);
        const waitMs = Math.min(Math.max(exponentialMs, retryAfterMs), MAX_RETRY_DELAY_MS) + jitterMs;
        warn(`[請求重試 ${attempt}/${attemptCount - 1}] ${label}：${error instanceof Error ? error.message : String(error)}，${waitMs}ms 後重試`);
        await sleep(waitMs);
      } finally {
        releaseHost?.();
      }
    }

    throw lastError ?? new Error(`無法完成請求：${label}`);
  };
}
