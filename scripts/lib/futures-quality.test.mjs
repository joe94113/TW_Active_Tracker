import assert from 'node:assert/strict';
import test from 'node:test';

import {
  getFuturesContractIssues,
  getFuturesInstitutionIssues,
  getFuturesSnapshotInstitutionIssues,
  getFuturesSnapshotIssues,
  hasCompleteFuturesInstitutionData,
  hasCompleteFuturesSnapshot,
  pickFirstCompleteFuturesInstitutionSnapshot,
} from './futures-quality.mjs';

function institution(identity, { tradeNet = 0, openInterestNet = 0 } = {}) {
  return {
    身份別: identity,
    交易淨口數: tradeNet,
    未平倉淨口數: openInterestNet,
  };
}

function contract(code, overrides = {}) {
  return {
    商品代碼: code,
    契約名稱: code === 'MXF' ? '小型臺指期貨' : '微型臺指期貨',
    法人資料: [
      institution('自營商'),
      institution('投信'),
      institution('外資'),
    ],
    技術面資料: { 歷史資料: Array.from({ length: 20 }, (_, index) => ({ date: `day-${index}` })) },
    ...overrides,
  };
}

function snapshot(date, contracts) {
  return { 資料日期: date, 契約列表: contracts };
}

test('accepts zero net positions and ignores unrelated summary rows', () => {
  const candidate = contract('MXF');
  candidate.法人資料.push(institution('合計', { tradeNet: null, openInterestNet: null }));

  assert.equal(hasCompleteFuturesInstitutionData(candidate), true);
  assert.deepEqual(getFuturesInstitutionIssues(candidate), []);
});

test('rejects a required identity row whose open-interest value is not finalized', () => {
  for (const invalidValue of [null, undefined, Number.NaN, '0']) {
    const candidate = contract('MXF');
    candidate.法人資料[2].未平倉淨口數 = invalidValue;

    assert.equal(hasCompleteFuturesInstitutionData(candidate), false);
    assert.deepEqual(getFuturesInstitutionIssues(candidate), ['外資.未平倉淨口數不是有效數字']);
  }
});

test('rejects a required identity row whose trading value is not finalized', () => {
  const candidate = contract('MXF');
  candidate.法人資料[0].交易淨口數 = null;

  assert.deepEqual(getFuturesInstitutionIssues(candidate), ['自營商.交易淨口數不是有效數字']);
});

test('rejects a contract that is missing one of the required identities', () => {
  const candidate = contract('MXF');
  candidate.法人資料 = candidate.法人資料.filter((item) => item.身份別 !== '投信');

  assert.deepEqual(getFuturesInstitutionIssues(candidate), ['缺少投信']);
});

test('selects the previous complete date when the latest snapshot is partial', () => {
  const partialMxf = contract('MXF');
  partialMxf.法人資料[0].未平倉淨口數 = null;
  const latest = snapshot('2026-09-16', [partialMxf, contract('TMF')]);
  const previous = snapshot('2026-09-15', [contract('MXF'), contract('TMF')]);

  assert.equal(pickFirstCompleteFuturesInstitutionSnapshot([latest, previous]), previous);
});

test('reports missing contracts and insufficient technical history', () => {
  const incompleteHistory = contract('MXF', { 技術面資料: { 歷史資料: Array(19).fill({}) } });

  assert.deepEqual(getFuturesSnapshotInstitutionIssues(snapshot('2026-09-16', [incompleteHistory])), ['缺少TMF契約']);
  assert.deepEqual(getFuturesContractIssues(incompleteHistory), ['技術歷史僅 19 筆']);
  assert.deepEqual(
    getFuturesSnapshotIssues(snapshot('2026-09-16', [incompleteHistory, contract('TMF')])),
    ['MXF：技術歷史僅 19 筆'],
  );
  assert.equal(hasCompleteFuturesSnapshot(snapshot('2026-09-16', [incompleteHistory, contract('TMF')])), false);
  assert.equal(
    hasCompleteFuturesSnapshot(snapshot('2026-09-16', [contract('MXF'), contract('TMF')])),
    true,
  );
});
