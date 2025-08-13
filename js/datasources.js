// js/datasources.js
(function(){
  const CFG = window.DASH_CONFIG;
  const FISCAL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

  // --- FRED JSON helper (CORS-friendly) ---
  async function fredLatest(series, signal){
    const url = 'https://api.stlouisfed.org/fred/series/observations?' + new URLSearchParams({
      series_id: series, file_type:'json', sort_order:'desc', limit:'5', api_key: CFG.fredApiKey
    });
    const js = await _util.fetchJSON(url, signal);
    const obs = (js.observations||[]).find(o => o.value && o.value !== '.');
    return obs ? +obs.value : null;
  }

  // --- MTS TTM (receipts/outlays/interest) ---
  async function getMTS_TTM({offline=false, cache=true}={}){
    const CK = 'mts_ttm';
    if(cache){ const c = _util.getCache(CK, CFG.cacheTTLMinutes*60*1000); if(c) return c; }

    async function live(signal){
      const t1 = await _util.fetchJSON(
        FISCAL+'/v1/accounting/mts/mts_table_1?'+new URLSearchParams({
          format:'json', fields:'record_date,current_month_gross_rcpt_amt,current_month_outly_amt', sort:'-record_date', 'page[size]':'24'
        }), signal);
      const t3 = await _util.fetchJSON(
        FISCAL+'/v1/accounting/mts/mts_table_3?'+new URLSearchParams({
          format:'json', fields:'record_date,classification_desc,current_month_gross_outly_amt', sort:'-record_date', 'page[size]':'400'
        }), signal);

      const r1 = t1.data||[];
      const rec = r1.map(x=>+x.current_month_gross_rcpt_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      const out = r1.map(x=>+x.current_month_outly_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      const niRows = (t3.data||[]).filter(r => String(r.classification_desc||'').toLowerCase().includes('net interest')
                                           && String(r.classification_desc||'').toLowerCase().includes('public debt'));
      let interest = niRows.map(x=>+x.current_month_gross_outly_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      if(!interest){
        const ie = await _util.fetchJSON(FISCAL+'/v2/accounting/od/interest_expense?'+new URLSearchParams({
          format:'json', fields:'record_date,int_expense_amt', sort:'-record_date', 'page[size]':'24'
        }), signal).catch(()=>({data:[]}));
        interest = (ie.data||[]).map(x=>+x.int_expense_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      }
      return {receipts:rec, outlays:out, interest};
    }
    async function samples(){ 
      const t1 = await _util.fetchJSON(CFG.samples.mts_table_1);
      const t3 = await _util.fetchJSON(CFG.samples.mts_table_3);
      const rec = t1.data.map(x=>+x.current_month_gross_rcpt_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      const out = t1.data.map(x=>+x.current_month_outly_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      const interest = t3.data.map(x=>+x.current_month_gross_outly_amt||0).slice(0,12).reduce((a,b)=>a+b,0);
      return {receipts:rec, outlays:out, interest};
    }

    const data = offline 
      ? await samples() 
      : await _util.withTimeout((signal)=>live(signal), 12000, 'MTS');
    if(cache) _util.setCache(CK, data);
    return data;
  }

  // --- MSPD Mix (latest, and trend series when possible) ---
  async function getMSPD_Mix({offline=false, cache=true}={}){
    const CK = 'mspd_mix';
    if(cache){ const c=_util.getCache(CK, CFG.cacheTTLMinutes*60*1000); if(c) return c; }

    async function live(signal){
      const js = await _util.fetchJSON(FISCAL+'/v2/accounting/od/sbp_market_outstanding?'+new URLSearchParams({
        format:'json', fields:'record_date,security_type_desc,outstanding_amt', sort:'-record_date', 'page[size]':'200'
      }), signal);
      const latest = js.data?.[0]?.record_date;
      const rows = (js.data||[]).filter(r=>r.record_date===latest);
      const by={}; rows.forEach(r=>by[r.security_type_desc]=(by[r.security_type_desc]||0)+(+r.outstanding_amt||0));
      const total = Object.values(by).reduce((a,b)=>a+b,0);
      return {date: latest, total, by};
    }
    async function samples(){
      const js = await _util.fetchJSON(CFG.samples.mspd);
      const latest = js.data?.[0]?.record_date;
      const rows = js.data.filter(r=>r.record_date===latest);
      const by={}; rows.forEach(r=>by[r.security_type_desc]=(by[r.security_type_desc]||0)+(+r.outstanding_amt||0));
      const total = Object.values(by).reduce((a,b)=>a+b,0);
      return {date: latest, total, by};
    }
    const data = offline ? await samples() : await _util.withTimeout(s=>live(s), 12000, 'MSPD');
    if(cache) _util.setCache(CK, data);
    return data;
  }

  // --- Rates (FRED JSON preferred; Treasury XML fallback) ---
  async function getRates({offline=false, source='FRED_JSON', cache=true}={}){
    const CK = 'rates_'+source;
    if(cache){ const c=_util.getCache(CK, CFG.cacheTTLMinutes*60*1000); if(c) return c; }

    async function fred(signal){
      const [n10, r10, slope] = await Promise.all([
        fredLatest('DGS10', signal), fredLatest('DFII10', signal), fredLatest('T10Y2Y', signal)
      ]);
      return {dgs10:n10, dfii10:r10, slope:slope};
    }
    async function treasury(signal){
      // if user provided alternative JSON URLs (self-hosted), prefer them
      if(CFG.altNominalURL && CFG.altRealURL){
        const [njs, rjs] = await Promise.all([_util.fetchJSON(CFG.altNominalURL, signal), _util.fetchJSON(CFG.altRealURL, signal)]);
        const n10 = +njs.latest10y || null, n2 = +njs.latest2y || null, r10 = +rjs.latest10y || null;
        return {dgs10:n10, dfii10:r10, slope:(n10 && n2) ? (n10 - n2) : null};
      }
      // otherwise use XML feeds (fallback)
      const xmlN = offline ? await _util.fetchText(CFG.samples.yieldXML) : await _util.fetchText('https://home.treasury.gov/sites/default/files/interest-rates/yield.xml');
      const xmlR = offline ? await _util.fetchText(CFG.samples.realYieldXML) : await _util.fetchText('https://home.treasury.gov/sites/default/files/interest-rates/realyield.xml');
      const n = _util.parseTreasuryXML(xmlN); const r = _util.parseTreasuryXML(xmlR);
      const n10 = +(n.BC_10YEAR || n.TCMNOMY10Y || 0);
      const n2  = +(n.BC_2YEAR || n.TCMNOMY2Y || 0);
      const r10 = +(r.BC_10YEAR || r.TCMREAR10Y || 0);
      return { dgs10:n10, dfii10:r10, slope:(n10 && n2) ? (n10 - n2) : null };
    }

    const data = (source==='FRED_JSON')
      ? await _util.withTimeout(s=>fred(s), 10000, 'FRED')
      : await _util.withTimeout(s=>treasury(s), 12000, 'Treasury');
    if(cache) _util.setCache(CK, data);
    return data;
  }

  // --- Term premia ---
  async function getTP_KW({offline=false, cache=true}={}){
    const CK='tp_kw'; if(cache){ const c=_util.getCache(CK, CFG.cacheTTLMinutes*60*1000); if(c) return c; }
    const v = await _util.withTimeout(s=>fredLatest('THREEFYTP10', s), 8000, 'KW');
    if(cache) _util.setCache(CK, v);
    return v;
  }

  async function getTP_ACM({offline=false, cache=true}={}){
    if(CFG.acmCSVURL){
      const rows = await _util.fetchText(CFG.acmCSVURL).then(_util.parseCSV);
      const last = rows[rows.length-1]; return +last.ACMTP10;
    }
    if(offline){
      const rows = await _util.fetchText(CFG.samples.acmCSV).then(_util.parseCSV);
      const last = rows[rows.length-1]; return +last.ACMTP10;
    }
    return null; // disabled by default
  }

  window.Data = { getMTS_TTM, getMSPD_Mix, getRates, getTP_KW, getTP_ACM };
})();