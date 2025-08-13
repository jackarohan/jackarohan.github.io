<script>
// js/config.js
window.DASH_CONFIG = {
  g_trend: 0.018,                 // long-run real GDP trend (decimal)
  defaultRates: 'FRED',           // FRED JSON by default
  fredApiKey: '21dcbd8202ef8e0e05f91b1e8faeb417',  // your key
  preferFredJson: true,
  samples: {
    yieldXML: 'samples/yield.xml',
    realYieldXML: 'samples/realyield.xml',
    acmCSV: 'samples/acm_10y.csv',
    mtsTTM: 'samples/mts_ttm.json',
    mspdMix: 'samples/mspd_mix.json'
  }
};
</script>
