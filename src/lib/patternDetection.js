function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function slopeOfLine(points) {
  const n = points.length;
  if (n < 2) return 0;
  const avgX = points.reduce((sum, [x]) => sum + x, 0) / n;
  const avgY = points.reduce((sum, [, y]) => sum + y, 0) / n;
  let num = 0;
  let den = 0;
  for (const [x, y] of points) {
    num += (x - avgX) * (y - avgY);
    den += (x - avgX) ** 2;
  }
  return den === 0 ? 0 : num / den;
}

function findLocalExtremes(values, kind = 'high', window = 3) {
  const results = [];
  for (let index = window; index < values.length - window; index += 1) {
    const slice = values.slice(index - window, index + window + 1);
    const target = values[index];
    if (kind === 'high' && target === Math.max(...slice)) {
      results.push({ index, value: target });
    } else if (kind === 'low' && target === Math.min(...slice)) {
      results.push({ index, value: target });
    }
  }
  return results;
}

function detectCupAndHandle(bars) {
  if (bars.length < 40) return null;
  const recent = bars.slice(-60);
  const highs = recent.map((bar) => toNumber(bar.high) ?? toNumber(bar.close) ?? 0);
  const lows = recent.map((bar) => toNumber(bar.low) ?? toNumber(bar.close) ?? 0);

  const peaks = findLocalExtremes(highs, 'high', 3);
  if (peaks.length < 2) return null;

  const topCandidates = [...peaks].sort((a, b) => b.value - a.value).slice(0, 4).sort((a, b) => a.index - b.index);
  if (topCandidates.length < 2) return null;

  const left = topCandidates[0];
  const right = topCandidates[topCandidates.length - 1];
  if (right.index - left.index < 15) return null;

  const peakDiff = Math.abs(right.value - left.value) / left.value;
  if (peakDiff > 0.04) return null;

  const midLow = Math.min(...lows.slice(left.index, right.index + 1));
  const depthPct = (left.value - midLow) / left.value;
  if (depthPct < 0.1 || depthPct > 0.35) return null;

  const handleSlice = recent.slice(right.index + 1).map((bar) => toNumber(bar.close) ?? 0);
  if (handleSlice.length < 3) return null;
  const handleLow = Math.min(...handleSlice);
  const handleDepth = (right.value - handleLow) / right.value;
  if (handleDepth > 0.12 || handleDepth < 0.02) return null;

  const confidence = Math.max(45, Math.min(88, 80 - peakDiff * 800 - Math.abs(handleDepth - 0.05) * 350));

  return {
    key: 'cup-and-handle',
    title: '杯柄整理',
    tone: 'up',
    confidence: Math.round(confidence),
    note: `左右高點差 ${ (peakDiff * 100).toFixed(1) }%，杯身回檔 ${(depthPct * 100).toFixed(1)}%。`,
  };
}

function detectBullFlag(bars) {
  if (bars.length < 25) return null;
  const closes = bars.map((bar) => toNumber(bar.close) ?? 0);
  const length = closes.length;

  for (let flagLen = 5; flagLen <= 12; flagLen += 1) {
    for (let poleLen = 8; poleLen <= 15; poleLen += 1) {
      const flagStart = length - flagLen;
      const poleStart = flagStart - poleLen;
      if (poleStart < 0) continue;

      const poleStartPrice = closes[poleStart];
      const poleEndPrice = closes[flagStart];
      if (!poleStartPrice || !poleEndPrice) continue;

      const poleReturn = (poleEndPrice - poleStartPrice) / poleStartPrice;
      if (poleReturn < 0.08) continue;

      const flagSlice = closes.slice(flagStart);
      const flagMax = Math.max(...flagSlice);
      const flagMin = Math.min(...flagSlice);
      const flagRange = (flagMax - flagMin) / poleEndPrice;
      if (flagRange > 0.07) continue;

      const flagSlope = slopeOfLine(flagSlice.map((value, index) => [index, value]));
      if (flagSlope / poleEndPrice > 0.003) continue;

      return {
        key: 'bull-flag',
        title: '旗形整理',
        tone: 'up',
        confidence: Math.min(85, 55 + Math.round(poleReturn * 200)),
        note: `前段推升 ${(poleReturn * 100).toFixed(1)}%，整理幅度 ${(flagRange * 100).toFixed(1)}%。`,
      };
    }
  }

  return null;
}

function detectTriangle(bars) {
  if (bars.length < 20) return null;
  const recent = bars.slice(-30);
  const highs = recent.map((bar) => toNumber(bar.high) ?? toNumber(bar.close) ?? 0);
  const lows = recent.map((bar) => toNumber(bar.low) ?? toNumber(bar.close) ?? 0);
  const highPoints = findLocalExtremes(highs, 'high', 2);
  const lowPoints = findLocalExtremes(lows, 'low', 2);
  if (highPoints.length < 2 || lowPoints.length < 2) return null;

  const avgPrice = recent.reduce((sum, bar) => sum + (toNumber(bar.close) ?? 0), 0) / recent.length;
  const highSlope = slopeOfLine(highPoints.map((point) => [point.index, point.value])) / avgPrice;
  const lowSlope = slopeOfLine(lowPoints.map((point) => [point.index, point.value])) / avgPrice;

  if (highSlope < -0.001 && lowSlope > 0.001) {
    return {
      key: 'symmetric-triangle',
      title: '對稱三角整理',
      tone: 'normal',
      confidence: Math.min(80, 45 + Math.round((Math.abs(highSlope) + Math.abs(lowSlope)) * 8000)),
      note: '高點下移、低點上移，代表波動收斂，後續要看哪一邊先帶量突破。',
    };
  }

  if (Math.abs(highSlope) < 0.001 && lowSlope > 0.001) {
    return {
      key: 'ascending-triangle',
      title: '上升三角整理',
      tone: 'up',
      confidence: Math.min(82, 50 + Math.round(lowSlope * 6000)),
      note: '低點持續墊高、上方壓力固定，常見於強勢整理後再攻。',
    };
  }

  if (Math.abs(lowSlope) < 0.001 && highSlope < -0.001) {
    return {
      key: 'descending-triangle',
      title: '下降三角整理',
      tone: 'down',
      confidence: Math.min(82, 50 + Math.round(Math.abs(highSlope) * 6000)),
      note: '高點不斷下移但低點支撐固定，代表賣壓逐漸壓低節奏。',
    };
  }

  return null;
}

function detectHeadAndShoulders(bars) {
  if (bars.length < 30) return null;
  const recent = bars.slice(-50);
  const highs = recent.map((bar) => toNumber(bar.high) ?? toNumber(bar.close) ?? 0);
  const lows = recent.map((bar) => toNumber(bar.low) ?? toNumber(bar.close) ?? 0);
  const peaks = findLocalExtremes(highs, 'high', 3);
  const troughs = findLocalExtremes(lows, 'low', 3);

  if (peaks.length >= 3) {
    for (let index = 0; index <= peaks.length - 3; index += 1) {
      const [left, head, right] = [peaks[index], peaks[index + 1], peaks[index + 2]];
      if (head.value <= left.value || head.value <= right.value) continue;
      if (right.index - left.index > 40) continue;
      const shoulderDiff = Math.abs(left.value - right.value) / left.value;
      const headPremium = (head.value - (left.value + right.value) / 2) / ((left.value + right.value) / 2);
      if (shoulderDiff > 0.04 || headPremium < 0.04) continue;

      return {
        key: 'head-and-shoulders',
        title: '頭肩頂',
        tone: 'down',
        confidence: Math.min(85, 55 + Math.round(headPremium * 400)),
        note: '中間高點明顯高於左右兩側，常見於強勢末段轉弱前。',
      };
    }
  }

  if (troughs.length >= 3) {
    for (let index = 0; index <= troughs.length - 3; index += 1) {
      const [left, head, right] = [troughs[index], troughs[index + 1], troughs[index + 2]];
      if (head.value >= left.value || head.value >= right.value) continue;
      if (right.index - left.index > 40) continue;
      const shoulderDiff = Math.abs(left.value - right.value) / left.value;
      const headDiscount = ((left.value + right.value) / 2 - head.value) / ((left.value + right.value) / 2);
      if (shoulderDiff > 0.04 || headDiscount < 0.04) continue;

      return {
        key: 'inverse-head-and-shoulders',
        title: '頭肩底',
        tone: 'up',
        confidence: Math.min(85, 55 + Math.round(headDiscount * 400)),
        note: '中間低點明顯低於左右兩側，常見於整理末段轉強前。',
      };
    }
  }

  return null;
}

export function detectPatterns(bars = []) {
  const detectors = [detectCupAndHandle, detectBullFlag, detectTriangle, detectHeadAndShoulders];
  const results = [];

  for (const detect of detectors) {
    try {
      const pattern = detect(bars);
      if (pattern && pattern.confidence >= 45) {
        results.push(pattern);
      }
    } catch {
      // ignore malformed series
    }
  }

  return results.sort((left, right) => right.confidence - left.confidence).slice(0, 3);
}

export function detectPatternsFromSparkline(sparkline = []) {
  if (!Array.isArray(sparkline) || sparkline.length < 15) return [];

  const bars = sparkline.map((value, index) => ({
    date: index,
    open: value,
    high: value,
    low: value,
    close: value,
    volume: null,
  }));

  return [detectBullFlag(bars), detectTriangle(bars)].filter(Boolean).filter((item) => item.confidence >= 45);
}
