export const REQUIRED_FUTURES_IDENTITIES = Object.freeze(['自營商', '投信', '外資']);
export const REQUIRED_FUTURES_NUMERIC_FIELDS = Object.freeze(['交易淨口數', '未平倉淨口數']);
export const REQUIRED_FUTURES_CONTRACT_CODES = Object.freeze(['MXF', 'TMF']);

function contractLabel(contract) {
  return contract?.['商品代碼'] || contract?.['契約名稱'] || '未知契約';
}

export function getFuturesInstitutionIssues(contract) {
  const institutions = Array.isArray(contract?.['法人資料']) ? contract['法人資料'] : [];
  const issues = [];

  for (const identity of REQUIRED_FUTURES_IDENTITIES) {
    const row = institutions.find((item) => item?.['身份別'] === identity);
    if (!row) {
      issues.push(`缺少${identity}`);
      continue;
    }

    for (const field of REQUIRED_FUTURES_NUMERIC_FIELDS) {
      if (!Number.isFinite(row?.[field])) {
        issues.push(`${identity}.${field}不是有效數字`);
      }
    }
  }

  return issues;
}

export function hasCompleteFuturesInstitutionData(contract) {
  return getFuturesInstitutionIssues(contract).length === 0;
}

export function getFuturesContractIssues(contract, { minimumTechnicalHistory = 20 } = {}) {
  const issues = getFuturesInstitutionIssues(contract);
  const technicalHistory = contract?.['技術面資料']?.['歷史資料'];

  if (!Array.isArray(technicalHistory)) {
    issues.push('缺少技術歷史資料');
  } else if (technicalHistory.length < minimumTechnicalHistory) {
    issues.push(`技術歷史僅 ${technicalHistory.length} 筆`);
  }

  return issues;
}

export function getFuturesSnapshotInstitutionIssues(
  snapshot,
  { requiredContractCodes = REQUIRED_FUTURES_CONTRACT_CODES } = {},
) {
  const contracts = Array.isArray(snapshot?.['契約列表']) ? snapshot['契約列表'] : [];
  const issues = [];

  for (const code of requiredContractCodes) {
    const contract = contracts.find((item) => item?.['商品代碼'] === code);
    if (!contract) {
      issues.push(`缺少${code}契約`);
      continue;
    }

    for (const issue of getFuturesInstitutionIssues(contract)) {
      issues.push(`${contractLabel(contract)}：${issue}`);
    }
  }

  return issues;
}

export function hasCompleteFuturesInstitutionSnapshot(snapshot, options) {
  return getFuturesSnapshotInstitutionIssues(snapshot, options).length === 0;
}

export function getFuturesSnapshotIssues(
  snapshot,
  {
    requiredContractCodes = REQUIRED_FUTURES_CONTRACT_CODES,
    minimumTechnicalHistory = 20,
  } = {},
) {
  const contracts = Array.isArray(snapshot?.['契約列表']) ? snapshot['契約列表'] : [];
  const issues = [];

  for (const code of requiredContractCodes) {
    const contract = contracts.find((item) => item?.['商品代碼'] === code);
    if (!contract) {
      issues.push(`缺少${code}契約`);
      continue;
    }

    for (const issue of getFuturesContractIssues(contract, { minimumTechnicalHistory })) {
      issues.push(`${contractLabel(contract)}：${issue}`);
    }
  }

  return issues;
}

export function hasCompleteFuturesSnapshot(snapshot, options) {
  return getFuturesSnapshotIssues(snapshot, options).length === 0;
}

export function pickFirstCompleteFuturesInstitutionSnapshot(snapshots, options) {
  return (snapshots ?? []).find((snapshot) =>
    hasCompleteFuturesInstitutionSnapshot(snapshot, options)) ?? null;
}
