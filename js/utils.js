// js/utils.js
const $ = sel => document.querySelector(sel);
const $$ = sel => Array.from(document.querySelectorAll(sel));

function fmtPct(x,d=1){ if(x==null||!isFinite(x)) return 'Unavailable'; return (x*100).toFixed(d)+'%'; }
function fmtPP(x,d=2){ if(x==null||!isFinite(x)) return 'Unavailable'; return x.toFixed(d)+' pp'; }

function sleep(ms){ return new Promise(r=>setTimeout(r,ms)); }
function withTimeout(promise, ms, label=''){ 
  const ctrl = new AbortController();
  const t = setTimeout(()=>ctrl.abort(), ms);
  return Promise.race([
    promise(ctrl.signal),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error('Timeout '+label)), ms+10))
  ]).finally(()=>clearTimeout(t));
}

async function fetchText(url, signal){ 
  const res = await fetch(url,{signal,mode:'cors'}); 
  if(!res.ok) throw new Error('HTTP '+res.status+' '+url); 
  return res.text(); 
}
async function fetchJSON(url, signal){ 
  const res = await fetch(url,{signal,mode:'cors'}); 
  if(!res.ok) throw new Error('HTTP '+res.status+' '+url); 
  return res.json(); 
}

function parseCSV(text){
  const lines = text.trim().split(/\r?\n/); const hdr = lines[0].split(',');
  return lines.slice(1).map(line=>{
    const cols=[]; let cur='', q=false;
    for(const ch of line){
      if(ch==='"'){ q=!q; continue; }
      if(ch===',' && !q){ cols.push(cur); cur=''; continue; }
      cur+=ch;
    }
    cols.push(cur);
    const row={}; hdr.forEach((k,i)=>row[k]=cols[i]); return row;
  });
}

function parseTreasuryXML(xml){
  const doc=new DOMParser().parseFromString(xml,'application/xml');
  const entries=[...doc.getElementsByTagName('entry')];
  const grab=n=>{ const o={}; n.querySelectorAll('*').forEach(k=>{ const t=k.tagName.toUpperCase(); if(/^BC_|^NEW_DATE$|^R_|^TCM/.test(t)) o[t]=(k.textContent||'').trim();}); return o;};
  let best=null, ts=null;
  entries.forEach(en=>{ const o=grab(en); const d=o.NEW_DATE||o.DATE||o.RECORD_DATE; if(d){const t=new Date(d); if(!ts||t>ts){ts=t; best=o;}}});
  if(!best) best = grab(doc);
  return best;
}

// ---- localStorage cache ----
function now(){ return Date.now(); }
function setCache(k, data){ try{ localStorage.setItem(k, JSON.stringify({t:now(), data})); }catch(_){ } }
function getCache(k, ttlMs){ 
  try{ const raw=localStorage.getItem(k); if(!raw) return null; const o=JSON.parse(raw); if(now()-o.t > ttlMs) return null; return o.data; }catch(_){ return null; }
}

window._util = { fmtPct, fmtPP, withTimeout, fetchText, fetchJSON, parseCSV, parseTreasuryXML, setCache, getCache };
