const FACTOR_COUNT = 7;

const CURRENCY_RULES = [
  {
    code: 'JPY',
    key: 'jpy',
    label: '日圓',
    weight: 0.75,
    fullScale: 0.75,
    bullishReason: '日圓升值，亞洲資金壓力稍緩，先當輔助訊號。',
    bearishReason: '日圓走弱，留意日本政策與亞洲資金波動。',
  },
  {
    code: 'KRW',
    key: 'krw',
    label: '韓元',
    weight: 1.25,
    fullScale: 0.6,
    bullishReason: '韓元升值，通常有利亞洲科技股氣氛。',
    bearishReason: '韓元貶值，亞洲科技股承受的美元壓力升高。',
  },
  {
    code: 'CNY',
    key: 'cny',
    label: '人民幣',
    weight: 1,
    fullScale: 0.35,
    bullishReason: '人民幣升值，區域資金氣氛相對穩定。',
    bearishReason: '人民幣貶值，區域資金風險偏好容易降溫。',
  },
  {
    code: 'TWD',
    key: 'twd',
    label: '台幣',
    weight: 1.5,
    fullScale: 0.35,
    bullishReason: '台幣升值，外資匯入與台股資金氣氛較有利。',
    bearishReason: '台幣貶值，外資匯出與台股資金壓力升高。',
  },
];

export function buildTaiwanMarketBias({
  currencies = [],
  foreignFlow = null,
  nasdaq = null,
  treasury10Year = null,
} = {}) {
  const currencyMap = new Map(currencies.map((item) => [item.code, item]));
  const currencyFactors = CURRENCY_RULES.map((rule) => {
    const item = currencyMap.get(rule.code) ?? {};
    const rawValue = toNumber(item.changePercent);
    const score = scaleSignal(rawValue, {
      deadZone: 0.03,
      fullScale: rule.fullScale,
      invert: true,
    });

    return makeFactor({
      ...rule,
      kind: 'currency',
      rawValue,
      marketDate: item.marketDate ?? null,
      score,
      reason: currencyReason(rule, rawValue),
    });
  });

  const foreignValue = toNumber(foreignFlow?.外資買賣超);
  const foreignScore = scaleSignal(foreignValue, {
    deadZone: 3_000_000,
    fullScale: 100_000_000,
  });
  const foreignFactor = makeFactor({
    key: 'foreign',
    label: '外資',
    kind: 'foreign',
    weight: 2,
    rawValue: foreignValue,
    marketDate: foreignFlow?.日期 ?? null,
    score: foreignScore,
    reason: valueReason(
      foreignValue,
      3_000_000,
      '外資買超，台股資金面得到支持。',
      '外資賣超，台股資金面承受壓力。',
      '外資買賣不大，資金面暫時沒有明顯方向。',
    ),
  });

  const nasdaqValue = toNumber(nasdaq?.changePercent);
  const nasdaqScore = scaleSignal(nasdaqValue, {
    deadZone: 0.1,
    fullScale: 2,
  });
  const nasdaqFactor = makeFactor({
    key: 'nasdaq',
    label: 'NASDAQ',
    kind: 'percent',
    weight: 1.5,
    rawValue: nasdaqValue,
    marketDate: nasdaq?.marketDate ?? null,
    score: nasdaqScore,
    reason: valueReason(
      nasdaqValue,
      0.1,
      'NASDAQ 上漲，電子權值股的海外氣氛較有利。',
      'NASDAQ 下跌，電子權值股的海外氣氛轉弱。',
      'NASDAQ 變動不大，暫時沒有明顯方向。',
    ),
  });

  const yieldValue = getBasisPointChange(treasury10Year);
  const yieldScore = scaleSignal(yieldValue, {
    deadZone: 1,
    fullScale: 12,
    invert: true,
  });
  const yieldFactor = makeFactor({
    key: 'yield',
    label: '美債 10Y',
    kind: 'basisPoints',
    weight: 1.25,
    rawValue: yieldValue,
    marketDate: treasury10Year?.marketDate ?? null,
    score: yieldScore,
    reason: valueReason(
      yieldValue,
      1,
      '美債殖利率上升，成長股與電子股評價壓力增加。',
      '美債殖利率下降，成長股與電子股壓力減輕。',
      '美債殖利率變動不大，利率壓力暫時中性。',
      true,
    ),
  });

  const factors = [foreignFactor, ...currencyFactors, nasdaqFactor, yieldFactor];
  const totalWeight = factors.reduce((total, factor) => total + factor.weight, 0);
  const availableFactors = factors.filter((factor) => factor.score !== null);
  const availableWeight = availableFactors.reduce((total, factor) => total + factor.weight, 0);
  const coverage = totalWeight ? availableWeight / totalWeight : 0;
  const weightedTotal = availableFactors.reduce(
    (total, factor) => total + factor.score * factor.weight,
    0,
  );
  const score = availableWeight ? Math.round((weightedTotal / availableWeight) * 100) : 0;
  const directionalFactors = availableFactors.filter((factor) => factor.direction !== 'neutral');
  const bullishWeight = directionalFactors
    .filter((factor) => factor.direction === 'bullish')
    .reduce((total, factor) => total + Math.abs(factor.contribution), 0);
  const bearishWeight = directionalFactors
    .filter((factor) => factor.direction === 'bearish')
    .reduce((total, factor) => total + Math.abs(factor.contribution), 0);
  const directionalWeight = bullishWeight + bearishWeight;
  const agreement = directionalWeight
    ? Math.max(bullishWeight, bearishWeight) / directionalWeight
    : 0.5;
  const isEnough = coverage >= 0.55 && availableFactors.length >= 4;
  const verdict = getVerdict(score, isEnough);

  return {
    ...verdict,
    score,
    meterPosition: Math.max(0, Math.min(100, (score + 100) / 2)),
    factors,
    availableCount: availableFactors.length,
    totalCount: FACTOR_COUNT,
    coverage,
    confidence: getConfidence({ coverage, agreement, isEnough }),
    summary: getSummary(factors, isEnough),
    fxMood: getCurrencyMood(currencyFactors),
  };
}

export function scaleSignal(value, {
  deadZone = 0,
  fullScale = 1,
  invert = false,
} = {}) {
  const number = toNumber(value);
  if (number === null) return null;

  const absolute = Math.abs(number);
  if (absolute <= deadZone) return 0;

  const usableRange = Math.max(fullScale - deadZone, Number.EPSILON);
  const magnitude = Math.min(1, (absolute - deadZone) / usableRange);
  const direction = Math.sign(number) * (invert ? -1 : 1);
  return direction * magnitude;
}

function makeFactor({ score, ...factor }) {
  const direction = getDirection(score);
  return {
    ...factor,
    score,
    direction,
    contribution: score === null ? 0 : score * factor.weight,
    impact: factor.weight >= 1.5 ? '主要' : factor.weight >= 1.2 ? '重要' : '輔助',
  };
}

function getDirection(score) {
  if (score === null) return 'missing';
  if (score > 0.08) return 'bullish';
  if (score < -0.08) return 'bearish';
  return 'neutral';
}

function getVerdict(score, isEnough) {
  if (!isEnough) {
    return { label: '暫不判斷', state: 'insufficient' };
  }
  if (score >= 35) return { label: '偏多', state: 'bullish' };
  if (score >= 12) return { label: '稍偏多', state: 'bullish' };
  if (score > -12) return { label: '多空拉鋸', state: 'neutral' };
  if (score > -35) return { label: '稍偏空', state: 'bearish' };
  return { label: '偏空', state: 'bearish' };
}

function getConfidence({ coverage, agreement, isEnough }) {
  if (!isEnough) return '不足';
  if (coverage >= 0.85 && agreement >= 0.68) return '較明確';
  if (coverage >= 0.65 && agreement >= 0.56) return '普通';
  return '偏低';
}

function getSummary(factors, isEnough) {
  if (!isEnough) return '目前參考資料還沒到齊，為避免誤判，先不給多空方向。';

  const positive = strongestFactor(factors, 'bullish');
  const negative = strongestFactor(factors, 'bearish');

  if (positive && negative) {
    return `${positive.label}帶來支撐，但${negative.label}仍形成壓力。`;
  }
  if (positive) return `${positive.label}是目前最主要的偏多支撐。`;
  if (negative) return `${negative.label}是目前最主要的偏空壓力。`;
  return '各項變動都不大，盤勢暫時沒有明顯方向。';
}

function strongestFactor(factors, direction) {
  return factors
    .filter((factor) => factor.direction === direction)
    .sort((left, right) => Math.abs(right.contribution) - Math.abs(left.contribution))[0] ?? null;
}

function getCurrencyMood(factors) {
  const available = factors.filter((factor) => factor.score !== null);
  if (available.length < 3) return '資料不足';

  const directional = available.filter((factor) => factor.direction !== 'neutral');
  if (!directional.length) return '變動不大';
  if (directional.every((factor) => factor.direction === 'bullish')) return '同向偏多';
  if (directional.every((factor) => factor.direction === 'bearish')) return '同向偏空';
  return '走勢分歧';
}

function currencyReason(rule, value) {
  const number = toNumber(value);
  if (number === null) return '尚未取得最新資料。';
  if (Math.abs(number) <= 0.03) return `${rule.label}變動不大，暫時沒有明顯影響。`;
  return number < 0 ? rule.bullishReason : rule.bearishReason;
}

function valueReason(value, deadZone, positive, negative, neutral, invert = false) {
  const number = toNumber(value);
  if (number === null) return '尚未取得最新資料。';
  if (Math.abs(number) <= deadZone) return neutral;
  const isPositive = invert ? number < 0 : number > 0;
  return isPositive ? positive : negative;
}

function getBasisPointChange(item) {
  const directValue = toNumber(item?.changeBasisPoints);
  if (directValue !== null) return directValue;

  const change = toNumber(item?.change);
  return change === null ? null : change * 100;
}

function toNumber(value) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
