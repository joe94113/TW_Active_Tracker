# Design QA

## Scope

- Scanner option 3
- Entry Radar
- Stock Detail
- Home
- Tomorrow Watchlist
- Global Markets
- Daily Asia Currency Watch

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

## Verification

- `npm run build`: passed.
- `node --check scripts/lib/global-markets.mjs`: passed.
- `node --check scripts/update-data.mjs`: passed.
- `git diff --check`: passed (line-ending notices only).

final result: passed
