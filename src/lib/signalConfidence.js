function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export const DEFAULT_SIGNAL_WEIGHTS = {
  'golden-cross': 0.66,
  'death-cross': 0.62,
  'macd-bullish-cross': 0.64,
  'macd-bearish-cross': 0.61,
  'rsi-overbought': 0.52,
  'rsi-oversold': 0.56,
  'kd-bullish': 0.58,
  'kd-bearish': 0.55,
  'break-above-long-ma': 0.6,
  'break-below-long-ma': 0.58,
  neutral: 0.42,
};

function computeConfidence(stat) {
  if (!stat || !Number.isFinite(stat.samples) || stat.samples < 12) {
    return null;
  }

  const winRate = toNumber(stat.winRate);
  const avgReturn20 = toNumber(stat.avgReturn20);
  if (winRate === null) return null;

  const winComponent = Math.max(0, Math.min(1, winRate / 100));
  const returnComponent = avgReturn20 === null ? 0.5 : Math.max(0, Math.min(1, (avgReturn20 + 10) / 20));

  return Math.max(0, Math.min(1, winComponent * 0.7 + returnComponent * 0.3));
}

export function getSignalConfidence(signalKey, confidenceData) {
  const key = String(signalKey ?? '').trim();
  if (!key) return 0.5;

  const stat = confidenceData?.signals?.[key];
  const dynamic = computeConfidence(stat);
  if (dynamic !== null) {
    return dynamic;
  }

  return DEFAULT_SIGNAL_WEIGHTS[key] ?? 0.5;
}

export function aggregateSignalConfidence(signals = [], confidenceData = null) {
  const perSignal = signals
    .map((signal) => {
      const key = signal?.key ?? signal?.name ?? signal?.id;
      const base = getSignalConfidence(key, confidenceData);
      const toneBonus = signal?.tone === 'up' ? 0.04 : signal?.tone === 'down' ? 0.02 : -0.04;
      const confidence = Math.max(0, Math.min(1, base + toneBonus));
      return {
        key,
        title: signal?.title ?? key,
        tone: signal?.tone ?? 'normal',
        confidence,
      };
    })
    .filter((item) => item.confidence > 0);

  if (!perSignal.length) {
    return { aggregate: 0, perSignal: [] };
  }

  const aggregate = 1 - perSignal.reduce((product, item) => product * (1 - item.confidence), 1);
  return {
    aggregate: Math.max(0, Math.min(1, aggregate)),
    perSignal,
  };
}

export function describeConfidence(confidence) {
  if (confidence === null || !Number.isFinite(confidence)) {
    return { label: '資料不足', tone: 'info' };
  }
  if (confidence >= 0.75) return { label: '可信度高', tone: 'up' };
  if (confidence >= 0.55) return { label: '可信度中', tone: 'normal' };
  if (confidence >= 0.35) return { label: '先觀察', tone: 'warning' };
  return { label: '雜訊偏高', tone: 'down' };
}
