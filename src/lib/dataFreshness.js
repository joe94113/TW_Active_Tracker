const DAY_MS = 86400000;

export function parseDateString(value) {
  if (!value) return null;

  const text = String(value).trim().replaceAll('/', '-');

  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) {
    return new Date(`${text}T00:00:00+08:00`);
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function toTaipeiDate(date) {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Taipei',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

function toTaipeiWeekday(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Taipei',
    weekday: 'short',
  }).format(date);
}

export function isTradingDay(date) {
  const weekday = toTaipeiWeekday(date);
  return weekday !== 'Sat' && weekday !== 'Sun';
}

export function getDataFreshnessStatus({
  generatedAt = null,
  marketDate = null,
  now = new Date(),
  staleDayThreshold = 2,
  warningHours = 6,
} = {}) {
  const generatedAtDate = parseDateString(generatedAt);
  const marketDateValue = parseDateString(marketDate);
  const marketDateKey = marketDateValue ? toTaipeiDate(marketDateValue) : null;
  const todayKey = toTaipeiDate(now);
  const marketDayDate = marketDateKey ? parseDateString(marketDateKey) : null;
  const todayDate = parseDateString(todayKey);
  const daysOld =
    marketDayDate && todayDate
      ? Math.max(0, Math.round((todayDate.getTime() - marketDayDate.getTime()) / DAY_MS))
      : null;
  const isWeekendCarry = !isTradingDay(now) && (daysOld ?? 0) <= 2;

  if (!generatedAtDate && !marketDateValue) {
    return {
      tone: 'info',
      label: '資料整理中',
      mode: 'loading',
      daysOld,
      isStale: false,
      isWarning: false,
      marketDate: marketDateKey,
    };
  }

  if (!isWeekendCarry && daysOld !== null && daysOld >= staleDayThreshold) {
    return {
      tone: 'down',
      label: '資料已過期',
      mode: 'historical',
      daysOld,
      isStale: true,
      isWarning: true,
      marketDate: marketDateKey,
    };
  }

  if (generatedAtDate && now.getTime() - generatedAtDate.getTime() >= warningHours * 60 * 60 * 1000) {
    return {
      tone: 'warning',
      label: '等待下一輪更新',
      mode: 'delayed',
      daysOld,
      isStale: false,
      isWarning: true,
      marketDate: marketDateKey,
    };
  }

  return {
    tone: isWeekendCarry ? 'normal' : 'up',
    label: isWeekendCarry ? '休市沿用' : '資料正常',
    mode: isWeekendCarry ? 'carry' : 'current',
    daysOld,
    isStale: false,
    isWarning: false,
    marketDate: marketDateKey,
  };
}
