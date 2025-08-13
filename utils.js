// Utilities
const $ = sel => document.querySelector(sel);
function fmtPct(x, d=1){ if(x==null||isNaN(x)) return '—'; return (x*100).toFixed(d)+'%'; }
function fmtPP(x, d=2){ if(x==null||isNaN(x)) return '—'; return x.toFixed(d)+' pp'; }
function sum12(arr){ return arr.slice(0,12).reduce((s,x)=>s+(+x||0),0); }

async function fetchText(url, {timeout=20000}={}){
  const ctrl = new AbortController(); const to = setTimeout(()=>ctrl.abort(), timeout);
  try{ const res = await fetch(url,{signal:ctrl.signal}); if(!res.ok) throw new Error('HTTP '+res.status); return await res.text(); }
  finally{ clearTimeout(to); }
}
async function fetchJSON(url, opts){ const t = await fetchText(url, opts); try{ return JSON.parse(t); }catch(e){ throw new Error('Bad JSON at '+url); } }

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/); const hdr = lines[0].split(',');
  return lines.slice(1).map(line=>{
    const cols=[]; let cur='', q=false;
    for(let i=0;i<line.length;i++){
      const c=line[i];
      if(c==='"'){ q=!q; continue; }
      if(c===',' && !q){ cols.push(cur); cur=''; continue; }
      cur+=c;
    }
    cols.push(cur);
    const obj={}; hdr.forEach((k,i)=> obj[k]=cols[i]); return obj;
  });
}

function parseTreasuryXML(xmlText){
  const doc = new DOMParser().parseFromString(xmlText,'application/xml');
  const entries = [...doc.getElementsByTagName('entry')];
  let latest = null, t = null;
  function objectFrom(node){
    const obj={};
    node.querySelectorAll('*').forEach(el=>{
      const k=el.tagName.toUpperCase();
      if(/^BC_|^NEW_DATE$|^R_|^TCM/.test(k)) obj[k] = (el.textContent||'').trim();
    });
    return obj;
  }
  entries.forEach(e=>{
    const o = objectFrom(e); const d = o.NEW_DATE || o.DATE || o.RECORD_DATE;
    if(d){ const ts = new Date(d); if(!t || ts>t){ t=ts; latest=o; } }
  });
  if(!latest){
    const feed = doc.querySelector('feed,tbody,table') || doc;
    latest = objectFrom(feed);
  }
  return latest;
}

window._util = {fmtPct, fmtPP, sum12, fetchText, fetchJSON, parseCSV, parseTreasuryXML};
