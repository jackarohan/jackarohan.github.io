// js/app.js
(function(){
  const CFG = window.DASH_CONFIG;

  let ratesSource = CFG.defaultRates; // 'FRED_JSON' | 'TREASURY'
  let offline = false;
  let dark = true;
  let charts = {};

  function set(valId, txt){ const el=document.getElementById(valId); if(el) el.textContent = txt; }
  function spin(id, on){ const el=document.getElementById(id); if(!el) return; el.classList.toggle('hidden', !on); }

  function stamp(msg){ document.getElementById('stamp').textContent = (msg||'') + ' • ' + new Date().toLocaleString(); }
  function status(txt){ document.getElementById('statusBadge').textContent = txt; }

  async function loadKPI(name, fn, setter, spinnerId){
    try{
      spin(spinnerId, true);
      const data = await fn();
      setter(data);
      spin(spinnerId, false);
      return true;
    }catch(e){
      console.error(name, e);
      setTimeout(()=>spin(spinnerId, false), 0);
      setter(null, e);
      return false;
    }
  }

  async function loadAll(){
    status('Loading…');

    // Reset values
    ['k_interest_outlays','k_interest_receipts','k_bills_share','k_rmg','k_tp_kw','k_tp_acm','k_wam','k_slope']
      .forEach(id=>set(id,'…'));

    const ok = await Promise.all([
      loadKPI('MTS',
        ()=>Data.getMTS_TTM({offline, cache:true}),
        (mts)=>{
          if(!mts){ set('k_interest_outlays','Unavailable'); set('k_interest_receipts','Unavailable'); return; }
          const io = (mts.outlays>0) ? mts.interest/mts.outlays : null;
          const ir = (mts.receipts>0) ? mts.interest/mts.receipts : null;
          set('k_interest_outlays', _util.fmtPct(io));
          set('k_interest_receipts', _util.fmtPct(ir));
          // simple bar chart with the two ratios
          try{
            const ctx = document.getElementById('ch_interest').getContext('2d');
            charts.c1?.destroy();
            charts.c1 = new Chart(ctx, { type:'bar',
              data:{ labels:['Int/Outlays','Int/Receipts'], datasets:[{label:'TTM', data:[io*100, ir*100]}] },
              options:{ plugins:{legend:{display:false}}, scales:{y:{title:{display:true,text:'%'}}} }
            });
          }catch(_){}
        }, 's_io'
      ),

      loadKPI('MSPD',
        ()=>Data.getMSPD_Mix({offline, cache:true}),
        (mix)=>{
          if(!mix){ set('k_bills_share','Unavailable'); set('k_wam','Unavailable'); return; }
          const total = mix.total||1;
          const bills = (mix.by['Bills']||0)/total, frns=(mix.by['FRNs']||0)/total;
          const notes=(mix.by['Notes']||0)/total, bonds=(mix.by['Bonds']||0)/total, tips=(mix.by['TIPS']||0)/total;
          set('k_bills_share', _util.fmtPct(bills+frns));
          const wam = bills*0.5 + frns*1.8 + notes*5.5 + bonds*20 + tips*8;
          set('k_wam', isFinite(wam) ? wam.toFixed(1)+' yrs' : 'Unavailable');

          try{
            const ctx = document.getElementById('ch_mix').getContext('2d');
            charts.c2?.destroy();
            charts.c2 = new Chart(ctx, { type:'bar',
              data:{ labels:['Bills','FRNs','Notes','Bonds','TIPS'], datasets:[{label:'Share', data:[bills*100,frns*100,notes*100,bonds*100,tips*100]}] },
              options:{ plugins:{legend:{display:false}}, scales:{y:{title:{display:true,text:'%'}}} }
            });
          }catch(_){}
        }, 's_bf'
      ),

      loadKPI('Rates',
        ()=>Data.getRates({offline, source:ratesSource, cache:true}),
        (r)=>{
          if(!r){ set('k_slope','Unavailable'); set('k_rmg','Unavailable'); return; }
          set('k_slope', _util.fmtPP(r.slope,2));
          const r10 = (r.dfii10 ?? null)/100.0;
          const rmg_pp = (r10 - CFG.g_trend) * 100;
          set('k_rmg', _util.fmtPP(rmg_pp,2));

          try{
            const ctx = document.getElementById('ch_rates').getContext('2d');
            charts.c3?.destroy();
            charts.c3 = new Chart(ctx, { type:'bar',
              data:{ labels:['Slope (pp)','10y real (%)'], datasets:[{label:'Latest', data:[r.slope, r.dfii10]}] },
              options:{ plugins:{legend:{display:false}}, scales:{y:{title:{display:true,text:'pp / %'}}} }
            });
          }catch(_){}
        }, 's_slope'
      ),

      loadKPI('KW',
        ()=>Data.getTP_KW({offline, cache:true}),
        (v)=>{ set('k_tp_kw', _util.fmtPP(v,2)); }, 's_kw'
      ),

      loadKPI('ACM',
        ()=>Data.getTP_ACM({offline, cache:true}),
        (v)=>{ set('k_tp_acm', (v==null)?'Disabled':_util.fmtPP(v,2)); }, 's_acm'
      )
    ]);

    const allOk = ok.every(Boolean);
    status(allOk ? 'OK' : 'Partial');
    stamp(`Rates=${ratesSource}${offline?' (offline)':''}`);
  }

  function wire(){
    const sel = document.getElementById('ratesSource');
    const off = document.getElementById('offline');
    const theme = document.getElementById('theme');
    const retry = document.getElementById('retryBtn');

    sel.value = ratesSource; off.checked = offline; theme.checked = dark; document.body.classList.toggle('light', !dark);
    sel.addEventListener('change', e=>{ ratesSource = e.target.value; loadAll(); });
    off.addEventListener('change', e=>{ offline = e.target.checked; loadAll(); });
    theme.addEventListener('change', e=>{ dark = e.target.checked; document.body.classList.toggle('light', !dark); });
    retry.addEventListener('click', ()=>loadAll());
  }

  wire();
  loadAll();
})();