import zipfile, re, io, os
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
def txt(zb):
    z=zipfile.ZipFile(io.BytesIO(zb)) if isinstance(zb,bytes) else zipfile.ZipFile(zb); out=''
    for n in z.namelist():
        if n.startswith('word/') and n.endswith('.xml') or n.startswith('xl/') and n.endswith('.xml'):
            out+=re.sub(r'<[^>]+>','',z.read(n).decode('utf8','ignore'))+'\n'
    return out
ok=lambda c,m: print(('  ok  ' if c else '  FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000}, accept_downloads=True, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append('PAGEERR '+str(e)))
    pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'TUNNEL' not in m.text and 'Failed to load' not in m.text else None)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.click('[data-xdest="JPN"]')
    pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    pg.click('#xCons summary')
    for k,v in {'ex.nf':'8941','ex.dued':'26BR1-1','ex.mawb':'074-1','ex.voo':'KL0792','ex.dep':'2026-11-06T22:30','ex.gta':'123456','ex.serie':'AM','ex.lpcoMapa':'E2600665213','ex.lpcoIbama':'E26006','conv.rate':'5.5','cons.name':'FAR EAST ENTERPRISE NOVO INC'}.items(): pg.fill(f'[data-xp="{k}"]',v)
    ok('-1/SEV-GRU' in pg.inner_text('#xCert') and '-2/SEV-GRU' in pg.inner_text('#xCert'),'LPCO Japão -1 / -2')
    with pg.expect_download() as d: pg.click('[data-xa="zip"]')
    path=OUT+'jpn.zip'; d.value.save_as(path); z=zipfile.ZipFile(path); names=z.namelist(); print(names)
    ok(len(names)==9, '9 arquivos Japão (inv, brl, pl, et, 3 at, 2 czi) = %d'%len(names))
    for n in names:
        if n.endswith('docx') or n.endswith('xlsx'):
            t=txt(z.read(n)); 
            if 'ETIQ' in n: ok('FAR EAST ENTERPRISE NOVO INC' in t and 'E26006' in t,'etiquetas: consignee editado + LPCO IBAMA')
            if 'CZI_JAPAO' in n: ok('E2600665213-1/SEV-GRU' in t,'CZI JP -1'); ok('018' in t,'CZI nº 018')
            if 'ALEMANHA' in n: ok('E2600665213-2/SEV-GRU' in t,'CZI DE -2'); ok('NOVO' in t,'CZI DE consignee editado')
            if n.startswith('INVOICE_018.2026.xlsx'): ok('NOVO' in t and '4147' in t.replace(',','').replace('.','')[:0]+t.replace(',',''),'invoice ok')
    # número avançou
    ok(pg.evaluate("PP.exp.cfg().last")==18,'sequência avançou para 018')
    pg.click('[data-xa="novo"]') if False else None
    # nova exportação AMS
    pg.evaluate("PP.exp.state()"); pg.click('[data-xa="novo"]'); pg.wait_for_timeout(200)
    ok('019/2026' in pg.inner_text('.xbig'),'próxima = 019/2026')
    pg.click('[data-xdest="AMS"]'); pg.set_input_files('#xFile','test/exp/stocklist_miami.xlsx'); pg.wait_for_timeout(1200)
    pg.click('#xCons summary') if not pg.evaluate("document.getElementById('xCons').open") else None
    ok(pg.input_value('[data-xp="cons.name"]')=='RUINEMANS GROUP','AMS consignee')
    ok(pg.input_value('[data-xp="cons.name"]')!='FAR EAST ENTERPRISE NOVO INC','consignee de Japão não vaza')
    # PTAX offline
    pg.click('[data-xa="ptax"]'); pg.wait_for_timeout(1500); print('   ptax msg:', pg.inner_text('#xPtmsg'))
    # histórico/numeração
    pg.click('[data-xa="save"]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("PP.exp.cfg().last")==19 and len(pg.evaluate("PP.exp.hist()"))==2,'salvou AMS 019, histórico 2')
    pg.keyboard.press('Escape'); pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(300)
    pg.evaluate("document.getElementById('xNum').open=true"); pg.wait_for_timeout(100)
    pg.fill('#xLast','25'); pg.dispatch_event('#xLast','change'); pg.wait_for_timeout(200)
    ok('026/2026' in pg.inner_text('#xNum'),'ajuste manual: próxima 026')
    pg.fill('#xLast','19'); pg.dispatch_event('#xLast','change')
    # roteiro persistente
    pg.click('#nav button[data-view="exp"]'); pg.click('[data-xa="rot"]'); pg.click('[data-xst="inv:o"]'); pg.click('[data-xst="pl:r"]'); pg.wait_for_timeout(200)
    pg.click('[data-xnote="inv"]'); pg.fill('[data-xnt="inv"]','conferido 14:10')
    ok('1 OK' in pg.inner_text('#vExp') and '1 refazer' in pg.inner_text('#vExp'),'roteiro conta 1 OK 1 refazer')
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(200)
    if pg.locator('[data-xa="vrot"]').count(): pg.click('[data-xa="vrot"]'); pg.wait_for_timeout(200)
    ok('1 OK' in pg.inner_text('#vExp'),'roteiro persiste após recarregar (rascunho)')
    ok(pg.evaluate("PP.exp.hist()[1].rot.nt.inv")=='conferido 14:10' or pg.evaluate("JSON.stringify(PP.exp.hist().map(e=>e.rot.nt))").find('14:10')>=0,'nota salva no histórico')
    # abrir do histórico
    pg.keyboard.press('Escape'); pg.evaluate("PP.exp.openEntry(PP.exp.hist()[0].id)"); pg.wait_for_timeout(300)
    print('   aberto:', pg.inner_text('.xbig'))
    # backup contém
    ok(pg.evaluate("!!PP.snapshot().exphist && PP.snapshot().exphist.length==2"),'backup leva exphist')
    pg.set_viewport_size({'width':420,'height':900}); pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(300)
    ok(pg.evaluate("document.documentElement.scrollWidth<=window.innerWidth+2"),'mobile sem rolagem horizontal da página')
    pg.screenshot(path=OUT+'mobile.png')
    print('errs',errs)
    b.close()
