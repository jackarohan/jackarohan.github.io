describe('Parsers & fallbacks', () => {
  it('parseTreasuryXML reads sample nominal yields', async () => {
    const txt = await _util.fetchText('../samples/yield.xml');
    const obj = _util.parseTreasuryXML(txt);
    expect(+obj.BC_10YEAR).to.be.closeTo(4.29, 1e-6);
    expect(+obj.BC_2YEAR).to.be.closeTo(3.78, 1e-6);
  });

  it('getRates_TreasuryXML(true) uses samples and computes slope', async () => {
    const r = await Data.getRates_TreasuryXML(true);
    expect(r.dgs10).to.be.closeTo(4.29, 1e-6);
    expect(r.dfii10).to.be.closeTo(1.87, 1e-6);
    expect(r.slope).to.be.closeTo(0.51, 0.01);
  });

  it('ACM fallback returns last sample value', async () => {
    const v = await Data.getTP_ACM(true);
    expect(v).to.be.closeTo(0.68, 1e-6);
  });

  it('CSV parser handles quotes and commas', () => {
    const csv = 'DATE,VAL\n2025-01-01,"1,234.5"\n';
    const rows = _util.parseCSV(csv);
    expect(rows[0].VAL).to.equal('1,234.5');
  });
});
