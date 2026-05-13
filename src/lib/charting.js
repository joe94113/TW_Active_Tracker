import {
  ColorType,
  CrosshairMode,
  LastPriceAnimationMode,
  LineStyle,
  PriceLineSource,
} from 'lightweight-charts';
import { formatDate, formatTime } from './formatters';

export const lightChartPalette = {
  background: '#f8fbff',
  panelBackground: '#ffffff',
  text: '#5b7288',
  textStrong: '#10202d',
  border: 'rgba(16, 32, 45, 0.12)',
  grid: 'rgba(16, 32, 45, 0.08)',
  crosshair: 'rgba(11, 105, 155, 0.32)',
  separator: 'rgba(16, 32, 45, 0.08)',
  separatorHover: 'rgba(11, 105, 155, 0.14)',
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
  support: '#13885e',
  supportSoft: 'rgba(19, 136, 94, 0.18)',
  resistance: '#d14b32',
  resistanceSoft: 'rgba(209, 75, 50, 0.18)',
  costZone: '#0b699b',
  costZoneSoft: 'rgba(11, 105, 155, 0.18)',
  reference: '#5b7288',
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

export const darkChartPalette = {
  background: '#08111a',
  panelBackground: '#0d1825',
  text: '#97abc0',
  textStrong: '#eef5fb',
  border: 'rgba(148, 163, 184, 0.2)',
  grid: 'rgba(148, 163, 184, 0.1)',
  crosshair: 'rgba(103, 201, 255, 0.34)',
  separator: 'rgba(148, 163, 184, 0.08)',
  separatorHover: 'rgba(103, 201, 255, 0.16)',
  brand: '#67c9ff',
  brandSoft: 'rgba(103, 201, 255, 0.16)',
  line: '#7ab8ff',
  up: '#ff8c75',
  down: '#2fd0a3',
  ma5: '#f9a34b',
  ma10: '#b48cff',
  ma20: '#6ba8ff',
  ma60: '#b08968',
  rsi: '#d38bff',
  k: '#ffba4d',
  d: '#4dd4c4',
  macd: '#3cd2b8',
  signal: '#ff9854',
  support: '#2fd0a3',
  supportSoft: 'rgba(47, 208, 163, 0.22)',
  resistance: '#ff8c75',
  resistanceSoft: 'rgba(255, 140, 117, 0.22)',
  costZone: '#67c9ff',
  costZoneSoft: 'rgba(103, 201, 255, 0.22)',
  reference: '#97abc0',
  guide: 'rgba(151, 171, 192, 0.42)',
  zoneUpTop: 'rgba(255, 140, 117, 0.26)',
  zoneUpBottom: 'rgba(255, 140, 117, 0.05)',
  zoneDownTop: 'rgba(47, 208, 163, 0.22)',
  zoneDownBottom: 'rgba(47, 208, 163, 0.04)',
  volumeUp: 'rgba(255, 140, 117, 0.76)',
  volumeDown: 'rgba(47, 208, 163, 0.74)',
  histogramUp: 'rgba(255, 140, 117, 0.74)',
  histogramDown: 'rgba(47, 208, 163, 0.7)',
};

export function getChartThemeName() {
  if (typeof document === 'undefined') {
    return 'light';
  }

  return document.documentElement.dataset.theme === 'dark' ? 'dark' : 'light';
}

export function getActiveChartPalette() {
  return getChartThemeName() === 'dark' ? darkChartPalette : lightChartPalette;
}

export const chartPalette = new Proxy(
  {},
  {
    get(_target, property) {
      return getActiveChartPalette()[property];
    },
    has(_target, property) {
      return property in lightChartPalette;
    },
    ownKeys() {
      return Reflect.ownKeys(lightChartPalette);
    },
    getOwnPropertyDescriptor(_target, property) {
      if (!(property in lightChartPalette)) {
        return undefined;
      }

      return {
        enumerable: true,
        configurable: true,
        value: getActiveChartPalette()[property],
      };
    },
  },
);

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

export function createBaseChartOptions({
  rightOffset = 2,
  timeVisible = false,
  interactive = true,
  lockEdges = true,
} = {}) {
  const palette = getActiveChartPalette();

  return {
    autoSize: true,
    layout: {
      background: {
        type: ColorType.Solid,
        color: palette.background,
      },
      textColor: palette.text,
      fontFamily: '"Noto Sans TC", "Microsoft JhengHei", sans-serif',
      panes: {
        enableResize: true,
        separatorColor: palette.separator,
        separatorHoverColor: palette.separatorHover,
      },
      attributionLogo: false,
    },
    grid: {
      vertLines: {
        color: palette.grid,
      },
      horzLines: {
        color: palette.grid,
      },
    },
    crosshair: {
      mode: CrosshairMode.Normal,
      vertLine: {
        width: 1,
        color: palette.crosshair,
        style: LineStyle.Dashed,
        labelBackgroundColor: palette.brand,
      },
      horzLine: {
        width: 1,
        color: palette.crosshair,
        style: LineStyle.Dashed,
        labelBackgroundColor: palette.brand,
      },
    },
    rightPriceScale: {
      borderColor: palette.border,
      scaleMargins: {
        top: 0.08,
        bottom: 0.08,
      },
    },
    leftPriceScale: {
      visible: false,
    },
    timeScale: {
      borderColor: palette.border,
      rightOffset,
      barSpacing: 9,
      minBarSpacing: 5,
      timeVisible,
      secondsVisible: false,
      fixLeftEdge: lockEdges,
      fixRightEdge: lockEdges,
      lockVisibleTimeRangeOnResize: true,
      tickMarkFormatter: formatTickMark,
    },
    localization: {
      locale: 'zh-TW',
      priceFormatter: formatChartPrice,
    },
    handleScroll: {
      mouseWheel: interactive,
      pressedMouseMove: interactive,
      horzTouchDrag: interactive,
      vertTouchDrag: false,
    },
    handleScale: {
      axisPressedMouseMove: {
        time: interactive,
        price: interactive,
      },
      mouseWheel: interactive,
      pinch: interactive,
    },
  };
}

export function observeChartTheme(onChange) {
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') {
    return () => {};
  }

  let previousTheme = getChartThemeName();
  const root = document.documentElement;
  const observer = new MutationObserver(() => {
    const nextTheme = getChartThemeName();
    if (nextTheme === previousTheme) {
      return;
    }

    previousTheme = nextTheme;
    onChange?.(nextTheme);
  });

  observer.observe(root, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return () => observer.disconnect();
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
