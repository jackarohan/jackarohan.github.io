<script>
// js/app.js
(function(){
  var CFG = window.DASH_CONFIG;
  var ratesSource = CFG.defaultRates;
  var offline = false;
  var dark = true;

  function setVal(id, txt){ var el=document.getElementById(id); if(el) el.textContent = txt; }
  function stamp(){ var el=document.getElementById('stamp'); if(el) el.textContent = 'Last refresh: '+ new Date().toLocaleString(); }

  function wire(){
    var sel = document.getElementById('ratesSource');
    var off = document.getElementById('offline');
    var theme = document.getElementById('theme');

    sel.value = ratesSource; off.checked = offline; theme.checked = dark;
    document.body.classList.toggle('light', !dark);

    sel.addEventListener('change', function(e){ ratesSource = e.target.value; load(); });
    off.addEventListener('change', function(e){ offline = e.target.checked; load(); });
    theme.addEventListener('change', function(e){ dark = e.target.checked; document.body.classList.toggle('light', !dark); });
  }

  function load(){
    ['k_interest_outlays','k_interest_receipts','k_bills_share','k_rmg','k_tp_kw','k_tp_acm','k_wam','k_slope'].forEach(function(id){ setVal(id,'…'); });

    Promise.all([ Data.getMTS_TTM(offline), Data.getMSPD_Mix(offline) ]).then(function(v){
      var mts=v[0], mix=v[1];
      var io = (mts.outlays>0)? (mts.interest/mts.outlays):null;
      var ir = (mts.receipts>0)? (mts.interest/mts.receipts):null;
      setVal('k_interest_outlays', _util.fmtPct(io,1));
      setVal('k_interest_receipts', _util.fmtPct(ir,1));

      var total = mix.total||1;
      var bills = (mix.by['Bills']||0)/total, frns = (mix.by['FRNs']||0)/total;
      setVal('k_bills_share', _util.fmtPct(bills+frns,1));
      var wam = bills*0.5 + frns*1.8 + ((mix.by['Notes']||0)/total)*5.5 + ((mix.by['Bonds']||0)/total)*20 + ((mix.by['TIPS']||0)/total)*8;
      setVal('k_wam', isFinite(wam) ? wam.toFixed(1)+' yrs' : '—');

      var pRates = (ratesSource==='TREASURY') ? Data.getRates_TreasuryXML(offline) : Data.getRates_FRED();
      pRates.then(function(rates){
        var r = (rates.dfii10!=null) ? (rates.dfii10/100.0) : null;
        var g = CFG.g_trend, rmg_pp = (r!=null)? ((r-g)*100.0):null;
        setVal('k_rmg', _util.fmtPP(rmg_pp,2));
        setVal('k_slope', _util.fmtPP(rates.slope,2));
        setVal('chart_rates', '10y nominal '+(rates.dgs10!=null?rates.dgs10.toFixed(2)+'%':'—')+' | 10y real '+(rates.dfii10!=null?rates.dfii10.toFixed(2)+'%':'—')+' | slope '+_util.fmtPP(rates.slope,2));
      }).catch(function(){ setVal('k_rmg','—'); setVal('k_slope','—'); });

      Data.getTP_KW().then(function(kw){ setVal('k_tp_kw', _util.fmtPP(kw,2)); }).catch(function(){ setVal('k_tp_kw','—'); });
      Data.getTP_ACM(offline).then(function(acm){ setVal('k_tp_acm', acm==null ? 'Unavailable' : _util.fmtPP(acm,2)); }).catch(function(){ setVal('k_tp_acm','Unavailable'); });

      setVal('chart_interest','TTM interest/outlays: '+_util.fmtPct(io,1)+' | interest/receipts: '+_util.fmtPct(ir,1));
      setVal('chart_mix','Mix: Bills '+(bills*100).toFixed(1)+'%, FRNs '+(frns*100).toFixed(1)+'%, Notes '+(((mix.by['Notes']||0)/total)*100).toFixed(1)+'%, Bonds '+(((mix.by['Bonds']||0)/total)*100).toFixed(1)+'%, TIPS '+(((mix.by['TIPS']||0)/total)*100).toFixed(1)+'%');

      stamp();
    }).catch(function(err){ setVal('chart_interest','Load failed. '+(err&&err.message?err.message:'')); stamp(); });
  }

  wire(); load();
})();
</script>
