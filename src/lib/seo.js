export const SITE_NAME = '台股主動通';
export const SITE_URL = normalizeSiteUrl(import.meta.env.VITE_SITE_URL ?? 'https://joe94113.github.io/TW_Active_Tracker/');
export const DEFAULT_DESCRIPTION =
  '台股主動通整合台股大盤即時節奏、熱門股排行、主動式 ETF 持股異動、法人籌碼、技術分析與個股研究路徑。';
export const DEFAULT_KEYWORDS = [
  '台股',
  '主動式ETF',
  'ETF持股異動',
  '熱門股',
  '技術分析',
  '法人籌碼',
  '支撐壓力',
  '投資研究',
];
export const DEFAULT_IMAGE = new URL('social-card.svg', SITE_URL).toString();
export const THEME_COLOR = '#0b699b';

function normalizeSiteUrl(value) {
  const text = String(value ?? '').trim();
  if (!text) return 'https://joe94113.github.io/TW_Active_Tracker/';
  return text.endsWith('/') ? text : `${text}/`;
}

function normalizeRoutePath(value) {
  const text = String(value ?? '').trim();
  if (!text || text === '/' || text === '#/' || text === '#') return '/';
  if (text.startsWith('#')) return text.slice(1) || '/';
  return text.startsWith('/') ? text : `/${text}`;
}

function resolveAbsoluteUrl(value, fallbackPath = '/') {
  const text = String(value ?? '').trim();
  if (!text) return buildPageUrl(fallbackPath);
  if (/^https?:\/\//i.test(text)) return text;
  if (text.startsWith('#')) return `${SITE_URL}${text}`;
  const clean = text.replace(/^\/+/, '');
  return new URL(clean, SITE_URL).toString();
}

export function buildPageUrl(routePath = '/') {
  const normalized = normalizeRoutePath(routePath);
  if (normalized === '/') return SITE_URL;
  return `${SITE_URL}#${normalized}`;
}

function ensureMeta(attribute, value) {
  const selector = `meta[${attribute.name}="${attribute.value}"]`;
  let element = document.head.querySelector(selector);

  if (!element) {
    element = document.createElement('meta');
    element.setAttribute(attribute.name, attribute.value);
    document.head.appendChild(element);
  }

  element.setAttribute('content', value);
  return element;
}

function ensureLink(rel, href) {
  let element = document.head.querySelector(`link[rel="${rel}"]`);

  if (!element) {
    element = document.createElement('link');
    element.setAttribute('rel', rel);
    document.head.appendChild(element);
  }

  element.setAttribute('href', href);
  return element;
}

function ensureJsonLd(id, value) {
  const scriptId = `seo-jsonld-${id}`;
  let element = document.getElementById(scriptId);

  if (!value) {
    element?.remove();
    return;
  }

  if (!element) {
    element = document.createElement('script');
    element.id = scriptId;
    element.type = 'application/ld+json';
    document.head.appendChild(element);
  }

  element.textContent = JSON.stringify(value);
}

function removeJsonLd(id) {
  document.getElementById(`seo-jsonld-${id}`)?.remove();
}

function buildDefaultStructuredData({ pageUrl, title, description }) {
  return [
    {
      '@context': 'https://schema.org',
      '@type': 'WebSite',
      name: SITE_NAME,
      url: SITE_URL,
      inLanguage: 'zh-Hant-TW',
      description: DEFAULT_DESCRIPTION,
    },
    {
      '@context': 'https://schema.org',
      '@type': 'WebPage',
      name: title,
      url: pageUrl,
      description,
      inLanguage: 'zh-Hant-TW',
      isPartOf: {
        '@type': 'WebSite',
        name: SITE_NAME,
        url: SITE_URL,
      },
    },
  ];
}

function normalizeTitle(value) {
  const text = String(value ?? '').trim();
  if (!text) return SITE_NAME;
  return text.includes(SITE_NAME) ? text : `${text} | ${SITE_NAME}`;
}

function normalizeKeywords(value) {
  if (Array.isArray(value)) {
    return value.filter(Boolean).join(', ');
  }
  return String(value ?? DEFAULT_KEYWORDS.join(', ')).trim();
}

export function createBreadcrumbJsonLd(items) {
  return {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: (items ?? []).map((item, index) => ({
      '@type': 'ListItem',
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}

export function applySeoMeta(config = {}) {
  if (typeof document === 'undefined') return;

  const title = normalizeTitle(config.title);
  const description = String(config.description ?? DEFAULT_DESCRIPTION).trim() || DEFAULT_DESCRIPTION;
  const keywords = normalizeKeywords(config.keywords ?? DEFAULT_KEYWORDS);
  const pageUrl = buildPageUrl(config.routePath ?? config.path ?? '/');
  const image = resolveAbsoluteUrl(config.image ?? DEFAULT_IMAGE, '/');
  const robots = config.noindex ? 'noindex,nofollow' : 'index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1';
  const type = config.type ?? 'website';
  const structuredData = buildDefaultStructuredData({ pageUrl, title, description });
  const extraJsonLd = Array.isArray(config.jsonLd) ? config.jsonLd : config.jsonLd ? [config.jsonLd] : [];

  document.documentElement.setAttribute('lang', 'zh-Hant-TW');
  document.title = title;

  ensureMeta({ name: 'name', value: 'description' }, description);
  ensureMeta({ name: 'name', value: 'keywords' }, keywords);
  ensureMeta({ name: 'name', value: 'robots' }, robots);
  ensureMeta({ name: 'name', value: 'author' }, SITE_NAME);
  ensureMeta({ name: 'name', value: 'application-name' }, SITE_NAME);
  ensureMeta({ name: 'name', value: 'apple-mobile-web-app-title' }, SITE_NAME);
  ensureMeta({ name: 'name', value: 'theme-color' }, THEME_COLOR);
  ensureMeta({ name: 'name', value: 'format-detection' }, 'telephone=no');
  ensureMeta({ name: 'property', value: 'og:locale' }, 'zh_TW');
  ensureMeta({ name: 'property', value: 'og:type' }, type);
  ensureMeta({ name: 'property', value: 'og:site_name' }, SITE_NAME);
  ensureMeta({ name: 'property', value: 'og:title' }, title);
  ensureMeta({ name: 'property', value: 'og:description' }, description);
  ensureMeta({ name: 'property', value: 'og:url' }, pageUrl);
  ensureMeta({ name: 'property', value: 'og:image' }, image);
  ensureMeta({ name: 'property', value: 'og:image:width' }, '1200');
  ensureMeta({ name: 'property', value: 'og:image:height' }, '630');
  ensureMeta({ name: 'name', value: 'twitter:card' }, 'summary_large_image');
  ensureMeta({ name: 'name', value: 'twitter:title' }, title);
  ensureMeta({ name: 'name', value: 'twitter:description' }, description);
  ensureMeta({ name: 'name', value: 'twitter:image' }, image);

  ensureLink('canonical', pageUrl);

  ensureJsonLd('default', structuredData);
  if (extraJsonLd.length) {
    ensureJsonLd('page', extraJsonLd);
  } else {
    removeJsonLd('page');
  }
}
