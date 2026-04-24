function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function clampScore(value) {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round(value)));
}

function getToneFromScore(score) {
  if (score >= 75) return 'up';
  if (score <= 45) return 'down';
  return 'normal';
}

function buildGrade(score) {
  if (score >= 85) return 'A+';
  if (score >= 78) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 62) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function createSection(key, label, score, note) {
  return {
    key,
    label,
    score,
    note,
    tone: getToneFromScore(score),
  };
}

function getIndustryPePercentile(source = {}) {
  return toNumber(source?.industryValuation?.pePercentile ?? source?.pePercentile);
}

function getDailyTradeValue(source = {}) {
  return toNumber(source?.avgTradeValue ?? source?.dailyTradeValue);
}

function getSignalConfidence(source = {}) {
  return toNumber(source?.signalConfidence);
}

function getMarginSurge(source = {}) {
  return Boolean(
    source?.hasMarginSurge ||
      (toNumber(source?.marginUsage) !== null && toNumber(source?.marginUsage) >= 40) ||
      (toNumber(source?.marginChange) !== null && toNumber(source?.marginChange) >= 800000),
  );
}

function getLiquidityState(source = {}) {
  const liquidityKey = source?.liquidityTier?.key ?? source?.liquidityTier;
  const tradeValue = getDailyTradeValue(source);

  return {
    liquidityKey,
    tradeValue,
    isVeryLow: liquidityKey === 'very-low' || (tradeValue !== null && tradeValue < 5_000_000),
    isLow: liquidityKey === 'low' || (tradeValue !== null && tradeValue < 20_000_000),
  };
}

function extractDispositionRisk(reminders) {
  const summary = reminders?.summary ?? {};
  return {
    isUnderDisposition: Boolean(summary.activeDispositionCount),
    hasAttention: Boolean(summary.attentionWarningCount),
    hasChangedTrading: Boolean(summary.changedTradingCount),
  };
}

function buildSummaryOverheatWarningsInternal(stock = {}) {
  const warnings = [];
  const return20 = toNumber(stock.return20);
  const dayChangePercent = toNumber(stock.changePercent);
  const pePercentile = getIndustryPePercentile(stock);
  const peRatio = toNumber(stock.peRatio);
  const activeEtfCount = toNumber(stock.activeEtfCount);
  const foreignTargetPremium = toNumber(stock.foreignTargetPricePremium ?? stock.premiumToTarget);
  const { isVeryLow, isLow } = getLiquidityState(stock);
  const marginSurge = getMarginSurge(stock);

  if (stock.isUnderDisposition || stock.hasChangedTrading) {
    warnings.push({
      key: 'trading-restriction',
      title: stock.isUnderDisposition ? '處置交易中' : '變更交易中',
      badgeLabel: '高風險',
      tone: 'risk',
    });
  }

  if (return20 !== null && return20 >= 35) {
    warnings.push({
      key: 'return20-overheat',
      title: '20 日漲幅偏大',
      badgeLabel: '過熱',
      tone: return20 >= 50 ? 'risk' : 'warning',
    });
  }

  if (dayChangePercent !== null && dayChangePercent >= 7) {
    warnings.push({
      key: 'day-surge',
      title: '單日急漲偏熱',
      badgeLabel: '追價風險',
      tone: 'warning',
    });
  }

  if ((pePercentile !== null && pePercentile >= 85) || (peRatio !== null && peRatio >= 45)) {
    warnings.push({
      key: 'valuation-hot',
      title: '估值偏熱',
      badgeLabel: '估值高',
      tone: pePercentile !== null && pePercentile >= 92 ? 'risk' : 'warning',
    });
  }

  if (foreignTargetPremium !== null && foreignTargetPremium <= 5) {
    warnings.push({
      key: 'target-limited',
      title: foreignTargetPremium < 0 ? '目標價已落後現價' : '目標價空間有限',
      badgeLabel: '空間小',
      tone: foreignTargetPremium < 0 ? 'risk' : 'warning',
    });
  }

  if (marginSurge) {
    warnings.push({
      key: 'margin-surge',
      title: '融資增溫偏快',
      badgeLabel: '槓桿升溫',
      tone: 'warning',
    });
  }

  if (isVeryLow || isLow) {
    warnings.push({
      key: 'liquidity-thin',
      title: isVeryLow ? '流動性偏低' : '成交量偏薄',
      badgeLabel: '不易交易',
      tone: isVeryLow ? 'risk' : 'warning',
    });
  }

  if ((activeEtfCount ?? 0) === 0 && stock.topSignalTone === 'down') {
    warnings.push({
      key: 'weak-setup',
      title: '題材支撐偏弱',
      badgeLabel: '續航弱',
      tone: 'warning',
    });
  }

  if (stock.hasAttentionWarning) {
    warnings.push({
      key: 'attention',
      title: '注意股監控中',
      badgeLabel: '留意',
      tone: 'warning',
    });
  }

  return warnings.slice(0, 5);
}

export function buildSummaryOverheatWarnings(stock = {}) {
  return buildSummaryOverheatWarningsInternal(stock);
}

export function buildSummaryHealthScore(stock = {}) {
  const return20 = toNumber(stock.return20);
  const dayChangePercent = toNumber(stock.changePercent);
  const dividendYield = toNumber(stock.dividendYield);
  const pePercentile = getIndustryPePercentile(stock);
  const foreign5Day = toNumber(stock.foreign5Day);
  const investmentTrust5Day = toNumber(stock.investmentTrust5Day);
  const total5Day = toNumber(stock.total5Day);
  const activeEtfCount = toNumber(stock.activeEtfCount);
  const signalCount = toNumber(stock.signalCount);
  const signalConfidence = getSignalConfidence(stock);
  const volumeQualityScore = toNumber(stock.volumeQualityScore);
  const industryRankPct = toNumber(stock.industryRankPct);
  const warningCount = buildSummaryOverheatWarningsInternal(stock).length;
  const marginSurge = getMarginSurge(stock);
  const { isVeryLow, isLow } = getLiquidityState(stock);

  let technicalScore = 46;
  if (stock.topSignalTone === 'up') technicalScore += 18;
  if ((signalCount ?? 0) >= 2) technicalScore += 8;
  if (return20 !== null && return20 > 0 && return20 <= 25) technicalScore += 12;
  if (return20 !== null && return20 > 25 && return20 <= 40) technicalScore += 6;
  if (dayChangePercent !== null && dayChangePercent > 0 && dayChangePercent < 5) technicalScore += 6;
  if (volumeQualityScore !== null) technicalScore += (volumeQualityScore - 50) * 0.18;
  if (signalConfidence !== null) technicalScore += signalConfidence * 14;
  if (stock.topSignalTone === 'down') technicalScore -= 14;
  technicalScore = clampScore(technicalScore);

  let chipScore = 45;
  if ((total5Day ?? 0) > 0) chipScore += 16;
  if ((foreign5Day ?? 0) > 0) chipScore += 10;
  if ((investmentTrust5Day ?? 0) > 0) chipScore += 10;
  if ((activeEtfCount ?? 0) > 0) chipScore += Math.min(activeEtfCount * 4, 12);
  if (marginSurge) chipScore -= 10;
  if (stock.isUnderDisposition || stock.hasChangedTrading) chipScore -= 20;
  chipScore = clampScore(chipScore);

  let fundamentalScore = 46;
  if (dividendYield !== null && dividendYield >= 3) fundamentalScore += 8;
  if (pePercentile !== null && pePercentile <= 30) fundamentalScore += 12;
  else if (pePercentile !== null && pePercentile <= 45) fundamentalScore += 6;
  else if (pePercentile !== null && pePercentile >= 85) fundamentalScore -= 10;
  fundamentalScore = clampScore(fundamentalScore);

  let themeScore = 42;
  if ((activeEtfCount ?? 0) >= 3) themeScore += 16;
  else if ((activeEtfCount ?? 0) > 0) themeScore += 8;
  if (industryRankPct !== null && industryRankPct <= 35) themeScore += 12;
  if (return20 !== null && return20 > 0 && return20 <= 30) themeScore += 6;
  themeScore = clampScore(themeScore);

  let riskScore = 82;
  if (stock.isUnderDisposition) riskScore -= 35;
  if (stock.hasChangedTrading) riskScore -= 20;
  if (stock.hasAttentionWarning) riskScore -= 10;
  if (warningCount >= 3) riskScore -= 15;
  if (return20 !== null && return20 >= 40) riskScore -= 12;
  if (dayChangePercent !== null && dayChangePercent >= 7) riskScore -= 8;
  if (marginSurge) riskScore -= 8;
  if (isVeryLow) riskScore -= 18;
  else if (isLow) riskScore -= 8;
  riskScore = clampScore(riskScore);

  const totalScore = clampScore(
    technicalScore * 0.28 +
      chipScore * 0.24 +
      fundamentalScore * 0.18 +
      themeScore * 0.12 +
      riskScore * 0.18,
  );

  return {
    totalScore,
    grade: buildGrade(totalScore),
    tone: getToneFromScore(totalScore),
    warningCount,
    riskTone: getToneFromScore(riskScore),
  };
}

function buildOverallSummary(totalScore, riskScore, warningCount) {
  if (riskScore <= 40 || warningCount >= 3) {
    return '目前最需要先看風險，不適合只因為訊號漂亮就直接追價。';
  }

  if (totalScore >= 78 && riskScore >= 65) {
    return '整體結構偏強，若量價與族群同步，適合列入隔日優先觀察名單。';
  }

  if (totalScore >= 62) {
    return '整體條件中性偏多，適合等關鍵價位或量能確認後再出手。';
  }

  return '目前偏向整理或弱勢，先觀察支撐與籌碼變化，比追價更重要。';
}

export function buildOverheatWarnings(detail, options = {}) {
  const latestSummary = detail?.最新摘要 ?? {};
  const latestIndicators = detail?.最新指標 ?? {};
  const reminders = detail?.交易提醒 ?? {};
  const margin = detail?.融資融券 ?? {};
  const foreignTargetPrice = detail?.foreignTargetPrice ?? {};
  const close = toNumber(options.currentClose) ?? toNumber(latestSummary.close);
  const ma20 = toNumber(latestIndicators.maMedium ?? latestIndicators.ma20);
  const rsi = toNumber(latestIndicators.rsi ?? latestIndicators.rsi14);
  const return20 = toNumber(latestSummary.return20);
  const dayChangePercent = toNumber(latestSummary.changePercent);
  const marginUsage = toNumber(margin.marginUsage);
  const marginChange = toNumber(margin.marginChange);
  const targetPremium = toNumber(foreignTargetPrice.premiumToClose);
  const downSignals = (detail?.technicalSignals ?? []).filter((item) => item?.tone === 'down');
  const { isUnderDisposition, hasAttention, hasChangedTrading } = extractDispositionRisk(reminders);
  const warnings = [];

  if (isUnderDisposition || hasChangedTrading) {
    warnings.push({
      key: 'trading-restriction',
      title: isUnderDisposition ? '處置交易中' : '變更交易中',
      badgeLabel: '高風險',
      tone: 'risk',
      note: reminders?.summary?.topTitle ?? '這檔股票目前有交易限制，短線先把風險放在報酬前面。',
      detail: reminders?.alerts?.[0]?.note ?? '若已被處置或變更交易，隔日波動可能明顯放大，先不要只看單日漲跌決定進場。',
    });
  }

  if (return20 !== null && return20 >= 35) {
    warnings.push({
      key: 'return20-overheat',
      title: '20 日漲幅偏大',
      badgeLabel: '過熱',
      tone: return20 >= 50 ? 'risk' : 'warning',
      note: `近 20 日已上漲 ${return20.toFixed(2)}%，短線要先提防追高後震盪。`,
      detail: '漲很多不代表一定不能買，但比較適合等回測支撐、量能重新整理後再看。',
    });
  }

  if (close !== null && ma20 !== null) {
    const premiumToMa20 = ((close - ma20) / ma20) * 100;
    if (premiumToMa20 >= 12) {
      warnings.push({
        key: 'ma20-premium',
        title: '股價偏離月線',
        badgeLabel: '離均線遠',
        tone: premiumToMa20 >= 18 ? 'risk' : 'warning',
        note: `收盤高於月線 ${premiumToMa20.toFixed(2)}%，短線如果沒有新量能，容易先回測均線。`,
        detail: '離均線越遠，越要留意是不是情緒推高；這種時候分批比一次追滿更重要。',
      });
    }
  }

  if (rsi !== null && rsi >= 72) {
    warnings.push({
      key: 'rsi-overheat',
      title: 'RSI 偏熱',
      badgeLabel: '動能過熱',
      tone: rsi >= 78 ? 'risk' : 'warning',
      note: `RSI 來到 ${rsi.toFixed(1)}，代表短線買盤已經偏擁擠。`,
      detail: 'RSI 高不是一定會跌，但代表再往上追的勝率通常沒有剛轉強時漂亮。',
    });
  }

  if (targetPremium !== null && targetPremium <= 5) {
    warnings.push({
      key: 'target-price-room',
      title: targetPremium < 0 ? '目標價低於現價' : '目標價空間有限',
      badgeLabel: '上方空間小',
      tone: targetPremium < 0 ? 'risk' : 'warning',
      note:
        targetPremium < 0
          ? `目前價格已高於近期外資目標價約 ${Math.abs(targetPremium).toFixed(2)}%。`
          : `距離近期外資目標價只剩約 ${targetPremium.toFixed(2)}% 空間。`,
      detail: '不是說一定不能漲，而是代表市場已經先反映一大段，隔日追價的報酬風險比會變差。',
    });
  }

  if (marginUsage !== null && marginUsage >= 30) {
    warnings.push({
      key: 'margin-usage',
      title: '融資使用偏高',
      badgeLabel: '槓桿升溫',
      tone: marginUsage >= 40 ? 'risk' : 'warning',
      note: `融資使用率 ${marginUsage.toFixed(2)}%，短線如果不如預期，容易放大震盪。`,
      detail: '融資比重高的股票，常常在回檔時跌得比較急，進場更需要控制部位。',
    });
  }

  if (marginChange !== null && marginChange >= 800000) {
    warnings.push({
      key: 'margin-surge',
      title: '融資單日暴增',
      badgeLabel: '槓桿擁擠',
      tone: 'warning',
      note: `融資單日增加約 ${(marginChange / 1000).toFixed(0)} 張，代表短線槓桿資金明顯進場。`,
      detail: '如果股價只是被槓桿推高而不是穩定放量，隔日追價容易遇到大震盪。',
    });
  }

  if (hasAttention) {
    warnings.push({
      key: 'attention-warning',
      title: '注意股監控中',
      badgeLabel: '留意',
      tone: 'warning',
      note: '這檔股票近期被列為注意股，短線籌碼和情緒都可能偏躁動。',
      detail: '注意股不代表一定走弱，但表示短線交易風險和波動都比較高。',
    });
  }

  if (dayChangePercent !== null && dayChangePercent >= 7) {
    warnings.push({
      key: 'large-up-day',
      title: '單日急漲偏熱',
      badgeLabel: '追價風險',
      tone: 'warning',
      note: `單日上漲 ${dayChangePercent.toFixed(2)}%，隔日要先看能不能守住大量區。`,
      detail: '如果只是單日情緒推高，隔天很容易先出現震盪洗盤。',
    });
  }

  if (downSignals.length) {
    warnings.push({
      key: 'down-signal',
      title: downSignals[0].title,
      badgeLabel: '訊號轉弱',
      tone: 'warning',
      note: downSignals[0].description,
      detail: '當技術面已經先轉弱時，再追價的容錯率會明顯變差。',
    });
  }

  return warnings.slice(0, 5);
}

export function buildStockHealthScore(detail, options = {}) {
  const latestSummary = detail?.最新摘要 ?? {};
  const latestIndicators = detail?.最新指標 ?? {};
  const financials = detail?.財務資料 ?? {};
  const institutional = detail?.法人買賣?.summary ?? {};
  const activeEtfExposure = detail?.主動ETF曝光 ?? {};
  const industryComparison = detail?.同產業比較 ?? {};
  const foreignTargetPrice = detail?.foreignTargetPrice ?? {};
  const reminders = detail?.交易提醒 ?? {};
  const technicalSignals = detail?.technicalSignals ?? [];
  const industryValuation = options.industryValuation ?? null;
  const signalConfidence = toNumber(options.signalConfidence ?? null);
  const volumeQualityScore = toNumber(options.volumeQualityScore ?? null);
  const dailyTradeValue = toNumber(options.dailyTradeValue ?? null);
  const liquidityKey = options.liquidityTier?.key ?? options.liquidityTier ?? null;
  const pePercentile = toNumber(industryValuation?.pePercentile);
  const close = toNumber(options.currentClose) ?? toNumber(latestSummary.close);
  const ma20 = toNumber(latestIndicators.maMedium ?? latestIndicators.ma20);
  const ma60 = toNumber(latestIndicators.maLong ?? latestIndicators.ma60);
  const rsi = toNumber(latestIndicators.rsi ?? latestIndicators.rsi14);
  const macdHist = toNumber(latestIndicators.macdHist);
  const return20 = toNumber(latestSummary.return20);
  const revenueYoY = toNumber(financials?.月營收?.年增率);
  const cumulativeRevenueYoY = toNumber(financials?.月營收?.累計年增率);
  const eps = toNumber(financials?.綜合損益表?.每股盈餘);
  const debtRatio = toNumber(financials?.資產負債表?.負債比率);
  const foreign5Day = toNumber(institutional.foreign5Day);
  const investmentTrust5Day = toNumber(institutional.investmentTrust5Day);
  const total5Day = toNumber(institutional.total5Day);
  const marginChange = toNumber(detail?.融資融券?.marginChange);
  const activeEtfCount = toNumber(activeEtfExposure.count);
  const rank20Day = toNumber(industryComparison.rank20Day);
  const peerCount = toNumber(industryComparison.peerCount);
  const industryAverageReturn20 = toNumber(industryComparison.averageReturn20);
  const targetPremium = toNumber(foreignTargetPrice.premiumToClose);
  const { isUnderDisposition, hasAttention, hasChangedTrading } = extractDispositionRisk(reminders);
  const warningCount = buildOverheatWarnings(detail, options).length;
  const marginSurge = getMarginSurge({
    hasMarginSurge: options.hasMarginSurge,
    marginUsage: detail?.融資融券?.marginUsage,
    marginChange,
  });
  const { isVeryLow, isLow } = getLiquidityState({
    liquidityTier: liquidityKey,
    dailyTradeValue,
  });

  let technicalScore = 45;
  if (close !== null && ma20 !== null && close > ma20) technicalScore += 15;
  if (ma20 !== null && ma60 !== null && ma20 > ma60) technicalScore += 12;
  if (macdHist !== null && macdHist > 0) technicalScore += 10;
  if (rsi !== null && rsi >= 45 && rsi <= 70) technicalScore += 8;
  if (return20 !== null && return20 > 0 && return20 <= 30) technicalScore += 8;
  if (technicalSignals.some((item) => item?.tone === 'up')) technicalScore += 6;
  if (signalConfidence !== null) technicalScore += signalConfidence * 12;
  if (volumeQualityScore !== null) technicalScore += (volumeQualityScore - 50) * 0.15;
  if (rsi !== null && rsi >= 75) technicalScore -= 15;
  if (technicalSignals.some((item) => item?.tone === 'down')) technicalScore -= 10;
  technicalScore = clampScore(technicalScore);

  let chipScore = 45;
  if (total5Day !== null && total5Day > 0) chipScore += 18;
  if (foreign5Day !== null && foreign5Day > 0) chipScore += 12;
  if (investmentTrust5Day !== null && investmentTrust5Day > 0) chipScore += 10;
  if (marginChange !== null && marginChange <= 0) chipScore += 6;
  if (marginSurge) chipScore -= 12;
  if (isUnderDisposition || hasChangedTrading) chipScore -= 18;
  if (hasAttention) chipScore -= 8;
  chipScore = clampScore(chipScore);

  let fundamentalScore = 45;
  if (revenueYoY !== null && revenueYoY >= 15) fundamentalScore += 15;
  else if (revenueYoY !== null && revenueYoY > 0) fundamentalScore += 8;
  else if (revenueYoY !== null && revenueYoY < 0) fundamentalScore -= 10;
  if (cumulativeRevenueYoY !== null && cumulativeRevenueYoY >= 10) fundamentalScore += 8;
  if (eps !== null && eps > 0) fundamentalScore += 10;
  if (debtRatio !== null && debtRatio <= 50) fundamentalScore += 8;
  if (debtRatio !== null && debtRatio >= 65) fundamentalScore -= 12;
  if (pePercentile !== null) {
    if (pePercentile <= 25) fundamentalScore += 10;
    else if (pePercentile <= 45) fundamentalScore += 5;
    else if (pePercentile >= 85) fundamentalScore -= 8;
    else if (pePercentile >= 70) fundamentalScore -= 4;
  }
  fundamentalScore = clampScore(fundamentalScore);

  let themeScore = 42;
  if (activeEtfCount !== null && activeEtfCount >= 3) themeScore += 18;
  else if (activeEtfCount !== null && activeEtfCount > 0) themeScore += 10;
  if (rank20Day !== null && peerCount !== null && rank20Day <= Math.max(3, Math.round(peerCount * 0.35))) {
    themeScore += 16;
  }
  if (return20 !== null && industryAverageReturn20 !== null && return20 > industryAverageReturn20) {
    themeScore += 10;
  }
  if (targetPremium !== null && targetPremium >= 10) themeScore += 8;
  themeScore = clampScore(themeScore);

  let riskScore = 82;
  if (isUnderDisposition) riskScore -= 35;
  if (hasChangedTrading) riskScore -= 20;
  if (hasAttention) riskScore -= 10;
  if (return20 !== null && return20 >= 40) riskScore -= 15;
  if (rsi !== null && rsi >= 75) riskScore -= 15;
  if (targetPremium !== null && targetPremium <= 0) riskScore -= 12;
  if (marginSurge) riskScore -= 10;
  if (isVeryLow) riskScore -= 18;
  else if (isLow) riskScore -= 8;
  riskScore = clampScore(riskScore);

  const totalScore = clampScore(
    technicalScore * 0.28 +
      chipScore * 0.24 +
      fundamentalScore * 0.2 +
      themeScore * 0.14 +
      riskScore * 0.14,
  );

  const sections = [
    createSection(
      'technical',
      '技術面',
      technicalScore,
      technicalScore >= 75
        ? '均線、動能與量價節奏大致站在偏多一側。'
        : technicalScore >= 55
          ? '技術面有轉強跡象，但還要看量能與隔日續航。'
          : '技術面還沒整理出優勢，先不要只因為單日上漲就追。',
    ),
    createSection(
      'chip',
      '籌碼面',
      chipScore,
      chipScore >= 75
        ? '法人與資金流向偏多，短線支撐較完整。'
        : chipScore >= 55
          ? '籌碼有改善，但還沒有強到可以忽略風險。'
          : '籌碼支持度偏弱，容易出現衝高後整理。',
    ),
    createSection(
      'fundamental',
      '基本面',
      fundamentalScore,
      fundamentalScore >= 75
        ? '營收、獲利與估值位置大致健康。'
        : fundamentalScore >= 55
          ? '基本面大致中性，可搭配技術面一起判斷。'
          : '基本面目前沒有太多加分，追價要更保守。',
    ),
    createSection(
      'theme',
      '題材面',
      themeScore,
      themeScore >= 75
        ? '題材、ETF 曝光與族群相對強度都有跟上。'
        : themeScore >= 55
          ? '題材有延續性，但還需要觀察是不是主線。'
          : '題材支撐不夠明確，續航要打折看待。',
    ),
    createSection(
      'risk',
      '風險控管',
      riskScore,
      riskScore >= 75
        ? '目前沒有看到特別明顯的追價風險。'
        : riskScore >= 55
          ? '可以觀察，但進場最好先想好退場條件。'
          : '風險偏高，先保留現金比急著進場更重要。',
    ),
  ];

  return {
    totalScore,
    grade: buildGrade(totalScore),
    tone: getToneFromScore(totalScore),
    sections,
    summary: buildOverallSummary(totalScore, riskScore, warningCount),
  };
}
