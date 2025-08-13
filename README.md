# US Debt Dashboard — v1.2.0

Client-side dashboard to track US debt service risk. No backend. Deployed via GitHub Pages.

## Features
- Interest burden ratios (TTM) from MTS
- Bills + FRNs share of marketable debt (MSPD)
- r − g using 10y real (FRED/Treasury) and a configurable growth trend
- Term premia: KW (FRED) + ACM best-effort
- Rates source toggle (FRED vs Treasury XML)
- Offline test mode using local samples
- Browser test suite (Mocha)

## Run locally
Open `index.html` directly, or serve with any static server.

## Tests
Open `tests/browser.html` in a browser. It validates XML/CSV parsing and ACM fallback.

## Deploy to GitHub Pages
Push to `main`; the included workflow `.github/workflows/pages.yml` publishes the site.

