// js/config.js
window.DASH_CONFIG = {
  g_trend: 0.018,
  defaultRates: 'FRED_JSON',
  fredApiKey: '299e8ed99ca79ba973bb5ad9078beed6', // ok to expose
  cacheTTLMinutes: 180,
  // Optional: host your own static JSON for nominal/real yields (CORS-safe)
  altNominalURL: '', // e.g., 'https://<user>.github.io/data/yield_nominal.json'
  altRealURL: '',    // e.g., 'https://<user>.github.io/data/yield_real.json'
  acmCSVURL: '',     // leave blank to keep ACM disabled
  samples: {
    mts_table_1: 'samples/mts_table_1.json',
    mts_table_3: 'samples/mts_table_3.json',
    interest_expense: 'samples/interest_expense.json',
    mspd: 'samples/mspd.json',
    yieldXML: 'samples/yield.xml',
    realYieldXML: 'samples/realyield.xml',
    acmCSV: 'samples/acm_10y.csv'
  }
};
