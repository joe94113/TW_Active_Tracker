export function formatDate(value) {
  if (!value) return '尚無資料';
  const text = String(value).trim().replaceAll('/', '-');

  if (/^\d{8}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}-${text.slice(6, 8)}`;
  }

  if (/^\d{7}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}-${text.slice(5, 7)}`;
  }

  return text;
}

export function formatYearMonth(value) {
  if (!value) return '尚無資料';
  const text = String(value).trim().replaceAll('/', '-');

  if (/^\d{5}$/.test(text)) {
    return `${Number(text.slice(0, 3)) + 1911}-${text.slice(3, 5)}`;
  }

  if (/^\d{6}$/.test(text)) {
    return `${text.slice(0, 4)}-${text.slice(4, 6)}`;
  }

  return text;
}

export function formatNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('zh-TW').format(Number(value));
}

export function formatPercent(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return `${Number(value).toFixed(digits)}%`;
}

export function formatPriceDelta(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}`;
}

export function formatSignedNumber(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('zh-TW').format(number)}`;
}

export function formatAmount(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);

  if (Math.abs(number) >= 100000000) {
    return `${(number / 100000000).toFixed(2)} 億`;
  }

  if (Math.abs(number) >= 10000) {
    return `${(number / 10000).toFixed(2)} 萬`;
  }

  return new Intl.NumberFormat('zh-TW').format(number);
}

export function formatTime(value) {
  if (!value) return '-';
  const text = String(value).padStart(6, '0');
  return `${text.slice(0, 2)}:${text.slice(2, 4)}:${text.slice(4, 6)}`;
}

export const 格式化日期 = formatDate;
export const 格式化年月 = formatYearMonth;
export const 格式化數字 = formatNumber;
export const 格式化百分比 = formatPercent;
export const 格式化價差 = formatPriceDelta;
export const 格式化差額 = formatSignedNumber;
export const 格式化金額 = formatAmount;
export const 格式化時間 = formatTime;
