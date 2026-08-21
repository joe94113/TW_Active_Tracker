# Design QA

## Scope

- Five investor centers: Self, Scanner, Official Trading, Themes, and ETF
- Daily Asia Currency Watch
- Futures, Event Stats, Broker Branches, Classroom, and Serenity
- Home, Entry Radar, Stock Detail, Tomorrow Watchlist, and Global Markets

## Visual Comparison

Each selected mock was compared side by side with a 1536 x 1080 implementation capture.

| Page | Reference | Implementation | Combined comparison | Result |
| --- | --- | --- | --- | --- |
| Scanner | `exec-99a7530f-d36d-4824-beb6-9d7015f0279f.png` | `artifacts/design-qa/scanner-viewport.png` | `artifacts/design-qa/scanner-comparison.png` | Passed |
| Entry Radar | `exec-f012b577-996a-49a8-8429-5945a49a35a0.png` | `artifacts/design-qa/entry-radar-viewport.png` | `artifacts/design-qa/entry-radar-comparison.png` | Passed |
| Stock Detail | `exec-c60352ac-3980-4e32-9540-f99e2282922b.png` | `artifacts/design-qa/stock-detail-viewport.png` | `artifacts/design-qa/stock-detail-comparison.png` | Passed |
| Home | `exec-d38e46bf-4d69-4a54-82a4-46f85be6befd.png` | `artifacts/design-qa/home-viewport.png` | `artifacts/design-qa/home-comparison.png` | Passed |
| Tomorrow Watchlist | `exec-8d22dd60-7deb-4949-9364-8c2273d59382.png` | `artifacts/design-qa/watchlist-viewport.png` | `artifacts/design-qa/watchlist-comparison.png` | Passed |
| Global Markets | `exec-f714053f-6f5e-4b41-81e6-2a43cf2c45ad.png` | `artifacts/design-qa/global-markets-viewport.png` | `artifacts/design-qa/global-markets-comparison.png` | Passed |

The implementation keeps the selected dark, compact investor dashboard direction. Historical data is intentionally labelled as historical instead of imitating the mock's current-day state.

## Responsive Checks

- Desktop checked at 1536 x 1080; all six selected pages fit without page-level horizontal overflow.
- Mobile checked at 390 x 844; all pages fit without page-level horizontal overflow.
- Dense mobile tables were reduced to decision-critical columns, with full reasoning retained in the detail panels.
- Stock charts render with visible candles, volume and indicators on desktop and mobile.

## Interaction Checks

- Scanner strategy change: passed.
- Entry Radar category change: passed.
- Add to Tomorrow Watchlist and restore original state: passed.
- Stock Detail tab change: passed.
- Tomorrow Watchlist category change: passed.
- Global Markets section change: passed.
- Browser console warnings/errors: none.

## Data Checks

- Current repository data is dated 2026-06-15, so current-day bullish/bearish calls are disabled and shown as historical review.
- Missing KRW, CNY, foreign flow or US 10Y values are not rendered as made-up numbers.
- Missing Asia currency and market context sources are listed in a short availability note.
- Currency, market, stock and institutional fields render only when a real value exists.
- Future data updates include USD/KRW, USD/CNY and US 10Y collection support.

## Center Redesign Comparison

- Selected reference: `C:\Users\user\.codex\generated_images\01a01e8a-4b9e-7a80-a264-ac1d6d4c7b20\exec-22fac8fd-d71e-476e-a247-59f0ba587f00.png`
- Final five-center first-viewport comparison: `artifacts/center-redesign-2026-08-21/design-comparison-focus-final.png`
- Full-view comparison from the previous pass: `artifacts/center-redesign-2026-08-21/design-comparison-pass-2.png`
- Final focused Scanner comparison: `artifacts/center-redesign-2026-08-21/focused-comparison-pass-4.png`
- Desktop Scanner: `artifacts/center-redesign-2026-08-21/desktop-scanner-final-neutral.png`
- Desktop ETF Center: `artifacts/center-redesign-2026-08-21/desktop-etf-final.png`
- Priority-page mobile board: `artifacts/center-redesign-2026-08-21/priority-pages-mobile-final.png`
- Core-flow mobile board: `artifacts/center-redesign-2026-08-21/core-flow-mobile-final.png`

Reference board is 1487 x 1058 px. Each implementation screen was checked at 390 x 844 CSS px and normalized to 297 x 643 px for the first-viewport comparison. Desktop checks used 1440 x 900 CSS px. The dark theme and 2026-06-15 historical-review state were kept consistent.

## Center Redesign Findings

- Pass 1 P1: global header and stale-data banner consumed the center first viewport. Fixed with a compact center header on mobile.
- Pass 1 P1: Official Trading used a wide table on mobile. Fixed with scan-friendly stock rows.
- Pass 2 P2: Scanner and ETF cards carried too much detail. Mobile cards now keep the price, change, and one decision reason.
- Pass 2 P2: Scanner cards drifted into a large green surface. Fixed with neutral cards and a thin semantic edge.
- Pass 3 P2: Scanner still showed category controls before recommendations. System Recommendation now presents the top three real candidates first.
- No remaining P0, P1, or P2 visual issues.
- Accepted P3 differences: the real empty Self Center state, real stock counts, and preservation of the product's existing bottom navigation.

## Center Interaction Checks

- Center tabs, theme toggle, legacy redirects, stock search, and ETF search: passed.
- Scanner System Recommendation opens the selected stock detail: passed.
- ETF search routes `00980A` to its real detail page: passed.
- Seventeen audited mobile pages have no page-level horizontal overflow.
- Fresh browser session across Self, Scanner, and ETF Center: zero console errors.
- Daily Asia Currency Watch shows `暫不判斷` when the historical context is incomplete.

## Verification

- `npm run build`: passed.
- `node --check scripts/lib/global-markets.mjs`: passed.
- `node --check scripts/update-data.mjs`: passed.
- `git diff --check`: passed (line-ending notices only).
- Preview remains available at `http://127.0.0.1:4178/`.

final result: passed
