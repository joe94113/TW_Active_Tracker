export async function 取得JSON(path) {
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

export async function 嘗試取得遠端JSON(url) {
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
