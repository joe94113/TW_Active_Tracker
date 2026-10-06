import assert from 'node:assert/strict';
import test from 'node:test';
import {
  getUsableCachedSnapshot,
  normalizeSnapshotDate,
  requireCurrentOrPastSnapshotDate,
  selectCacheFallback,
} from './etf-snapshot-policy.mjs';

test('normalizes real calendar dates and rejects impossible dates', () => {
  assert.equal(normalizeSnapshotDate('2026/9/3'), '2026-09-03');
  assert.equal(normalizeSnapshotDate('2026-02-29'), null);
  assert.equal(normalizeSnapshotDate('2026-00-01'), null);
  assert.equal(normalizeSnapshotDate('not-a-date'), null);
});

test('rejects future official data instead of relabeling it as today', () => {
  assert.throws(
    () => requireCurrentOrPastSnapshotDate('2026-10-07', '2026-10-06', '官方來源'),
    /回傳未來日期 2026-10-07/,
  );
  assert.equal(
    requireCurrentOrPastSnapshotDate('2026-10-06', '2026-10-06', '官方來源'),
    '2026-10-06',
  );
});

test('falls back to valid previous data when latest cache is future-dated', () => {
  const fallback = selectCacheFallback({
    latest: { disclosureDate: '2026-10-07', marker: 'poisoned-latest' },
    previous: { disclosureDate: '2026-10-05', marker: 'valid-previous' },
    today: '2026-10-06',
  });

  assert.equal(fallback.selected, 'previous');
  assert.equal(fallback.snapshot.marker, 'valid-previous');
  assert.equal(fallback.comparisonSnapshot, null);
});

test('ignores future cached latest when official data for today succeeds', () => {
  assert.equal(
    getUsableCachedSnapshot({ disclosureDate: '2026-10-07' }, '2026-10-06'),
    null,
  );
  assert.deepEqual(
    getUsableCachedSnapshot({ disclosureDate: '2026-10-05' }, '2026-10-06'),
    { disclosureDate: '2026-10-05' },
  );
});

test('uses an older cache only as a coherent comparison for valid latest data', () => {
  const fallback = selectCacheFallback({
    latest: { disclosureDate: '2026-10-06', marker: 'latest' },
    previous: { disclosureDate: '2026-10-05', marker: 'previous' },
    today: '2026-10-06',
  });

  assert.equal(fallback.snapshot.marker, 'latest');
  assert.equal(fallback.comparisonSnapshot.marker, 'previous');
});
