import { createSiteDataClient } from './lib/site-data.mjs';
import {
  buildBranchFlex,
  buildClassroomFlex,
  buildEntryFlex,
  buildEtfFlex,
  buildGlobalFlex,
  buildHumorFallbackMessages,
  buildInstitutionalFocusFlex,
  buildMarketFlex,
  buildStockFlex,
  buildThemeFlex,
  buildWelcomeFlex,
} from './lib/flex-messages.mjs';

const encoder = new TextEncoder();
const DEFAULT_SITE_URL = 'https://joe94113.github.io/TW_Active_Tracker';
const WEBHOOK_VERSION = '2026-05-06-line-keyword-pro-3';

function jsonResponse(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      'content-type': 'application/json; charset=utf-8',
    },
  });
}

function normalizeKeyword(text) {
  return String(text ?? '')
    .trim()
    .replace(/\s+/g, '')
    .toLowerCase();
}

function parseKeywordRoute(rawText) {
  const text = String(rawText ?? '').trim();
  const normalized = normalizeKeyword(text);

  if (!normalized) {
    return { type: 'help', query: text };
  }

  if (/^\d{4}$/.test(text)) {
    return { type: 'stock', query: text };
  }

  if (
    normalized.includes('雙法人連買') ||
    normalized.includes('雙法人同買') ||
    normalized.includes('雙法人') ||
    normalized.includes('法人同買')
  ) {
    return { type: 'institutional-dual', query: text };
  }

  if (
    normalized.includes('外資買超') ||
    normalized.includes('外資連買') ||
    normalized === '外資' ||
    normalized.includes('外資')
  ) {
    return { type: 'institutional-foreign', query: text };
  }

  if (
    normalized.includes('投信買超') ||
    normalized.includes('投信連買') ||
    normalized === '投信' ||
    normalized.includes('投信')
  ) {
    return { type: 'institutional-trust', query: text };
  }

  const keywordMap = [
    { type: 'market', match: ['盤勢', '大盤', '明日盤勢', '市場'] },
    { type: 'stock-radar', match: ['選股', '選股雷達', '雷達'] },
    { type: 'entry', match: ['起漲', '起漲卡位', '卡位', '剛起'] },
    { type: 'theme', match: ['題材', '資金題材', '題材雷達', '熱度'] },
    { type: 'etf', match: ['etf', '主動式etf', '高股息etf', 'etf研究'] },
    { type: 'classroom', match: ['教學', '股票小教室', '小教室', '新手'] },
    { type: 'branch', match: ['分點', '券商分點', '分點雷達', '主力'] },
    { type: 'global', match: ['國際盤', '國際', '原物料', '外匯', '美股'] },
    { type: 'help', match: ['help', 'menu', '功能', '選單', '幫助'] },
  ];

  for (const entry of keywordMap) {
    if (entry.match.some((keyword) => normalized.includes(keyword.toLowerCase()))) {
      return { type: entry.type, query: text };
    }
  }

  return { type: 'stock', query: text };
}

async function verifySignature(body, signature, channelSecret) {
  if (!signature || !channelSecret) {
    return false;
  }

  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(channelSecret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const digest = await crypto.subtle.sign('HMAC', key, encoder.encode(body));
  const expected = btoa(String.fromCharCode(...new Uint8Array(digest)));
  return signature === expected;
}

async function replyMessage(replyToken, messages, env) {
  if (!replyToken || !messages?.length) {
    return;
  }

  const response = await fetch('https://api.line.me/v2/bot/message/reply', {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      authorization: `Bearer ${env.LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      replyToken,
      messages,
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`LINE reply failed: ${response.status} ${errorText}`);
  }
}

async function buildReplyForKeyword(route, client) {
  const siteUrl = client.baseUrl;

  switch (route.type) {
    case 'market': {
      const dashboard = await client.getDashboard();
      return [buildMarketFlex({ dashboard, siteUrl })];
    }
    case 'theme': {
      const topicIndex = await client.getTopicIndex();
      return [buildThemeFlex({ topicIndex, siteUrl })];
    }
    case 'entry': {
      const entryRadar = await client.getEntryRadar();
      return [buildEntryFlex({ entryRadar, siteUrl })];
    }
    case 'etf': {
      const [manifest, highDividendFlow] = await Promise.all([client.getManifest(), client.getHighDividendFlow()]);
      return [buildEtfFlex({ manifest, highDividendFlow, siteUrl })];
    }
    case 'classroom': {
      return [buildClassroomFlex({ siteUrl })];
    }
    case 'branch': {
      const brokerRadar = await client.getBrokerRadar();
      return [buildBranchFlex({ brokerRadar, siteUrl })];
    }
    case 'global': {
      const globalMarkets = await client.getGlobalMarkets();
      return [buildGlobalFlex({ globalMarkets, siteUrl })];
    }
    case 'stock-radar': {
      const [entryRadar, topicIndex] = await Promise.all([client.getEntryRadar(), client.getTopicIndex()]);
      return [buildEntryFlex({ entryRadar, siteUrl }), buildThemeFlex({ topicIndex, siteUrl })];
    }
    case 'institutional-dual': {
      const dashboard = await client.getDashboard();
      return [buildInstitutionalFocusFlex({ dashboard, siteUrl, mode: 'dual' })];
    }
    case 'institutional-foreign': {
      const dashboard = await client.getDashboard();
      return [buildInstitutionalFocusFlex({ dashboard, siteUrl, mode: 'foreign' })];
    }
    case 'institutional-trust': {
      const dashboard = await client.getDashboard();
      return [buildInstitutionalFocusFlex({ dashboard, siteUrl, mode: 'trust' })];
    }
    case 'stock': {
      let stock = await client.findStock(route.query);
      let detail = stock ? await client.getStockDetail(stock.code) : null;
      const hydrateStockName = (candidate, detailData) => {
        if (!candidate) return candidate;
        const companyProfile = detailData?.['公司概況'] ?? detailData?.companyProfile ?? null;
        const displayName =
          candidate.name ??
          candidate.名稱 ??
          companyProfile?.公司簡稱 ??
          companyProfile?.公司名稱 ??
          detailData?.name ??
          candidate.code ??
          route.query;
        const industryName = candidate.industryName ?? companyProfile?.產業名稱 ?? null;
        return {
          ...candidate,
          name: displayName,
          industryName,
        };
      };

      if (stock && detail) {
        stock = hydrateStockName(stock, detail);
      }

      if (!stock && /^\d{4}$/.test(route.query)) {
        detail = await client.getStockDetail(route.query);
        if (detail) {
          stock = hydrateStockName(
            {
            code: route.query,
            },
            detail,
          );
        }
      }

      if (!stock) {
        return buildHumorFallbackMessages({ siteUrl, kind: 'unknown' });
      }

      return [buildStockFlex({ stock, detail, siteUrl })];
    }
    case 'help':
    default:
      return [buildWelcomeFlex(siteUrl)];
  }
}

async function handleEvent(event, env, client) {
  if (event.type === 'follow') {
    await replyMessage(event.replyToken, [buildWelcomeFlex(client.baseUrl)], env);
    return;
  }

  if (event.type !== 'message') {
    return;
  }

  if (event.message?.type !== 'text') {
    const messages = buildHumorFallbackMessages({ siteUrl: client.baseUrl, kind: 'non-text' });
    await replyMessage(event.replyToken, messages.slice(0, 5), env);
    return;
  }

  const route = parseKeywordRoute(event.message.text);
  const messages = await buildReplyForKeyword(route, client);
  await replyMessage(event.replyToken, messages.slice(0, 5), env);
}

export default {
  async fetch(request, env) {
    const siteUrl = env.SITE_URL || DEFAULT_SITE_URL;
    const client = createSiteDataClient(siteUrl);

    try {
      if (request.method === 'GET') {
        return jsonResponse({
          ok: true,
          name: 'tw-active-tracker-line-webhook',
          siteUrl: client.baseUrl,
          version: WEBHOOK_VERSION,
        });
      }

      if (request.method !== 'POST') {
        return jsonResponse({ error: 'method_not_allowed' }, 405);
      }

      if (!env.LINE_CHANNEL_ACCESS_TOKEN || !env.LINE_CHANNEL_SECRET) {
        return jsonResponse({ error: 'missing_line_env' }, 500);
      }

      const signature = request.headers.get('x-line-signature');
      if (!signature) {
        return jsonResponse({ error: 'missing_signature', version: WEBHOOK_VERSION }, 401);
      }

      const body = await request.text();
      const verified = await verifySignature(body, signature, env.LINE_CHANNEL_SECRET);

      if (!verified) {
        return jsonResponse({ error: 'invalid_signature', version: WEBHOOK_VERSION }, 401);
      }

      let payload;
      try {
        payload = JSON.parse(body || '{}');
      } catch {
        return jsonResponse({ error: 'invalid_json' }, 400);
      }

      for (const event of payload.events ?? []) {
        try {
          await handleEvent(event, env, client);
        } catch (error) {
          console.error('handle_event_failed', {
            type: event?.type,
            messageType: event?.message?.type,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      return jsonResponse({
        ok: true,
        version: WEBHOOK_VERSION,
        eventCount: Array.isArray(payload.events) ? payload.events.length : 0,
      });
    } catch (error) {
      console.error('webhook_internal_error', {
        error: error instanceof Error ? error.message : String(error),
      });
      return jsonResponse(
        {
          error: 'webhook_internal_error',
          detail: error instanceof Error ? error.message : String(error),
          version: WEBHOOK_VERSION,
        },
        500,
      );
    }
  },
};
