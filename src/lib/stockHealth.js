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

function createSection(key, label, score, note) {
  return {
    key,
    label,
    score,
    note,
    tone: getToneFromScore(score),
  };
}

function buildSummaryOverheatWarningsInternal(stock = {}) {
  const warnings = [];
  const return20 = toNumber(stock.return20);
  const dayChangePercent = toNumber(stock.changePercent);
  const peRatio = toNumber(stock.peRatio);
  const activeEtfCount = toNumber(stock.activeEtfCount);
  const foreignTargetPremium = toNumber(stock.foreignTargetPricePremium ?? stock.premiumToTarget);

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
      title: '單日漲幅偏大',
      badgeLabel: '短打',
      tone: 'warning',
    });
  }

  if (peRatio !== null && peRatio >= 45) {
    warnings.push({
      key: 'valuation-hot',
      title: '本益比偏高',
      badgeLabel: '估值',
      tone: peRatio >= 70 ? 'risk' : 'warning',
    });
  }

  if (foreignTargetPremium !== null && foreignTargetPremium <= 5) {
    warnings.push({
      key: 'target-limited',
      title: foreignTargetPremium < 0 ? '目標價已被超過' : '目標價空間有限',
      badgeLabel: '目標價',
      tone: foreignTargetPremium < 0 ? 'risk' : 'warning',
    });
  }

  if ((activeEtfCount ?? 0) === 0 && stock.topSignalTone === 'down') {
    warnings.push({
      key: 'weak-setup',
      title: '技術轉弱中',
      badgeLabel: '技術',
      tone: 'warning',
    });
  }

  if (stock.hasAttentionWarning) {
    warnings.push({
      key: 'attention',
      title: '近期列入注意股',
      badgeLabel: '留意',
      tone: 'warning',
    });
  }

  return warnings.slice(0, 4);
}

export function buildSummaryOverheatWarnings(stock = {}) {
  return buildSummaryOverheatWarningsInternal(stock);
}

export function buildSummaryHealthScore(stock = {}) {
  const return20 = toNumber(stock.return20);
  const dayChangePercent = toNumber(stock.changePercent);
  const peRatio = toNumber(stock.peRatio);
  const pbRatio = toNumber(stock.pbRatio);
  const dividendYield = toNumber(stock.dividendYield);
  const foreign5Day = toNumber(stock.foreign5Day);
  const investmentTrust5Day = toNumber(stock.investmentTrust5Day);
  const total5Day = toNumber(stock.total5Day);
  const activeEtfCount = toNumber(stock.activeEtfCount);
  const signalCount = toNumber(stock.signalCount);
  const warningCount = buildSummaryOverheatWarningsInternal(stock).length;

  let technicalScore = 48;
  if (stock.topSignalTone === 'up') technicalScore += 18;
  if ((signalCount ?? 0) >= 2) technicalScore += 10;
  if (return20 !== null && return20 > 0 && return20 <= 30) technicalScore += 12;
  if (dayChangePercent !== null && dayChangePercent > 0 && dayChangePercent < 7) technicalScore += 8;
  if (stock.topSignalTone === 'down') technicalScore -= 12;
  technicalScore = clampScore(technicalScore);

  let chipScore = 45;
  if ((total5Day ?? 0) > 0) chipScore += 16;
  if ((foreign5Day ?? 0) > 0) chipScore += 10;
  if ((investmentTrust5Day ?? 0) > 0) chipScore += 10;
  if ((activeEtfCount ?? 0) > 0) chipScore += Math.min(activeEtfCount * 5, 15);
  if (stock.isUnderDisposition || stock.hasChangedTrading) chipScore -= 20;
  chipScore = clampScore(chipScore);

  let fundamentalScore = 48;
  if (dividendYield !== null && dividendYield >= 3) fundamentalScore += 10;
  if (peRatio !== null && peRatio <= 25) fundamentalScore += 10;
  if (pbRatio !== null && pbRatio <= 3) fundamentalScore += 10;
  if (peRatio !== null && peRatio >= 60) fundamentalScore -= 15;
  if (pbRatio !== null && pbRatio >= 8) fundamentalScore -= 12;
  fundamentalScore = clampScore(fundamentalScore);

  let themeScore = 42;
  if ((activeEtfCount ?? 0) >= 3) themeScore += 18;
  else if ((activeEtfCount ?? 0) > 0) themeScore += 10;
  if ((return20 ?? 0) > 0 && (return20 ?? 0) <= 30) themeScore += 8;
  themeScore = clampScore(themeScore);

  let riskScore = 80;
  if (stock.isUnderDisposition) riskScore -= 35;
  if (stock.hasChangedTrading) riskScore -= 20;
  if (stock.hasAttentionWarning) riskScore -= 10;
  if (warningCount >= 3) riskScore -= 15;
  if (return20 !== null && return20 >= 40) riskScore -= 12;
  if (dayChangePercent !== null && dayChangePercent >= 7) riskScore -= 8;
  riskScore = clampScore(riskScore);

  const totalScore = clampScore(
    technicalScore * 0.28 +
      chipScore * 0.25 +
      fundamentalScore * 0.17 +
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

function buildGrade(score) {
  if (score >= 85) return 'A+';
  if (score >= 78) return 'A';
  if (score >= 70) return 'B+';
  if (score >= 62) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function buildOverallSummary(totalScore, riskScore, warningCount) {
  if (riskScore <= 40 || warningCount >= 3) {
    return '短線追價風險偏高，先等回測或量價重新整理，再考慮分批切入。';
  }

  if (totalScore >= 78 && riskScore >= 65) {
    return '整體結構偏健康，可先放進核心追蹤名單，等量價確認再分批布局。';
  }

  if (totalScore >= 62) {
    return '條件中上，但還需要觀察量能、法人或支撐區是否續強。';
  }

  return '目前偏向觀察名單，除非有新的法人、題材或技術轉強，否則不宜急追。';
}

function extractDispositionRisk(reminders) {
  const summary = reminders?.summary ?? {};
  return {
    isUnderDisposition: (summary.activeDispositionCount ?? 0) > 0,
    hasAttention: (summary.attentionWarningCount ?? 0) > 0,
    hasChangedTrading: (summary.changedTradingCount ?? 0) > 0,
  };
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
  const marginChangeLots = toNumber(margin.marginChange);
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
      note: reminders?.summary?.topTitle ?? '目前有交易限制，隔日波動與流動性風險都要提高警覺。',
      detail: reminders?.alerts?.[0]?.note ?? '這類股票容易放大追價成本，通常不適合在情緒最熱時硬追。',
    });
  }

  if (return20 !== null && return20 >= 35) {
    warnings.push({
      key: 'return20-overheat',
      title: '20 日漲幅偏大',
      badgeLabel: '過熱',
      tone: return20 >= 50 ? 'risk' : 'warning',
      note: `近 20 日已上漲 ${return20.toFixed(2)}%，若量能跟不上，短線容易先震盪洗籌碼。`,
      detail: '這類型比較適合等回測月線、前高或量縮後再看，而不是看到長紅才追。',
    });
  }

  if (close !== null && ma20 !== null) {
    const premiumToMa20 = ((close - ma20) / ma20) * 100;

    if (premiumToMa20 >= 12) {
      warnings.push({
        key: 'ma20-premium',
        title: '價格偏離月線',
        badgeLabel: '追價風險',
        tone: premiumToMa20 >= 18 ? 'risk' : 'warning',
        note: `現價高於 MA20 約 ${premiumToMa20.toFixed(2)}%，短線若沒新量支撐，容易先拉回修正。`,
        detail: '先觀察量能是否續強，或等靠近 20 日線與前波支撐再評估分批進場。',
      });
    }
  }

  if (rsi !== null && rsi >= 72) {
    warnings.push({
      key: 'rsi-overheat',
      title: 'RSI 進入偏熱區',
      badgeLabel: '偏熱',
      tone: rsi >= 78 ? 'risk' : 'warning',
      note: `RSI 目前來到 ${rsi.toFixed(1)}，動能仍強，但隔日追價風險也同步升高。`,
      detail: 'RSI 偏高不代表一定反轉，但若同時出現爆量、長上影或法人轉賣，就要更保守。',
    });
  }

  if (targetPremium !== null && targetPremium <= 5) {
    warnings.push({
      key: 'target-price-room',
      title: targetPremium < 0 ? '目標價已被超過' : '目標價空間有限',
      badgeLabel: '估值',
      tone: targetPremium < 0 ? 'risk' : 'warning',
      note:
        targetPremium < 0
          ? `目前股價已高於近期外資目標價均值約 ${Math.abs(targetPremium).toFixed(2)}%。`
          : `近期外資目標價空間僅剩 ${targetPremium.toFixed(2)}%，追價勝率相對下降。`,
      detail: '這時候更適合等獲利預期或新催化上修，不然容易變成估值先跑過基本面。',
    });
  }

  if (marginUsage !== null && marginUsage >= 30) {
    warnings.push({
      key: 'margin-usage',
      title: '融資使用率升高',
      badgeLabel: '槓桿',
      tone: marginUsage >= 40 ? 'risk' : 'warning',
      note: `融資使用率約 ${marginUsage.toFixed(2)}%，槓桿籌碼偏熱時，波動通常也會放大。`,
      detail: '若股價同時遠離均線或處在高檔，融資籌碼過熱時更容易出現急跌洗盤。',
    });
  }

  if (marginChangeLots !== null && marginChangeLots >= 800) {
    warnings.push({
      key: 'margin-surge',
      title: '融資單日大增',
      badgeLabel: '浮額',
      tone: 'warning',
      note: `融資單日增加約 ${Math.round(marginChangeLots)} 張，留意短線浮額變重。`,
      detail: '若後續沒有成交值與法人買盤接力，隔日追價部位容易先承受震盪。',
    });
  }

  if (hasAttention) {
    warnings.push({
      key: 'attention-warning',
      title: '近期列入注意股',
      badgeLabel: '留意',
      tone: 'warning',
      note: '注意股不一定代表轉弱，但表示波動與交易節奏已明顯升高。',
      detail: '這類股票較適合縮小部位、拉高紀律，避免單筆押太重。',
    });
  }

  if (dayChangePercent !== null && dayChangePercent >= 7) {
    warnings.push({
      key: 'large-up-day',
      title: '單日漲幅偏大',
      badgeLabel: '短打',
      tone: 'warning',
      note: `單日上漲 ${dayChangePercent.toFixed(2)}%，隔日若沒續量，容易先開高震盪。`,
      detail: '追這種長紅時更要看隔日量價是否延續，不然容易追在短線情緒峰值。',
    });
  }

  if (downSignals.length) {
    warnings.push({
      key: 'down-signal',
      title: downSignals[0].title,
      badgeLabel: '技術',
      tone: 'warning',
      note: downSignals[0].description,
      detail: '如果後續又跌回支撐區下方，代表短線節奏可能開始轉弱。',
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
  const close = toNumber(options.currentClose) ?? toNumber(latestSummary.close);
  const ma20 = toNumber(latestIndicators.maMedium ?? latestIndicators.ma20);
  const ma60 = toNumber(latestIndicators.maLong ?? latestIndicators.ma60);
  const rsi = toNumber(latestIndicators.rsi ?? latestIndicators.rsi14);
  const macdHist = toNumber(latestIndicators.macdHist);
  const return20 = toNumber(latestSummary.return20);
  const revenueYoY = toNumber(financials?.月營收?.年增率);
  const cumulativeRevenueYoY = toNumber(financials?.月營收?.累計年增率);
  const eps = toNumber(financials?.綜合損益表?.每股盈餘);
  const debtRatio = toNumber(financials?.資產負債表?.負債比);
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

  let technicalScore = 45;
  if (close !== null && ma20 !== null && close > ma20) technicalScore += 15;
  if (ma20 !== null && ma60 !== null && ma20 > ma60) technicalScore += 12;
  if (macdHist !== null && macdHist > 0) technicalScore += 12;
  if (rsi !== null && rsi >= 45 && rsi <= 70) technicalScore += 10;
  if (return20 !== null && return20 > 0 && return20 <= 35) technicalScore += 8;
  if (technicalSignals.some((item) => item?.tone === 'up')) technicalScore += 8;
  if (rsi !== null && rsi >= 75) technicalScore -= 15;
  if (technicalSignals.some((item) => item?.tone === 'down')) technicalScore -= 10;
  technicalScore = clampScore(technicalScore);

  let chipScore = 45;
  if (total5Day !== null && total5Day > 0) chipScore += 18;
  if (foreign5Day !== null && foreign5Day > 0) chipScore += 12;
  if (investmentTrust5Day !== null && investmentTrust5Day > 0) chipScore += 10;
  if (marginChange !== null && marginChange <= 0) chipScore += 6;
  if (marginChange !== null && marginChange >= 800) chipScore -= 12;
  if (isUnderDisposition || hasChangedTrading) chipScore -= 18;
  if (hasAttention) chipScore -= 8;
  chipScore = clampScore(chipScore);

  let fundamentalScore = 45;
  if (revenueYoY !== null && revenueYoY >= 15) fundamentalScore += 15;
  else if (revenueYoY !== null && revenueYoY > 0) fundamentalScore += 8;
  else if (revenueYoY !== null && revenueYoY < 0) fundamentalScore -= 10;
  if (cumulativeRevenueYoY !== null && cumulativeRevenueYoY >= 10) fundamentalScore += 10;
  if (eps !== null && eps > 0) fundamentalScore += 12;
  if (debtRatio !== null && debtRatio <= 50) fundamentalScore += 8;
  if (debtRatio !== null && debtRatio >= 65) fundamentalScore -= 12;
  fundamentalScore = clampScore(fundamentalScore);

  let themeScore = 42;
  if (activeEtfCount !== null && activeEtfCount >= 3) themeScore += 18;
  else if (activeEtfCount !== null && activeEtfCount > 0) themeScore += 10;
  if (rank20Day !== null && peerCount !== null && rank20Day <= Math.max(3, Math.round(peerCount * 0.35))) themeScore += 16;
  if (
    return20 !== null &&
    industryAverageReturn20 !== null &&
    return20 > industryAverageReturn20
  ) {
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
  if (close !== null && ma20 !== null) {
    const premiumToMa20 = ((close - ma20) / ma20) * 100;
    if (premiumToMa20 >= 15) riskScore -= 10;
  }
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
      technicalScore >= 75 ? '均線、動能與價格結構偏健康。' : technicalScore >= 55 ? '技術條件中性偏多，但還沒到非常漂亮。' : '技術面仍偏弱或已經偏熱，追價要保守。',
    ),
    createSection(
      'chip',
      '籌碼面',
      chipScore,
      chipScore >= 75 ? '法人買盤與浮額結構相對友善。' : chipScore >= 55 ? '籌碼中性偏多，仍需觀察是否續買。' : '籌碼承接力道偏弱，暫時不適合重壓。',
    ),
    createSection(
      'fundamental',
      '基本面',
      fundamentalScore,
      fundamentalScore >= 75 ? '營收與獲利動能都有支撐。' : fundamentalScore >= 55 ? '基本面尚可，但需要後續數字確認。' : '基本面支撐較弱，題材或籌碼要更強才值得追蹤。',
    ),
    createSection(
      'theme',
      '題材面',
      themeScore,
      themeScore >= 75 ? '題材與 ETF / 同族群相對強勢同步加分。' : themeScore >= 55 ? '仍有題材保護，但還不是最明顯主線。' : '題材辨識度不高，容易缺少資金接力。',
    ),
    createSection(
      'risk',
      '風險控管',
      riskScore,
      riskScore >= 75 ? '目前沒有太明顯的追價風險。' : riskScore >= 55 ? '風險尚可，但要搭配支撐壓力與量價看。' : '追價風險偏高，建議先等整理或確認。',
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
