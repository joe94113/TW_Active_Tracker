function normalizePath(value) {
  return String(value ?? '').replaceAll('\\', '/').replace(/^\/+/, '');
}

function getStatus(error) {
  return Number(error?.status ?? error?.cause?.status ?? 0);
}

function isServiceFailure(error) {
  const status = getStatus(error);
  return !status || status === 401 || status === 403 || status === 408 || status === 425 || status === 429 || status >= 500;
}

function errorMessage(error) {
  if (error instanceof Error) {
    const code = error?.cause?.code ?? error?.code;
    return code ? `${error.message} (${code})` : error.message;
  }
  return String(error);
}

export function createDeployedCacheReader({
  baseUrl,
  fetchRemoteJson,
  readLocalJson,
  warn = console.warn,
  defaultTimeoutMs = 20_000,
  defaultAttempts = 3,
}) {
  if (!baseUrl) throw new TypeError('baseUrl is required');
  if (typeof fetchRemoteJson !== 'function') throw new TypeError('fetchRemoteJson must be a function');
  if (typeof readLocalJson !== 'function') throw new TypeError('readLocalJson must be a function');

  return async function readDeployedOrLocalJson(
    relativePath,
    { remoteTimeoutMs = defaultTimeoutMs, remoteAttempts = defaultAttempts, remoteCircuit = null } = {},
  ) {
    const normalizedPath = normalizePath(relativePath);
    if (!normalizedPath) return null;

    if (!remoteCircuit?.open) {
      try {
        const result = await fetchRemoteJson(new URL(normalizedPath, baseUrl).toString(), {
          relativePath: normalizedPath,
          timeoutMs: remoteTimeoutMs,
          attempts: remoteAttempts,
        });
        if (remoteCircuit && !remoteCircuit.open) remoteCircuit.consecutiveFailures = 0;
        return result;
      } catch (error) {
        if (remoteCircuit && isServiceFailure(error)) {
          remoteCircuit.consecutiveFailures = (remoteCircuit.consecutiveFailures ?? 0) + 1;
          const threshold = Math.max(1, Number(remoteCircuit.failureThreshold) || 2);
          if (remoteCircuit.consecutiveFailures >= threshold) {
            remoteCircuit.open = true;
            if (!remoteCircuit.reported) {
              remoteCircuit.reported = true;
              warn(`[部署快取熔斷] ${errorMessage(error)}；其餘檔案改讀 checkout 快取`);
            }
          }
        }
      }
    }

    return readLocalJson(normalizedPath);
  };
}
