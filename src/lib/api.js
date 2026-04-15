const REMOTE_FETCH_ENABLED_HOSTS = new Set(['localhost', '127.0.0.1', '::1']);

export function canUseRemoteJsonFetch() {
  if (typeof window === 'undefined') {
    return true;
  }

  return REMOTE_FETCH_ENABLED_HOSTS.has(window.location.hostname);
}

export async function fetchJson(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const requestUrl = new URL(normalized, window.location.href);
  requestUrl.searchParams.set('ts', Date.now().toString());

  const response = await fetch(requestUrl, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`讀取資料失敗：${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchOptionalJson(path) {
  const normalized = path.startsWith('/') ? path.slice(1) : path;
  const requestUrl = new URL(normalized, window.location.href);
  requestUrl.searchParams.set('ts', Date.now().toString());

  const response = await fetch(requestUrl, {
    headers: {
      Accept: 'application/json',
    },
  });

  if (response.status === 404) {
    return null;
  }

  if (!response.ok) {
    throw new Error(`讀取資料失敗：${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchRemoteJson(url) {
  if (!canUseRemoteJsonFetch()) {
    throw new Error('目前站台環境無法直接存取跨網域即時 API，已改用站內整理資料。');
  }

  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`遠端資料請求失敗：${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const 讀取JSON = fetchJson;
export const 讀取可選JSON = fetchOptionalJson;
export const 讀取遠端JSON = fetchRemoteJson;
