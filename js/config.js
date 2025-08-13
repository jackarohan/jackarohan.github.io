<script>
// js/config.js
window.DASH_CONFIG = {
  g_trend: 0.018,                 // long-run real GDP trend (decimal)
  defaultRates: 'FRED',           // FRED JSON by default
  fredApiKey: "299e8ed99ca79ba973bb5ad9078beed6",  // your key
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
