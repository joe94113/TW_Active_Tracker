import { readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

const DAY_MS = 24 * 60 * 60 * 1000;

function parseArgs(argv) {
  const options = {
    dataDir: 'public/data',
    baselinePath: '',
    writeBaselinePath: '',
    deployedBaseUrl: '',
    skipDeployed: false,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--skip-deployed') {
      options.skipDeployed = true;
      continue;
    }

    const optionMap = {
      '--data-dir': 'dataDir',
      '--baseline': 'baselinePath',
      '--write-baseline': 'writeBaselinePath',
      '--deployed-base-url': 'deployedBaseUrl',
    };
    const optionName = optionMap[argument];
    if (!optionName || !argv[index + 1]) {
      throw new Error(`Unknown or incomplete argument: ${argument}`);
    }
    options[optionName] = argv[index + 1];
    index += 1;
  }

  return options;
}

function readNumber(name, fallback, { minimum = 0, maximum = Number.POSITIVE_INFINITY } = {}) {
  const rawValue = process.env[name];
  if (rawValue === undefined || rawValue === '') return fallback;

  const value = Number(rawValue);
  if (!Number.isFinite(value) || value < minimum || value > maximum) {
    throw new Error(`${name} must be a number between ${minimum} and ${maximum}.`);
  }
  return value;
}

function isObject(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function isIsoDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const timestamp = Date.parse(`${value}T00:00:00Z`);
  return Number.isFinite(timestamp) && new Date(timestamp).toISOString().slice(0, 10) === value;
}

function datePart(value) {
  if (isIsoDate(value)) return value;
  if (typeof value !== 'string') return '';
  const match = value.match(/^\d{4}-\d{2}-\d{2}/);
  return match && isIsoDate(match[0]) ? match[0] : '';
}

function daysBetween(laterDate, earlierDate) {
  return (Date.parse(`${laterDate}T00:00:00Z`) - Date.parse(`${earlierDate}T00:00:00Z`)) / DAY_MS;
}

async function readJson(filePath) {
  const contents = await readFile(filePath, 'utf8');
  return JSON.parse(contents);
}

async function loadDataDirectory(dataDir) {
  const [manifest, dashboard, stockIndex] = await Promise.all([
    readJson(path.join(dataDir, 'manifest.json')),
    readJson(path.join(dataDir, 'dashboard.json')),
    readJson(path.join(dataDir, 'stocks', 'index.json')),
  ]);
  return { manifest, dashboard, stockIndex };
}

function buildMetrics({ manifest, dashboard, stockIndex = null }, source) {
  const marketOverview = dashboard?.['市場總覽'];
  const etfOverview = dashboard?.['主動ETF總覽'];
  const institutionalOverview = dashboard?.['法人追蹤'];
  const futuresOverview = dashboard?.['期貨籌碼'];
  const rhythm = Array.isArray(marketOverview?.['近五日節奏'])
    ? marketOverview['近五日節奏']
    : [];
  const rhythmDates = [...new Set(rhythm.map((item) => item?.['日期']).filter(isIsoDate))].sort();

  const etfCounts = [
    manifest?.connectedCount,
    Array.isArray(manifest?.trackedEtfs) ? manifest.trackedEtfs.length : null,
    Array.isArray(manifest?.latestOverview) ? manifest.latestOverview.length : null,
    Array.isArray(etfOverview?.['已串接ETF']) ? etfOverview['已串接ETF'].length : null,
  ].filter((value) => Number.isInteger(value) && value >= 0);

  const stockCounts = [
    manifest?.stockDetailCount,
    Array.isArray(stockIndex) ? stockIndex.length : null,
  ].filter((value) => Number.isInteger(value) && value >= 0);
  const stocks = Array.isArray(stockIndex) ? stockIndex : [];
  const validPriceCount = stocks.filter(
    (item) => isIsoDate(datePart(item?.priceDate)) && Number.isFinite(item?.close),
  ).length;
  const revenueCount = stocks.filter((item) => isIsoDate(datePart(item?.monthlyRevenueDate))).length;
  const valuationCount = stocks.filter((item) =>
    [item?.peRatio, item?.pbRatio, item?.dividendYield].some(Number.isFinite),
  ).length;
  const institutionalStockCount = stocks.filter((item) =>
    [item?.foreign5Day, item?.investmentTrust5Day, item?.total5Day].some(Number.isFinite),
  ).length;

  const institutionalSourceStats = Array.isArray(institutionalOverview?.['資料來源統計'])
    ? institutionalOverview['資料來源統計']
    : [];
  const completeInstitutionalDates = [...new Set(
    institutionalSourceStats
      .filter((item) => Number(item?.['上市']) > 0 && Number(item?.['上櫃']) > 0)
      .map((item) => item?.['日期'])
      .filter(isIsoDate),
  )].sort();
  const futuresContracts = Array.isArray(futuresOverview?.['契約列表'])
    ? futuresOverview['契約列表']
    : [];
  const completeFuturesContracts = futuresContracts.filter((item) => {
    const institutions = Array.isArray(item?.['法人資料']) ? item['法人資料'] : [];
    const identities = new Set(institutions.map((row) => row?.['身份別']));
    const completeIdentities = ['自營商', '投信', '外資'].every((identity) => identities.has(identity));
    const numericDataIsUsable = institutions.every((row) =>
      Number.isFinite(row?.['交易淨口數']) && Number.isFinite(row?.['未平倉淨口數']),
    );
    const technicalHistory = item?.['技術面資料']?.['歷史資料'];
    return completeIdentities && numericDataIsUsable && Array.isArray(technicalHistory) && technicalHistory.length >= 20;
  });

  return {
    source,
    generatedDate: datePart(manifest?.generatedAtLocalDate) || datePart(manifest?.generatedAt),
    dashboardGeneratedDate: datePart(dashboard?.generatedAt),
    marketDate: datePart(marketOverview?.['資料日期']),
    afterHoursDate: datePart(marketOverview?.['盤後資料日期']),
    rankingDate: datePart(marketOverview?.['排行基準日期']),
    latestDisclosureDate: datePart(manifest?.latestDisclosureDate),
    rhythmLatestDate: rhythmDates.at(-1) ?? '',
    rhythmCount: rhythmDates.length,
    institutionalDate: datePart(institutionalOverview?.['資料日期']),
    institutionalLatestCompleteDate: completeInstitutionalDates.at(-1) ?? '',
    institutionalCompleteDayCount: completeInstitutionalDates.length,
    futuresDate: datePart(futuresOverview?.['資料日期']),
    futuresContractCount: new Set(
      completeFuturesContracts.map((item) => item?.['商品代碼'] || item?.['契約名稱']).filter(Boolean),
    ).size,
    etfCount: etfCounts.length > 0 ? Math.min(...etfCounts) : 0,
    stockCount: stockCounts.length > 0 ? Math.min(...stockCounts) : 0,
    validPriceCount,
    revenueCount,
    valuationCount,
    institutionalStockCount,
  };
}

function validateStructure(data) {
  const errors = [];
  const { manifest, dashboard, stockIndex } = data;
  const marketOverview = dashboard?.['市場總覽'];
  const etfOverview = dashboard?.['主動ETF總覽'];
  const institutionalOverview = dashboard?.['法人追蹤'];
  const futuresOverview = dashboard?.['期貨籌碼'];

  if (!isObject(manifest)) errors.push('manifest.json must contain a JSON object.');
  if (!isObject(dashboard)) errors.push('dashboard.json must contain a JSON object.');
  if (typeof manifest?.appName !== 'string' || manifest.appName.length === 0) {
    errors.push('manifest.json is missing appName.');
  }
  if (!datePart(manifest?.generatedAt) || !isIsoDate(manifest?.generatedAtLocalDate)) {
    errors.push('manifest.json has invalid generatedAt/generatedAtLocalDate values.');
  }
  if (!isIsoDate(manifest?.latestDisclosureDate)) {
    errors.push('manifest.json has an invalid latestDisclosureDate.');
  }
  if (!Array.isArray(manifest?.trackedEtfs) || !Array.isArray(manifest?.latestOverview)) {
    errors.push('manifest.json must contain trackedEtfs and latestOverview arrays.');
  }
  if (!Number.isInteger(manifest?.stockDetailCount) || manifest.stockDetailCount < 0) {
    errors.push('manifest.json has an invalid stockDetailCount.');
  }
  if (typeof dashboard?.appName !== 'string' || dashboard.appName.length === 0 || !datePart(dashboard?.generatedAt)) {
    errors.push('dashboard.json is missing a valid appName/generatedAt.');
  }
  if (!isObject(marketOverview)) errors.push('dashboard.json is missing 市場總覽.');
  if (!isObject(etfOverview)) errors.push('dashboard.json is missing 主動ETF總覽.');
  if (!isObject(institutionalOverview)) errors.push('dashboard.json is missing 法人追蹤.');
  if (!isObject(futuresOverview)) errors.push('dashboard.json is missing 期貨籌碼.');
  if (!Array.isArray(marketOverview?.['近五日節奏'])) {
    errors.push('dashboard.json is missing the 市場總覽.近五日節奏 array.');
  }
  if (!Array.isArray(etfOverview?.['已串接ETF'])) {
    errors.push('dashboard.json is missing the 主動ETF總覽.已串接ETF array.');
  }
  if (!Array.isArray(institutionalOverview?.['資料來源統計'])) {
    errors.push('dashboard.json is missing the 法人追蹤.資料來源統計 array.');
  }
  if (!Array.isArray(futuresOverview?.['契約列表'])) {
    errors.push('dashboard.json is missing the 期貨籌碼.契約列表 array.');
  }
  if (!Array.isArray(stockIndex)) errors.push('stocks/index.json must contain an array.');

  if (Array.isArray(stockIndex) && Number.isInteger(manifest?.stockDetailCount)) {
    const difference = Math.abs(stockIndex.length - manifest.stockDetailCount);
    const allowedDifference = Math.max(5, Math.ceil(manifest.stockDetailCount * 0.02));
    if (difference > allowedDifference) {
      errors.push(
        `Stock coverage is internally inconsistent: manifest=${manifest.stockDetailCount}, index=${stockIndex.length}.`,
      );
    }
  }

  return errors;
}

function defaultDeployedBaseUrl() {
  if (process.env.DATA_QUALITY_BASE_URL) return process.env.DATA_QUALITY_BASE_URL;
  if (process.env.GITHUB_ACTIONS !== 'true' || !process.env.GITHUB_REPOSITORY) return '';

  const [owner, repository] = process.env.GITHUB_REPOSITORY.split('/');
  if (!owner || !repository) return '';
  const repositoryPath = repository.toLowerCase() === `${owner}.github.io`.toLowerCase()
    ? ''
    : `/${repository}`;
  return `https://${owner}.github.io${repositoryPath}/data`;
}

async function fetchJson(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetch(url, {
      headers: { accept: 'application/json' },
      redirect: 'follow',
      signal: controller.signal,
    });
    if (!response.ok) throw new Error(`HTTP ${response.status} ${response.statusText}`);
    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function loadDeployedBaseline(baseUrl) {
  if (!baseUrl) return null;
  const normalizedBaseUrl = baseUrl.replace(/\/+$/, '');
  try {
    const [manifest, dashboard, stockIndex] = await Promise.all([
      fetchJson(`${normalizedBaseUrl}/manifest.json`),
      fetchJson(`${normalizedBaseUrl}/dashboard.json`),
      fetchJson(`${normalizedBaseUrl}/stocks/index.json`),
    ]);
    const metrics = buildMetrics({ manifest, dashboard, stockIndex }, `deployed:${normalizedBaseUrl}`);
    if (!metrics.generatedDate || !metrics.marketDate || metrics.etfCount === 0 || metrics.stockCount === 0) {
      throw new Error('deployed manifest/dashboard did not contain usable baseline metrics');
    }
    return metrics;
  } catch (error) {
    console.warn(`[data-quality] Could not load deployed baseline from ${normalizedBaseUrl}: ${error.message}`);
    return null;
  }
}

async function loadSnapshot(snapshotPath) {
  if (!snapshotPath) return null;
  try {
    const snapshot = await readJson(snapshotPath);
    if (!isObject(snapshot?.metrics)) throw new Error('snapshot is missing metrics');
    return { ...snapshot.metrics, source: snapshot.metrics.source || `snapshot:${snapshotPath}` };
  } catch (error) {
    console.warn(`[data-quality] Could not load checkout baseline ${snapshotPath}: ${error.message}`);
    return null;
  }
}

function validateMetrics(candidate, baseline, thresholds) {
  const errors = [];
  const {
    minimumEtfs,
    minimumStocks,
    minimumRhythmDays,
    minimumInstitutionalDays,
    minimumFuturesContracts,
    minimumPriceCoverageRatio,
    minimumRevenueCoverageRatio,
    minimumValuationCoverageRatio,
    minimumStockInstitutionalCoverageRatio,
    retentionRatio,
    maximumRegressionDays,
    maximumDataAgeDays,
  } = thresholds;

  if (candidate.etfCount < minimumEtfs) {
    errors.push(`ETF coverage ${candidate.etfCount} is below the absolute minimum ${minimumEtfs}.`);
  }
  if (candidate.stockCount < minimumStocks) {
    errors.push(`Stock coverage ${candidate.stockCount} is below the absolute minimum ${minimumStocks}.`);
  }
  if (candidate.rhythmCount < minimumRhythmDays) {
    errors.push(`Near-five-day rhythm has ${candidate.rhythmCount} unique dates; at least ${minimumRhythmDays} are required.`);
  }
  if (candidate.institutionalCompleteDayCount < minimumInstitutionalDays) {
    errors.push(
      `Institutional coverage has ${candidate.institutionalCompleteDayCount} complete TWSE/TPEx dates; `
      + `at least ${minimumInstitutionalDays} are required.`,
    );
  }
  if (candidate.futuresContractCount < minimumFuturesContracts) {
    errors.push(
      `Futures coverage has ${candidate.futuresContractCount} complete contracts; `
      + `at least ${minimumFuturesContracts} are required.`,
    );
  }

  const absoluteCoverageChecks = [
    ['Price', 'validPriceCount', minimumPriceCoverageRatio],
    ['Revenue', 'revenueCount', minimumRevenueCoverageRatio],
    ['Valuation', 'valuationCount', minimumValuationCoverageRatio],
    ['Institutional stock', 'institutionalStockCount', minimumStockInstitutionalCoverageRatio],
  ];
  for (const [label, key, minimumRatio] of absoluteCoverageChecks) {
    const observedRatio = candidate.stockCount > 0 ? candidate[key] / candidate.stockCount : 0;
    if (observedRatio < minimumRatio) {
      errors.push(
        `${label} field coverage is ${(observedRatio * 100).toFixed(1)}% `
        + `(${candidate[key]}/${candidate.stockCount}); at least ${(minimumRatio * 100).toFixed(1)}% is required.`,
      );
    }
  }

  if (baseline) {
    for (const [label, key] of [
      ['ETF', 'etfCount'],
      ['Stock', 'stockCount'],
      ['Price field', 'validPriceCount'],
      ['Revenue field', 'revenueCount'],
      ['Valuation field', 'valuationCount'],
      ['Institutional stock field', 'institutionalStockCount'],
    ]) {
      const baselineCount = baseline[key];
      if (!Number.isFinite(baselineCount) || baselineCount <= 0) continue;
      const retainedMinimum = Math.ceil(baselineCount * retentionRatio);
      if (candidate[key] < retainedMinimum) {
        errors.push(
          `${label} coverage ${candidate[key]} retains less than ${Math.round(retentionRatio * 100)}% `
          + `of baseline ${baselineCount} (minimum ${retainedMinimum}).`,
        );
      }
    }

    const dateKeys = [
      ['generated date', 'generatedDate'],
      ['dashboard generated date', 'dashboardGeneratedDate'],
      ['market date', 'marketDate'],
      ['after-hours date', 'afterHoursDate'],
      ['ranking date', 'rankingDate'],
      ['latest ETF disclosure date', 'latestDisclosureDate'],
      ['near-five-day rhythm date', 'rhythmLatestDate'],
      ['institutional date', 'institutionalDate'],
      ['latest complete institutional date', 'institutionalLatestCompleteDate'],
      ['futures date', 'futuresDate'],
    ];
    for (const [label, key] of dateKeys) {
      const candidateDate = candidate[key];
      const baselineDate = baseline[key];
      if (!isIsoDate(candidateDate) || !isIsoDate(baselineDate)) continue;
      const regressionDays = daysBetween(baselineDate, candidateDate);
      if (regressionDays > maximumRegressionDays) {
        errors.push(
          `${label} regressed from ${baselineDate} to ${candidateDate} (${regressionDays} days; `
          + `maximum ${maximumRegressionDays}).`,
        );
      }
    }
  }

  if (isIsoDate(candidate.generatedDate)) {
    const freshnessKeys = [
      ['market date', 'marketDate'],
      ['after-hours date', 'afterHoursDate'],
      ['ranking date', 'rankingDate'],
      ['latest ETF disclosure date', 'latestDisclosureDate'],
      ['near-five-day rhythm date', 'rhythmLatestDate'],
      ['institutional date', 'institutionalDate'],
      ['latest complete institutional date', 'institutionalLatestCompleteDate'],
      ['futures date', 'futuresDate'],
    ];
    for (const [label, key] of freshnessKeys) {
      const dataDate = candidate[key];
      if (!isIsoDate(dataDate)) {
        errors.push(`Candidate ${label} is missing or invalid.`);
        continue;
      }
      const ageDays = daysBetween(candidate.generatedDate, dataDate);
      if (ageDays > maximumDataAgeDays) {
        errors.push(
          `${label} ${dataDate} is ${ageDays} days behind generated date ${candidate.generatedDate}; `
          + `maximum ${maximumDataAgeDays}.`,
        );
      }
      if (ageDays < -1) {
        errors.push(`${label} ${dataDate} is unexpectedly ahead of generated date ${candidate.generatedDate}.`);
      }
    }
  }

  return errors;
}

function summarize(metrics) {
  return [
    `source=${metrics.source}`,
    `generated=${metrics.generatedDate || 'unknown'}`,
    `market=${metrics.marketDate || 'unknown'}`,
    `afterHours=${metrics.afterHoursDate || 'unknown'}`,
    `rhythm=${metrics.rhythmCount} (latest ${metrics.rhythmLatestDate || 'unknown'})`,
    `institutional=${metrics.institutionalCompleteDayCount} (latest ${metrics.institutionalLatestCompleteDate || 'unknown'})`,
    `futures=${metrics.futuresContractCount} (date ${metrics.futuresDate || 'unknown'})`,
    `stocks=${metrics.stockCount}`,
    `prices=${metrics.validPriceCount}`,
    `revenue=${metrics.revenueCount}`,
    `valuation=${metrics.valuationCount}`,
    `institutionalStocks=${metrics.institutionalStockCount}`,
    `etfs=${metrics.etfCount}`,
  ].join(', ');
}

function githubError(message) {
  const escaped = message.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
  console.error(`::error title=Market data quality gate::${escaped}`);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const data = await loadDataDirectory(options.dataDir);
  const structureErrors = validateStructure(data);
  const candidate = buildMetrics(data, `candidate:${options.dataDir}`);

  if (options.writeBaselinePath) {
    await writeFile(
      options.writeBaselinePath,
      `${JSON.stringify({ version: 1, capturedAt: new Date().toISOString(), metrics: candidate }, null, 2)}\n`,
      'utf8',
    );
    console.log(`[data-quality] Checkout baseline saved: ${summarize(candidate)}`);
    return;
  }

  const checkoutBaseline = await loadSnapshot(options.baselinePath);
  const deployedBaseUrl = options.skipDeployed
    ? ''
    : (options.deployedBaseUrl || defaultDeployedBaseUrl());
  const deployedBaseline = await loadDeployedBaseline(deployedBaseUrl);
  const baseline = deployedBaseline || checkoutBaseline;

  const thresholds = {
    minimumEtfs: readNumber('DATA_QUALITY_MIN_ETFS', 20, { minimum: 1 }),
    minimumStocks: readNumber('DATA_QUALITY_MIN_STOCKS', 300, { minimum: 1 }),
    minimumRhythmDays: readNumber('DATA_QUALITY_MIN_RHYTHM_DAYS', 5, { minimum: 1, maximum: 5 }),
    minimumInstitutionalDays: readNumber('DATA_QUALITY_MIN_INSTITUTIONAL_DAYS', 5, { minimum: 1, maximum: 5 }),
    minimumFuturesContracts: readNumber('DATA_QUALITY_MIN_FUTURES_CONTRACTS', 2, { minimum: 1 }),
    minimumPriceCoverageRatio: readNumber('DATA_QUALITY_MIN_PRICE_COVERAGE_RATIO', 0.9, { minimum: 0, maximum: 1 }),
    minimumRevenueCoverageRatio: readNumber('DATA_QUALITY_MIN_REVENUE_COVERAGE_RATIO', 0.75, { minimum: 0, maximum: 1 }),
    minimumValuationCoverageRatio: readNumber('DATA_QUALITY_MIN_VALUATION_COVERAGE_RATIO', 0.75, { minimum: 0, maximum: 1 }),
    minimumStockInstitutionalCoverageRatio: readNumber('DATA_QUALITY_MIN_STOCK_INSTITUTIONAL_COVERAGE_RATIO', 0.9, { minimum: 0, maximum: 1 }),
    retentionRatio: readNumber('DATA_QUALITY_MIN_RETENTION_RATIO', 0.8, { minimum: 0.1, maximum: 1 }),
    maximumRegressionDays: readNumber('DATA_QUALITY_MAX_REGRESSION_DAYS', 0, { minimum: 0 }),
    maximumDataAgeDays: readNumber('DATA_QUALITY_MAX_DATA_AGE_DAYS', 14, { minimum: 1 }),
  };

  console.log(`[data-quality] Candidate: ${summarize(candidate)}`);
  console.log(baseline
    ? `[data-quality] Baseline: ${summarize(baseline)}`
    : '[data-quality] No usable baseline; applying absolute and internal-consistency checks only.');

  const errors = [
    ...structureErrors,
    ...validateMetrics(candidate, baseline, thresholds),
  ];

  if (errors.length > 0) {
    for (const error of errors) githubError(error);
    throw new Error(`Market data quality gate rejected this snapshot with ${errors.length} error(s).`);
  }

  console.log('[data-quality] Snapshot passed the deployment quality gate.');
}

main().catch((error) => {
  console.error(error.stack || error.message);
  process.exitCode = 1;
});
