# US Debt Dashboard — v1.4.0

**What changed**
- Fixed JS files that previously had `<script>` tags inside (breaking execution).
- Switched rates to **FRED JSON API** with API key (CORS-friendly).
- Full offline coverage for **MTS** and **MSPD** using sample JSONs.
- Per‑KPI error handling: each metric loads independently and shows “Unavailable” if it fails.
- Added **localStorage cache** with TTL (default 180 min): values render fast from cache and refresh in background.
- Added light **Chart.js** visuals (bar charts) for interest ratios, mix, and rates.
- Responsive layout and doc links.

**Setup**
1. Edit `js/config.js`:
   - `fredApiKey`: keep your FRED key.
   - Optional: set `altNominalURL` and `altRealURL` to self-hosted JSON mirrors of Treasury yields (to avoid XML/CORS).
   - Leave `acmCSVURL` blank to keep ACM disabled (no scraping).
2. Deploy via GitHub Pages. Use the included workflow under `.github/workflows/pages.yml`.
3. Toggle **Offline test** to validate the UI even with no network.

**Data**
- MTS (Table 1, Table 3; Interest Expense fallback).
- MSPD (marketable outstanding by security type).
- FRED (DGS10, DFII10, T10Y2Y, THREEFYTP10).

**Notes**
- If your network blocks `api.fiscaldata.treasury.gov`, offline mode or a proxy is your safety net.
- ACM term premium is **off** unless you supply a CSV URL in `config.js`.
