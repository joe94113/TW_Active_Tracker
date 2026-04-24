function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function mean(values) {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function stddev(values, avg) {
  if (values.length <= 1) return 0;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

export function scoreVolumeQuality(volumes = []) {
  const cleaned = volumes.map(toNumber).filter((value) => value !== null && value >= 0);
  if (cleaned.length < 5) {
    return {
      score: null,
      dispersion: null,
      maxShare: null,
      avgVolume: null,
      ratio5to20: null,
      tone: 'info',
      label: '資料不足',
    };
  }

  const last5 = cleaned.slice(-5);
  const last20 = cleaned.slice(-20);
  const avg5 = mean(last5);
  const avg20 = mean(last20);
  const std5 = stddev(last5, avg5);
  const cv5 = avg5 > 0 ? std5 / avg5 : 0;

  const maxDay = Math.max(...last5);
  const totalLast5 = last5.reduce((sum, value) => sum + value, 0);
  const maxShare = totalLast5 > 0 ? maxDay / totalLast5 : 0;
  const ratio5to20 = avg20 > 0 ? avg5 / avg20 : null;

  const dispersionScore = Math.max(0, Math.min(100, 100 - (cv5 - 0.25) * 180));
  const concentrationScore = Math.max(0, Math.min(50, 50 - (maxShare - 0.3) * 150));

  let trendScore = 0;
  if (ratio5to20 !== null) {
    if (ratio5to20 >= 1.1 && ratio5to20 <= 2.5) trendScore = 30;
    else if (ratio5to20 >= 0.9 && ratio5to20 < 1.1) trendScore = 20;
    else if (ratio5to20 > 2.5 && ratio5to20 <= 4) trendScore = 15;
    else if (ratio5to20 < 0.9) trendScore = 10;
    else trendScore = 5;
  }

  const score = Math.max(0, Math.min(100, Math.round(dispersionScore * 0.5 + concentrationScore * 0.3 + trendScore * 0.2)));

  let tone = 'normal';
  let label = '量能品質普通';
  if (score >= 72) {
    tone = 'up';
    label = '量能結構漂亮';
  } else if (maxShare >= 0.55 && cv5 >= 0.7) {
    tone = 'warning';
    label = '單日爆量失真';
  } else if (ratio5to20 !== null && ratio5to20 < 0.7) {
    tone = 'down';
    label = '量能偏弱';
  } else if (score < 45) {
    tone = 'warning';
    label = '量能品質偏亂';
  }

  return {
    score,
    dispersion: cv5,
    maxShare,
    avgVolume: avg5,
    ratio5to20,
    tone,
    label,
  };
}
