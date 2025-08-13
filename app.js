(function(){
  const CFG = window.DASH_CONFIG;
  let ratesSource = CFG.defaultRates;
  let offline = false;
  let dark = true;

  function stamp(){ document.getElementById('stamp').textContent = 'Last refresh: '+ new Date().toLocaleString(); }

  async function load(){
    // clear
    ['k_interest_outlays','k_interest_receipts','k_bills_share','k_rmg','k_tp_kw','k_tp_acm','k_wam','k_slope'].forEach(id=>document.getElementById(id).textContent='…');
    try{
      const [mts, mix] = await Promise.all([
        Data.getMTS_TTM(),
        Data.getMSPD_Mix()
      ]);

      // Ratios
      const io = (mts.outlays>0)? (mts.interest/mts.outlays) : null;
      const ir = (mts.receipts>0)? (mts.interest/mts.receipts) : null;
      document.getElementById('k_interest_outlays').textContent = _util.fmtPct(io);
      document.getElementById('k_interest_receipts').textContent = _util.fmtPct(ir);

      // Mix & WAM proxy
      const total = mix.total||1;
      const bills = (mix.by['Bills']||0)/total;
      const frns  = (mix.by['FRNs']||0)/total;
      document.getElementById('k_bills_share').textContent = _util.fmtPct(bills+frns);
      const wam = bills*0.5 + frns*1.8 + (mix.by['Notes']||0)/total*5.5 + (mix.by['Bonds']||0)/total*20 + (mix.by['TIPS']||0)/total*8;
      document.getElementById('k_wam').textContent = isFinite(wam) ? wam.toFixed(1)+' yrs' : '—';

      // Rates
      const rates = (ratesSource==='TREASURY')
        ? await Data.getRates_TreasuryXML(offline)
        : await Data.getRates_FRED();

      const r = (rates.dfii10 ?? null)/100.0; // percent -> decimal
      const g = CFG.g_trend;
      const rmg_pp = (r - g)*100; // percentage points
      document.getElementById('k_rmg').textContent = _util.fmtPP(rmg_pp, 2);
      document.getElementById('k_slope').textContent = _util.fmtPP(rates.slope, 2);

      // Term premia
      const kw = await Data.getTP_KW();
      document.getElementById('k_tp_kw').textContent = _util.fmtPP(kw, 2);
      const acm = await Data.getTP_ACM(offline);
      document.getElementById('k_tp_acm').textContent = (acm==null) ? 'Unavailable' : _util.fmtPP(acm, 2);

      // minimal text “charts”
      document.getElementById('chart_interest').textContent = `TTM interest/outlays: ${_util.fmtPct(io)} | interest/receipts: ${_util.fmtPct(ir)}`;
      document.getElementById('chart_mix').textContent = `Mix: Bills ${(bills*100).toFixed(1)}%, FRNs ${(frns*100).toFixed(1)}%, Notes ${(((mix.by['Notes']||0)/total)*100).toFixed(1)}%, Bonds ${(((mix.by['Bonds']||0)/total)*100).toFixed(1)}%, TIPS ${(((mix.by['TIPS']||0)/total)*100).toFixed(1)}%`;
      document.getElementById('chart_rates').textContent = `10y nominal ${rates.dgs10?.toFixed?.(2)??'—'}% | 10y real ${rates.dfii10?.toFixed?.(2)??'—'}% | slope ${_util.fmtPP(rates.slope,2)}`;

      stamp();
    }catch(e){
      console.error(e);
      document.getElementById('chart_interest').textContent = 'Load failed. See console.';
    }
  }

  function wire(){
    const sel = document.getElementById('ratesSource');
    const off = document.getElementById('offline');
    const theme = document.getElementById('theme');

    sel.value = ratesSource;
    off.checked = offline;
    theme.checked = dark;
    document.body.classList.toggle('light', !dark);

    sel.addEventListener('change', e=>{ ratesSource = e.target.value; load(); });
    off.addEventListener('change', e=>{ offline = e.target.checked; load(); });
    theme.addEventListener('change', e=>{ dark = e.target.checked; document.body.classList.toggle('light', !dark); });
  }

  wire();
  load();
})();