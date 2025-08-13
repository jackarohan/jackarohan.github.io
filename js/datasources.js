const CFG = window.DASH_CONFIG;
const FISCAL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';
const FRED = id => `https://fred.stlouisfed.org/graph/fredgraph.csv?id=${id}`;

// --- MTS TTM (robust: Table 3 primary, Table 5 fallback for interest) ---
async function getMTS_TTM(){
  // Receipts & Outlays from Table 1 (monthly)
  const t1 = await _util.fetchJSON(`${FISCAL}/v1/accounting/mts/mts_table_1?format=json&fields=record_date,current_month_gross_rcpt_amt,current_month_outly_amt&sort=-record_date&page[size]=18`);
  const r1 = t1.data||[];
  const receipts = _util.sum12(r1.map(x=>+x.current_month_gross_rcpt_amt||0));
  const outlays  = _util.sum12(r1.map(x=>+x.current_month_outly_amt||0));

  // Net interest (Public Debt): prefer Table 3 classification; fallback to Table 5 "Net interest"
  let interest = null;

  try{
    const t3 = await _util.fetchJSON(`${FISCAL}/v1/accounting/mts/mts_table_3?format=json&fields=record_date,classification_desc,current_month_gross_outly_amt&filter=${encodeURIComponent('classification_desc:eq:Net Interest (Public Debt)')}&sort=-record_date&page[size]=18`);
    const r3 = t3.data||[];
    if(r3.length>=12){
      interest = _util.sum12(r3.map(x=>+x.current_month_gross_outly_amt||0));
    }
  }catch{ /* ignore */ }

  if(interest==null){
    const t5 = await _util.fetchJSON(`${FISCAL}/v1/accounting/mts/mts_table_5?format=json&fields=record_date,classification_desc,current_month_net_outly_amt&filter=${encodeURIComponent('classification_desc:eq:Net interest')}&sort=-record_date&page[size]=18`);
    const r5 = t5.data||[];
    interest = _util.sum12(r5.map(x=>+x.current_month_net_outly_amt||0));
  }
  return {receipts, outlays, interest};
}

// --- MSPD mix (try v2 endpoint, then fallback to v1 table_3_market) ---
async function getMSPD_Mix(){
  // Attempt v2 "sbp_market_outstanding"
  try{
    const url = `${FISCAL}/v2/accounting/od/sbp_market_outstanding?format=json&fields=record_date,security_type_desc,outstanding_amt&filter=${encodeURIComponent('security_type_desc:in:(Bills,Notes,Bonds,TIPS,FRNs)')}&sort=-record_date&page[size]=100`;
    const js = await _util.fetchJSON(url);
    const latest = js.data?.[0]?.record_date;
    const rows = (js.data||[]).filter(r=>r.record_date===latest);
    const total = rows.reduce((s,r)=>s+(+r.outstanding_amt||0),0);
    const by={}; rows.forEach(r=>by[r.security_type_desc]=+r.outstanding_amt||0);
    if(latest && total>0) return {date:latest, total, by};
  }catch{ /* try fallback */ }

  // Fallback v1 mspd table
  const url2 = `${FISCAL}/v1/debt/mspd/mspd_table_3_market?format=json&fields=record_date,security_type_desc,marketable_mil_amt&sort=-record_date&page[size]=200`;
  const js2 = await _util.fetchJSON(url2);
  const latest2 = js2.data?.[0]?.record_date;
  const rows2 = (js2.data||[]).filter(r=>r.record_date===latest2);
  const by2={}; rows2.forEach(r=>{
    const t = r.security_type_desc || r.security_class_desc || '';
    const v = +r.marketable_mil_amt*1e6 || 0;
    if(/Bills|Notes|Bonds|TIPS|FRNs/i.test(t)) by2[t.split(' ')[0]] = (by2[t.split(' ')[0]]||0) + v;
  });
  const total2 = Object.values(by2).reduce((a,b)=>a+b,0);
  return {date: latest2, total: total2, by: by2};
}

// --- Rates: FRED and Treasury XML ---
async function getRates_FRED(){
  const [dgs10, dfii10, slope] = await Promise.all([
    _util.fetchText(FRED('DGS10')),
    _util.fetchText(FRED('DFII10')),
    _util.fetchText(FRED('T10Y2Y'))
  ]).then(([a,b,c])=>[ _util.parseCSV(a), _util.parseCSV(b), _util.parseCSV(c) ]);
  const pick = rows => {
    for(let i=rows.length-1;i>=0;i--){
      const key = Object.keys(rows[i]).find(k=>k!=='DATE');
      const v = rows[i][key]; if(v && v!=='.') return +v;
    } return null;
  };
  return { dgs10: pick(dgs10), dfii10: pick(dfii10), slope: pick(slope) };
}

async function getRates_TreasuryXML(forceOffline=false){
  let xmlNom=null, xmlReal=null;
  try{
    if(forceOffline) throw new Error('offline');
    xmlNom = await _util.fetchText('https://home.treasury.gov/sites/default/files/interest-rates/yield.xml', {timeout:12000});
  }catch{ xmlNom = await _util.fetchText(CFG.samples.yieldXML); }
  try{
    if(forceOffline) throw new Error('offline');
    xmlReal = await _util.fetchText('https://home.treasury.gov/sites/default/files/interest-rates/realyield.xml', {timeout:12000});
  }catch{ xmlReal = await _util.fetchText(CFG.samples.realYieldXML); }

  const n = _util.parseTreasuryXML(xmlNom);
  const r = _util.parseTreasuryXML(xmlReal);
  const n10 = +(n.BC_10YEAR || n.TCMNOMY10Y || n.BC10YEAR || 0);
  const n2  = +(n.BC_2YEAR || n.TCMNOMY2Y || n.BC2YEAR || 0);
  const r10 = +(r.BC_10YEAR || r.R_BC_10YEAR || r.TCMREAR10Y || 0);

  return { dgs10: n10, dfii10: r10, slope: (n10 && n2) ? (n10 - n2) : null };
}

// --- Term premium ---
async function getTP_KW(){
  const csv = await _util.fetchText(FRED('THREEFYTP10'));
  const rows = _util.parseCSV(csv);
  for(let i=rows.length-1;i>=0;i--){
    const v = rows[i].THREEFYTP10; if(v && v!=='.') return +v;
  }
  return null;
}

async function getTP_ACM(forceOffline=false){
  if(forceOffline){
    // sample CSV
    const txt = await _util.fetchText(CFG.samples.acmCSV);
    const rows = _util.parseCSV(txt);
    const last = rows[rows.length-1];
    return +last.ACMTP10;
  }
  // Best-effort: try a known page (usually blocked by CORS)
  try{
    const page = await _util.fetchText('https://www.newyorkfed.org/research/data_indicators/term-premia-tabs', {timeout:8000});
    // Try to sniff a number; if not, fall through
    const m = page.match(/ACM\s*10-?year.*?([+-]?\d+\.\d+)/i);
    if(m) return +m[1];
  }catch{ /* ignore */ }
  return null;
}

window.Data = {
  getMTS_TTM, getMSPD_Mix,
  getRates_FRED, getRates_TreasuryXML,
  getTP_KW, getTP_ACM
};
