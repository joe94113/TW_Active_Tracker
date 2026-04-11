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
    throw new Error(`讀取失敗：${response.status} ${response.statusText}`);
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
    throw new Error(`讀取失敗：${response.status} ${response.statusText}`);
  }

  return response.json();
}

export async function fetchRemoteJson(url) {
  const response = await fetch(url, {
    headers: {
      Accept: 'application/json, text/plain, */*',
    },
  });

  if (!response.ok) {
    throw new Error(`遠端讀取失敗：${response.status} ${response.statusText}`);
  }

  return response.json();
}

export const 取得JSON = fetchJson;
export const 取得可選JSON = fetchOptionalJson;
export const 嘗試取得遠端JSON = fetchRemoteJson;
