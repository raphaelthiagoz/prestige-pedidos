from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':1000},service_workers='block',accept_downloads=True).new_page()
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("""()=>{
      PP.S.clientes=[{id:'c1',nome:'MICHELE APARECIDA',aero:'CNF',cidade:'BELO HORIZONTE/MG'},{id:'c2',nome:'CLIENTE NOVO',aero:'',cidade:''}];PP.saveClientes();
      PP.S.embarques=[{id:'e1',titulo:'T',saida:PP.Features.todayISO(),chegadaPrev:PP.Features.todayISO(),linhas:[
        {id:'a',cliente:'MICHELE APARECIDA',aero:'',cidade:'',caixas:12,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''}]}];PP.store.set('embarques',PP.S.embarques);}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="embarque"]'); pg.wait_for_timeout(500)
    aero=lambda: pg.locator('#emTb tbody tr').first.locator('[data-lf=aero]')
    cad=lambda: pg.evaluate("PP.S.clientes[0].aero")
    ok('Falta o aeroporto de MICHELE' in pg.inner_text('#emDest'),'aeroporto vazio: avisa que falta e sugere CNF'); pg.click('#emDest [data-em=dfix]'); pg.wait_for_timeout(300); ok(aero().input_value()=='CNF' and pg.locator('#emDest .alert').count()==0,'"Preencher com CNF" resolve')
    aero().fill('GRU'); pg.wait_for_timeout(300)
    t=pg.inner_text('#emDest'); ok('Confira o destino de MICHELE APARECIDA' in t and 'CNF' in t and 'GRU' in t,'digitar GRU para quem é CNF: aparece o aviso com os dois aeroportos')
    ok(cad()=='CNF','o cadastro NÃO é trocado em silêncio para GRU')
    pg.screenshot(path='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/dest_aviso.png',clip={'x':260,'y':150,'width':1100,'height':420})
    pg.click('#emDest [data-em=dfix]'); pg.wait_for_timeout(300)
    ok(aero().input_value()=='CNF' and pg.locator('#emDest .alert').count()==0,'"Trocar para CNF" corrige a linha e some o aviso')
    aero().fill('GRU'); pg.wait_for_timeout(300); pg.click('#emDest [data-em=dok]'); pg.wait_for_timeout(300)
    ok(pg.locator('#emDest .alert').count()==0 and cad()=='CNF','"Está certo: é GRU hoje" tira o aviso e mantém o cadastro em CNF')
    aero().fill('POA'); pg.wait_for_timeout(300); ok(pg.locator('#emDest .alert').count()==1,'outro destino depois de confirmar volta a avisar')
    msgs=[]
    def no(d): msgs.append(d.message); d.dismiss()
    pg.once('dialog',no); pg.click('[data-em=docx]'); pg.wait_for_timeout(600)
    ok(msgs and 'MICHELE APARECIDA' in msgs[0] and 'CNF' in msgs[0],'gerar o .docx com destino duvidoso pergunta antes (mostra o cliente e o esperado)')
    pg.once('dialog',lambda d:d.accept())
    with pg.expect_download(timeout=8000) as dl: pg.click('[data-em=docx]')
    ok(dl.value.suggested_filename.endswith('.docx'),'aceitando o aviso, o .docx é gerado')
    pg.click('#emDest [data-em=dcad]'); pg.wait_for_timeout(300)
    ok(cad()=='POA' and pg.locator('#emDest .alert').count()==0,'"Está certo e atualizar o cadastro" grava POA no cadastro')
    pg.evaluate("""()=>{const e=PP.S.embarques[0];e.linhas.push({id:'n',cliente:'CLIENTE NOVO',aero:'',cidade:'',caixas:3,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''});PP.store.set('embarques',PP.S.embarques);}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="embarque"]'); pg.wait_for_timeout(500)
    pg.locator('#emTb tbody tr').nth(1).locator('[data-lf=aero]').fill('SLZ'); pg.wait_for_timeout(300)
    ok('Confirma que o destino de CLIENTE NOVO é SLZ' in pg.inner_text('#emDest'),'cliente sem aeroporto no cadastro: pede confirmação')
    pg.click('#emDest [data-em=dconf]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.clientes[1].aero")=='SLZ' and pg.locator('#emDest .alert').count()==0,'confirmar guarda SLZ no cadastro')
    b.close()
print('TUDO OK' if not fails else 'FALHAS: %d'%len(fails))
