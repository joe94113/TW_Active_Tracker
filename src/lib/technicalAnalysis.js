const DEFAULT_SETTINGS = {
  maFastPeriod: 5,
  maShortPeriod: 10,
  maMediumPeriod: 20,
  maLongPeriod: 60,
  rsiPeriod: 14,
  stochasticPeriod: 9,
  stochasticKPeriod: 3,
  stochasticDPeriod: 3,
  macdFastPeriod: 12,
  macdSlowPeriod: 26,
  macdSignalPeriod: 9,
};

function clampInteger(value, min, max, fallback) {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isFinite(parsed)) {
    return fallback;
  }

  return Math.min(Math.max(parsed, min), max);
}

export function sanitizeIndicatorSettings(input = {}) {
  const settings = {
    ...DEFAULT_SETTINGS,
    ...input,
  };

  const sanitized = {
    maFastPeriod: clampInteger(settings.maFastPeriod, 2, 90, DEFAULT_SETTINGS.maFastPeriod),
    maShortPeriod: clampInteger(settings.maShortPeriod, 3, 120, DEFAULT_SETTINGS.maShortPeriod),
    maMediumPeriod: clampInteger(settings.maMediumPeriod, 5, 180, DEFAULT_SETTINGS.maMediumPeriod),
    maLongPeriod: clampInteger(settings.maLongPeriod, 10, 240, DEFAULT_SETTINGS.maLongPeriod),
    rsiPeriod: clampInteger(settings.rsiPeriod, 2, 60, DEFAULT_SETTINGS.rsiPeriod),
    stochasticPeriod: clampInteger(settings.stochasticPeriod, 3, 30, DEFAULT_SETTINGS.stochasticPeriod),
    stochasticKPeriod: clampInteger(settings.stochasticKPeriod, 1, 10, DEFAULT_SETTINGS.stochasticKPeriod),
    stochasticDPeriod: clampInteger(settings.stochasticDPeriod, 1, 10, DEFAULT_SETTINGS.stochasticDPeriod),
    macdFastPeriod: clampInteger(settings.macdFastPeriod, 2, 50, DEFAULT_SETTINGS.macdFastPeriod),
    macdSlowPeriod: clampInteger(settings.macdSlowPeriod, 3, 100, DEFAULT_SETTINGS.macdSlowPeriod),
    macdSignalPeriod: clampInteger(settings.macdSignalPeriod, 2, 30, DEFAULT_SETTINGS.macdSignalPeriod),
  };

  if (sanitized.maFastPeriod >= sanitized.maShortPeriod) {
    sanitized.maShortPeriod = Math.min(sanitized.maFastPeriod + 5, 120);
  }

  if (sanitized.maShortPeriod >= sanitized.maMediumPeriod) {
    sanitized.maMediumPeriod = Math.min(sanitized.maShortPeriod + 10, 180);
  }

  if (sanitized.maMediumPeriod >= sanitized.maLongPeriod) {
    sanitized.maLongPeriod = Math.min(sanitized.maMediumPeriod + 20, 240);
  }

  if (sanitized.macdFastPeriod >= sanitized.macdSlowPeriod) {
    sanitized.macdSlowPeriod = Math.min(sanitized.macdFastPeriod + 8, 100);
  }

  return sanitized;
}

function normalizeSeriesValue(value, positiveOnly = false) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (positiveOnly && parsed <= 0) {
    return null;
  }

  return parsed;
}

function calculateSimpleMovingAverage(rows, index, period) {
  if (index + 1 < period) {
    return null;
  }

  const window = rows.slice(index - period + 1, index + 1);
  const values = window.map((row) => normalizeSeriesValue(row.close, true)).filter((value) => value !== null);

  if (values.length !== period) {
    return null;
  }

  return values.reduce((total, value) => total + value, 0) / period;
}

function createEmaState(period) {
  const multiplier = 2 / (period + 1);
  let emaValue = null;

  return (price) => {
    if (price === null) {
      return emaValue;
    }

    emaValue = emaValue === null ? price : emaValue + (price - emaValue) * multiplier;
    return emaValue;
  };
}

export function calculateWindowReturn(rows, period) {
  const latest = rows.at(-1);
  const base = rows.at(-(period + 1));
  const latestClose = normalizeSeriesValue(latest?.close, true);
  const baseClose = normalizeSeriesValue(base?.close, true);

  if (latestClose === null || baseClose === null) {
    return null;
  }

  return ((latestClose - baseClose) / baseClose) * 100;
}

export function buildIndicatorRows(rows, inputSettings = {}) {
  const settings = sanitizeIndicatorSettings(inputSettings);
  const result = [];
  const gains = [];
  const losses = [];
  let averageGain = null;
  let averageLoss = null;
  let kValue = 50;
  let dValue = 50;

  const fastEma = createEmaState(settings.macdFastPeriod);
  const slowEma = createEmaState(settings.macdSlowPeriod);
  const signalEma = createEmaState(settings.macdSignalPeriod);

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const close = normalizeSeriesValue(row.close, true);
    const previousClose = normalizeSeriesValue(rows[index - 1]?.close, true);
    const change = close !== null && previousClose !== null ? close - previousClose : 0;
    const gain = Math.max(change, 0);
    const loss = Math.max(-change, 0);

    gains.push(gain);
    losses.push(loss);

    if (index === settings.rsiPeriod) {
      averageGain = gains.slice(1, settings.rsiPeriod + 1).reduce((total, value) => total + value, 0) / settings.rsiPeriod;
      averageLoss = losses.slice(1, settings.rsiPeriod + 1).reduce((total, value) => total + value, 0) / settings.rsiPeriod;
    } else if (index > settings.rsiPeriod) {
      averageGain = ((averageGain ?? 0) * (settings.rsiPeriod - 1) + gain) / settings.rsiPeriod;
      averageLoss = ((averageLoss ?? 0) * (settings.rsiPeriod - 1) + loss) / settings.rsiPeriod;
    }

    const rsi =
      averageGain === null || averageLoss === null
        ? null
        : averageLoss === 0
          ? 100
          : 100 - 100 / (1 + averageGain / averageLoss);

    if (index + 1 >= settings.stochasticPeriod) {
      const recent = rows.slice(index - settings.stochasticPeriod + 1, index + 1);
      const highValues = recent.map((item) => normalizeSeriesValue(item.high, true) ?? normalizeSeriesValue(item.close, true) ?? 0);
      const lowValues = recent.map((item) => normalizeSeriesValue(item.low, true) ?? normalizeSeriesValue(item.close, true) ?? 0);
      const highest = Math.max(...highValues);
      const lowest = Math.min(...lowValues);
      const rsv = highest === lowest || close === null ? 50 : ((close - lowest) / (highest - lowest)) * 100;
      kValue = ((settings.stochasticKPeriod - 1) * kValue + rsv) / settings.stochasticKPeriod;
      dValue = ((settings.stochasticDPeriod - 1) * dValue + kValue) / settings.stochasticDPeriod;
    }

    const macdLine = close === null ? null : (fastEma(close) ?? 0) - (slowEma(close) ?? 0);
    const macdSignal = macdLine === null ? null : signalEma(macdLine);
    const macdHistogram = macdLine !== null && macdSignal !== null ? macdLine - macdSignal : null;

    result.push({
      ...row,
      maFast: calculateSimpleMovingAverage(rows, index, settings.maFastPeriod),
      maShort: calculateSimpleMovingAverage(rows, index, settings.maShortPeriod),
      maMedium: calculateSimpleMovingAverage(rows, index, settings.maMediumPeriod),
      maLong: calculateSimpleMovingAverage(rows, index, settings.maLongPeriod),
      rsi,
      stochasticK: index + 1 >= settings.stochasticPeriod ? kValue : null,
      stochasticD: index + 1 >= settings.stochasticPeriod ? dValue : null,
      macd: macdLine,
      macdSignal,
      macdHist: macdHistogram,
    });
  }

  return result;
}

function detectCross(previousLeft, previousRight, currentLeft, currentRight) {
  if (
    previousLeft === null ||
    previousRight === null ||
    currentLeft === null ||
    currentRight === null
  ) {
    return null;
  }

  if (previousLeft <= previousRight && currentLeft > currentRight) {
    return 'bullish';
  }

  if (previousLeft >= previousRight && currentLeft < currentRight) {
    return 'bearish';
  }

  return null;
}

export function buildTechnicalSignalSummary(rows, inputSettings = {}, options = {}) {
  const settings = sanitizeIndicatorSettings(inputSettings);
  const enrichedRows = rows.length && 'maShort' in rows[0] ? rows : buildIndicatorRows(rows, settings);
  const latest = enrichedRows.at(-1) ?? null;
  const previous = enrichedRows.at(-2) ?? null;
  const signals = [];
  const labelPrefix = options.name ? `${options.name} ` : '';

  if (!latest) {
    return signals;
  }

  const movingAverageCross = detectCross(previous?.maFast ?? null, previous?.maMedium ?? null, latest.maFast ?? null, latest.maMedium ?? null);
  if (movingAverageCross === 'bullish') {
    signals.push({
      key: 'golden-cross',
      title: '黃金交叉',
      tone: 'up',
      importance: 3,
      description: `${labelPrefix}快線均線向上突破中期均線，短線趨勢有轉強訊號。`,
    });
  } else if (movingAverageCross === 'bearish') {
    signals.push({
      key: 'death-cross',
      title: '死亡交叉',
      tone: 'down',
      importance: 3,
      description: `${labelPrefix}快線均線跌破中期均線，短線節奏轉弱要特別留意。`,
    });
  }

  const macdCross = detectCross(previous?.macd ?? null, previous?.macdSignal ?? null, latest.macd ?? null, latest.macdSignal ?? null);
  if (macdCross === 'bullish') {
    signals.push({
      key: 'macd-bullish-cross',
      title: 'MACD 翻正',
      tone: 'up',
      importance: 3,
      description: `${labelPrefix}MACD 線上穿訊號線，短線動能重新偏多。`,
    });
  } else if (macdCross === 'bearish') {
    signals.push({
      key: 'macd-bearish-cross',
      title: 'MACD 轉弱',
      tone: 'down',
      importance: 3,
      description: `${labelPrefix}MACD 線跌破訊號線，短線修正壓力升高。`,
    });
  }

  if ((latest.rsi ?? 50) >= 70) {
    signals.push({
      key: 'rsi-overbought',
      title: 'RSI 超買',
      tone: 'down',
      importance: 2,
      description: `${labelPrefix}RSI${settings.rsiPeriod} 已進入 70 以上偏熱區，隔日追價風險較高。`,
    });
  } else if ((latest.rsi ?? 50) <= 30) {
    signals.push({
      key: 'rsi-oversold',
      title: 'RSI 超賣',
      tone: 'up',
      importance: 2,
      description: `${labelPrefix}RSI${settings.rsiPeriod} 落到 30 以下偏低區，若量縮止穩可留意反彈。`,
    });
  }

  const stochasticCross = detectCross(previous?.stochasticK ?? null, previous?.stochasticD ?? null, latest.stochasticK ?? null, latest.stochasticD ?? null);
  if (stochasticCross === 'bullish' && (latest.stochasticK ?? 50) <= 35) {
    signals.push({
      key: 'kd-bullish',
      title: 'KD 低檔黃金交叉',
      tone: 'up',
      importance: 2,
      description: `${labelPrefix}KD 在相對低檔出現黃金交叉，短線有技術反彈條件。`,
    });
  } else if (stochasticCross === 'bearish' && (latest.stochasticK ?? 50) >= 65) {
    signals.push({
      key: 'kd-bearish',
      title: 'KD 高檔死亡交叉',
      tone: 'down',
      importance: 2,
      description: `${labelPrefix}KD 在高檔轉成死亡交叉，隔日震盪回檔風險升高。`,
    });
  }

  if (
    latest.close !== null &&
    latest.maLong !== null &&
    previous?.close !== null &&
    previous?.maLong !== null
  ) {
    if (previous.close <= previous.maLong && latest.close > latest.maLong) {
      signals.push({
        key: 'break-above-long-ma',
        title: '站回長均線',
        tone: 'up',
        importance: 2,
        description: `${labelPrefix}收盤重新站上長均線，中期結構開始修復。`,
      });
    } else if (previous.close >= previous.maLong && latest.close < latest.maLong) {
      signals.push({
        key: 'break-below-long-ma',
        title: '跌破長均線',
        tone: 'down',
        importance: 2,
        description: `${labelPrefix}收盤跌破長均線，中期結構轉弱。`,
      });
    }
  }

  if (!signals.length) {
    signals.push({
      key: 'neutral',
      title: '技術面中性',
      tone: 'normal',
      importance: 1,
      description: `${labelPrefix}目前沒有明確的新訊號，偏向等待下一段量價表態。`,
    });
  }

  return signals
    .sort((left, right) => (right.importance ?? 0) - (left.importance ?? 0))
    .slice(0, 4);
}

export function summarizeSignalTitles(signals) {
  return signals.map((signal) => signal.title);
}

export const defaultIndicatorSettings = DEFAULT_SETTINGS;
