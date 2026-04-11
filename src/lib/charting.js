import {
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  PriceLineSource,
} from 'lightweight-charts';
import { formatDate, formatTime } from './formatters';

export const chartPalette = {
  background: '#f8fbff',
  panelBackground: '#ffffff',
  text: '#5b7288',
  textStrong: '#10202d',
  border: 'rgba(16, 32, 45, 0.12)',
  grid: 'rgba(16, 32, 45, 0.08)',
  crosshair: 'rgba(11, 105, 155, 0.32)',
  brand: '#0b699b',
  brandSoft: 'rgba(11, 105, 155, 0.16)',
  line: '#1f6feb',
  up: '#d14b32',
  down: '#13885e',
  ma5: '#f97316',
  ma10: '#7c3aed',
  ma20: '#2563eb',
  ma60: '#6d4c41',
  rsi: '#ab47bc',
  k: '#ff9800',
  d: '#26a69a',
  macd: '#00796b',
  signal: '#ef6c00',
  guide: 'rgba(91, 114, 136, 0.42)',
  zoneUpTop: 'rgba(209, 75, 50, 0.18)',
  zoneUpBottom: 'rgba(209, 75, 50, 0.03)',
  zoneDownTop: 'rgba(19, 136, 94, 0.16)',
  zoneDownBottom: 'rgba(19, 136, 94, 0.03)',
  volumeUp: 'rgba(209, 75, 50, 0.72)',
  volumeDown: 'rgba(19, 136, 94, 0.68)',
  histogramUp: 'rgba(209, 75, 50, 0.7)',
  histogramDown: 'rgba(19, 136, 94, 0.66)',
};

export const chartEnums = {
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  PriceLineSource,
};

export function normalizeNumber(value, positiveOnly = false) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return null;
  }

  if (positiveOnly && parsed <= 0) {
    return null;
  }

  return parsed;
}

export function toBusinessDay(value) {
  const text = formatDate(value);
  return text === '尚無資料' ? null : text;
}

export function toUtcTimestamp(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.trunc(parsed) : null;
}

export function serializeChartTime(time) {
  if (typeof time === 'number') {
    return String(time);
  }

  if (typeof time === 'string') {
    return time;
  }

  if (time && typeof time === 'object' && 'year' in time && 'month' in time && 'day' in time) {
    const year = String(time.year).padStart(4, '0');
    const month = String(time.month).padStart(2, '0');
    const day = String(time.day).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  return '';
}

export function formatChartPrice(value) {
  const number = normalizeNumber(value);

  if (number === null) {
    return '-';
  }

  const absolute = Math.abs(number);
  const digits = absolute < 100 ? 2 : absolute < 1000 ? 1 : 0;

  return new Intl.NumberFormat('zh-TW', {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(number);
}

export function formatTickMark(time) {
  if (typeof time === 'number') {
    const date = new Date((time + 8 * 60 * 60) * 1000);
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    const hour = String(date.getUTCHours()).padStart(2, '0');
    const minute = String(date.getUTCMinutes()).padStart(2, '0');
    return `${hour}:${minute}\n${month}/${day}`;
  }

  if (typeof time === 'string') {
    return /^\d{4}-\d{2}-\d{2}$/.test(time) ? time.slice(5) : time;
  }

  return '';
}

export function formatCrosshairLabel(time) {
  if (typeof time === 'number') {
    const date = new Date((time + 8 * 60 * 60) * 1000);
    const isoDate = date.toISOString().slice(0, 10);
    const isoTime = date.toISOString().slice(11, 19).replaceAll(':', '');
    return `${formatDate(isoDate)} ${formatTime(isoTime)}`;
  }

  if (typeof time === 'string') {
    return formatDate(time);
  }

  return '-';
}

export function createBaseChartOptions({ rightOffset = 6, timeVisible = false } = {}) {
  return {
    autoSize: true,
    layout: {
      background: {
        type: ColorType.Solid,
        color: chartPalette.background,
      },
      textColor: chartPalette.text,
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
      panes: {
        enableResize: true,
        separatorColor: 'rgba(16, 32, 45, 0.08)',
        separatorHoverColor: 'rgba(11, 105, 155, 0.14)',
      },
      attributionLogo: false,
    },
    grid: {
      vertLines: {
        color: chartPalette.grid,
      },
      horzLines: {
        color: chartPalette.grid,
      },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        width: 1,
        color: chartPalette.crosshair,
        style: LineStyle.Dashed,
        labelBackgroundColor: chartPalette.brand,
      },
      horzLine: {
        width: 1,
        color: chartPalette.crosshair,
        style: LineStyle.Dashed,
        labelBackgroundColor: chartPalette.brand,
      },
    },
    rightPriceScale: {
      borderColor: chartPalette.border,
      scaleMargins: {
        top: 0.08,
        bottom: 0.08,
      },
    },
    leftPriceScale: {
      visible: false,
    },
    timeScale: {
      borderColor: chartPalette.border,
      rightOffset,
      barSpacing: 9,
      minBarSpacing: 5,
      timeVisible,
      secondsVisible: false,
      tickMarkFormatter: formatTickMark,
    },
    localization: {
      locale: 'zh-TW',
      priceFormatter: formatChartPrice,
    },
    handleScroll: {
      mouseWheel: true,
      pressedMouseMove: true,
      horzTouchDrag: true,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: {
        time: true,
        price: true,
      },
      mouseWheel: true,
      pinch: true,
    },
  };
}

export function buildConstantLineData(rows, value) {
  return rows.map((row) => ({
    time: row.time,
    value,
  }));
}

export function buildSegmentedLineData(rows, accessor, positiveOnly = false) {
  const segments = [];
  let currentSegment = [];

  rows.forEach((row, index) => {
    const previousRow = rows[index - 1];
    const numericValue = normalizeNumber(accessor(row), positiveOnly);
    const hasBreak =
      previousRow &&
      previousRow.contractMonth &&
      row.contractMonth &&
      previousRow.contractMonth !== row.contractMonth;

    if (hasBreak && currentSegment.length > 1) {
      segments.push(currentSegment);
      currentSegment = [];
    }

    if (numericValue === null) {
      if (currentSegment.length > 1) {
        segments.push(currentSegment);
      }
      currentSegment = [];
      return;
    }

    currentSegment.push({
      time: row.time,
      value: numericValue,
    });
  });

  if (currentSegment.length > 1) {
    segments.push(currentSegment);
  }

  return segments;
}
