export function 格式化日期(value) {
  if (!value) return '尚無資料';
  return String(value).replaceAll('/', '-');
}

export function 格式化數字(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return new Intl.NumberFormat('zh-TW').format(Number(value));
}

export function 格式化百分比(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  return `${Number(value).toFixed(digits)}%`;
}

export function 格式化價差(value, digits = 2) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${number.toFixed(digits)}`;
}

export function 格式化差額(value) {
  if (value === null || value === undefined || Number.isNaN(Number(value))) {
    return '-';
  }

  const number = Number(value);
  const prefix = number > 0 ? '+' : '';
  return `${prefix}${new Intl.NumberFormat('zh-TW').format(number)}`;
}

export function 格式化金額(value) {
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

export function 格式化時間(value) {
  if (!value) return '-';
  const text = String(value).padStart(6, '0');
  return `${text.slice(0, 2)}:${text.slice(2, 4)}:${text.slice(4, 6)}`;
}
