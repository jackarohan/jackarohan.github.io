<script>
// js/datasources.js
(function(){
  var CFG = window.DASH_CONFIG;
  var FISCAL = 'https://api.fiscaldata.treasury.gov/services/api/fiscal_service';

  function fredLatest(series){
    var url = 'https://api.stlouisfed.org/fred/series/observations?series_id='
      + encodeURIComponent(series)
      + '&file_type=json&sort_order=desc&limit=5&api_key='
      + encodeURIComponent(CFG.fredApiKey);
    return _util.fetchJSON(url).then(function(js){
      var arr = (js && js.observations) ? js.observations : [];
      for(var i=0;i<arr.length;i++){
        var v = arr[i].value;
        if(v!=null && v!=='.' && v!=='' && !isNaN(+v)) return +v;
      }
      return null;
    });
  }

  function getRates_FRED(){
    if (CFG.fredApiKey) {
      return Promise.all([fredLatest('DGS10'), fredLatest('DFII10'), fredLatest('T10Y2Y')])
        .then(function(v){ return { dgs10:v[0], dfii10:v[1], slope:v[2] }; });
    } else {
      // legacy CSV fallback (may fail on iOS due to CORS)
      var csv = function(id){ return _util.fetchText('https://fred.stlouisfed.org/graph/fredgraph.csv?id='+id).then(_util.parseCSV); };
      return Promise.all([csv('DGS10'), csv('DFII10'), csv('T10Y2Y')]).then(function(rows){
        function pick(a){ for(var i=a.length-1;i>=0;i--){ var key=null; for(var k in a[i]) if(k!=='DATE') key=k; var v=a[i][key]; if(v && v!=='.') return +v; } return null; }
        return { dgs10: pick(rows[0]), dfii10: pick(rows[1]), slope: pick(rows[2]) };
      });
    }
  }

  function getRates_TreasuryXML(forceOffline){
    var pNom = forceOffline
      ? _util.fetchText(CFG.samples.yieldXML)
      : _util.fetchText('https://home.treasury.gov/sites/default/files/interest-rates/yield.xml', {timeout:12000})
          .catch(function(){ return _util.fetchText(CFG.samples.yieldXML); });
    var pReal = forceOffline
      ? _util.fetchText(CFG.samples.realYieldXML)
      : _util.fetchText('https://home.treasury.gov/sites/default/files/interest-rates/realyield.xml', {timeout:12000})
          .catch(function(){ return _util.fetchText(CFG.samples.realYieldXML); });

    return Promise.all([pNom,pReal]).then(function(txts){
      var n = _util.parseTreasuryXML(txts[0]);
      var r = _util.parseTreasuryXML(txts[1]);
      var n10 = +(n.BC_10YEAR || n.TCMNOMY10Y || n.BC10YEAR || 0);
      var n2  = +(n.BC_2YEAR || n.TCMNOMY2Y || n.BC2YEAR || 0);
      var r10 = +(r.BC_10YEAR || r.R_BC_10YEAR || r.TCMREAR10Y || 0);
      return { dgs10: n10, dfii10: r10, slope: (n10 && n2) ? (n10 - n2) : null };
    });
  }

  function getTP_KW(){
    return CFG.fredApiKey ? fredLatest('THREEFYTP10')
      : _util.fetchText('https://fred.stlouisfed.org/graph/fredgraph.csv?id=THREEFYTP10')
          .then(_util.parseCSV)
          .then(function(rows){ for(var i=rows.length-1;i>=0;i--){ var v=rows[i]['THREEFYTP10']; if(v && v!=='.') return +v; } return null; });
  }

  function getTP_ACM(forceOffline){
    if(forceOffline){
      return _util.fetchText(CFG.samples.acmCSV).then(_util.parseCSV).then(function(r){ var last=r[r.length-1]; return +last['ACMTP10']; });
    }
    return _util.fetchText('https://www.newyorkfed.org/research/data_indicators/term-premia-tabs',{timeout:8000})
      .then(function(page){ var m=page.match(/ACM\s*10-?year.*?([+-]?\d+\.\d+)/i); return m?+m[1]:null; })
      .catch(function(){ return null; });
  }

  function getMTS_TTM(offline){
    if(offline) return _util.fetchJSON(CFG.samples.mtsTTM);
    var t1 = _util.fetchJSON(FISCAL+'/v1/accounting/mts/mts_table_1?format=json&fields=record_date,current_month_gross_rcpt_amt,current_month_outly_amt&sort=-record_date&page[size]=18');
    var t3 = _util.fetchJSON(FISCAL+'/v1/accounting/mts/mts_table_3?format=json&fields=record_date,classification_desc,current_month_gross_outly_amt&filter='
              +encodeURIComponent('classification_desc:eq:Net Interest (Public Debt)')+'&sort=-record_date&page[size]=18');
    return Promise.all([t1,t3]).then(function(js){
      var r1 = js[0].data||[], r3 = js[1].data||[];
      var receipts = _util.sum12(r1.map(function(x){ return +x.current_month_gross_rcpt_amt||0; }));
      var outlays  = _util.sum12(r1.map(function(x){ return +x.current_month_outly_amt||0; }));
      if(r3 && r3.length>=12){
        var interest = _util.sum12(r3.map(function(x){ return +x.current_month_gross_outly_amt||0; }));
        return {receipts:receipts, outlays:outlays, interest:interest};
      }
      return _util.fetchJSON(FISCAL+'/v1/accounting/mts/mts_table_5?format=json&fields=record_date,classification_desc,current_month_net_outly_amt&filter='
                +encodeURIComponent('classification_desc:eq:Net interest')+'&sort=-record_date&page[size]=18')
        .then(function(t5){ var r5=t5.data||[]; var interest = _util.sum12(r5.map(function(x){ return +x.current_month_net_outly_amt||0; })); return {receipts:receipts, outlays:outlays, interest:interest}; });
    }).catch(function(){ return _util.fetchJSON(CFG.samples.mtsTTM); });
  }

  function getMSPD_Mix(offline){
    if(offline) return _util.fetchJSON(CFG.samples.mspdMix);
    var url = FISCAL+'/v2/accounting/od/sbp_market_outstanding?format=json&fields=record_date,security_type_desc,outstanding_amt&filter='
              +encodeURIComponent('security_type_desc:in:(Bills,Notes,Bonds,TIPS,FRNs)')+'&sort=-record_date&page[size]=100';
    return _util.fetchJSON(url).then(function(js){
      var latest = js.data && js.data[0] ? js.data[0].record_date : null;
      var rows = (js.data||[]).filter(function(r){ return r.record_date===latest; });
      var total = rows.reduce(function(s,r){ return s+(+r.outstanding_amt||0); },0);
      var by={}; rows.forEach(function(r){ by[r.security_type_desc]=+r.outstanding_amt||0; });
      if(latest && total>0) return {date:latest,total:total,by:by};
      throw new Error('v2 empty');
    }).catch(function(){
      var url2 = FISCAL+'/v1/debt/mspd/mspd_table_3_market?format=json&fields=record_date,security_type_desc,marketable_mil_amt&sort=-record_date&page[size]=200';
      return _util.fetchJSON(url2).then(function(js2){
        var latest = js2.data && js2.data[0] ? js2.data[0].record_date : null;
        var rows = (js2.data||[]).filter(function(r){ return r.record_date===latest; });
        var by={}, total=0;
        for(var i=0;i<rows.length;i++){
          var t=rows[i].security_type_desc||''; var v=(+rows[i].marketable_mil_amt||0)*1e6;
          var key=/Bill/i.test(t)?'Bills':/FRN/i.test(t)?'FRNs':/Note/i.test(t)?'Notes':/Bond/i.test(t)?'Bonds':/TIPS/i.test(t)?'TIPS':null;
          if(key){ by[key]=(by[key]||0)+v; total+=v; }
        }
        return {date:latest,total:total,by:by};
      }).catch(function(){ return _util.fetchJSON(CFG.samples.mspdMix); });
    });
  }

  window.Data = {
    getRates_FRED: getRates_FRED,
    getRates_TreasuryXML: getRates_TreasuryXML,
    getTP_KW: getTP_KW,
    getTP_ACM: getTP_ACM,
    getMTS_TTM: getMTS_TTM,
    getMSPD_Mix: getMSPD_Mix
  };
})();
</script>
