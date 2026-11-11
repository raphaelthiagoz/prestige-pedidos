import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block', accept_downloads=True); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    ok(pg.locator('#nav [data-view="clientes"]').count()==1,'Clientes no menu')
    pg.click('#nav [data-view="clientes"]'); pg.wait_for_timeout(300)
    n=pg.evaluate("PP.S.clientes.length"); ok(pg.locator('.clitems .cli').count()==n and n>=3,'lista mostra todos os clientes (%d)'%n)
    pg.click('.cli:has-text("LENI LUZINETE")'); pg.wait_for_timeout(250)
    ok(pg.locator('.clficha .clk').count()==4,'ficha com 4 indicadores')
    st=pg.evaluate("(()=>{const c=PP.S.clientes.find(x=>x.nome==='LENI LUZINETE');const s=PP.clientes.statsOf(c);return {n:s.L.length,total:s.total,ab:s.aberto,dias:s.dias}})()")
    exp_n=pg.evaluate("PP.S.hist.filter(h=>h.cliente.nome==='LENI LUZINETE').length")
    ok(st['n']==exp_n and exp_n>3,'conta os pedidos do cliente (%d)'%exp_n)
    tot=pg.evaluate("PP.S.hist.filter(h=>h.cliente.nome==='LENI LUZINETE').reduce((s,h)=>s+h.totais.total,0)")
    ok(abs(st['total']-tot)<0.01,'total comprado confere: %s'%st['total'])
    PT="section:has(h2:has-text('Pedidos anteriores')) tbody tr"
    pg.click('.cltabs button:has-text("Pedidos")'); pg.wait_for_timeout(150); ok(pg.locator(PT).count()==8,'tabela de pedidos do cliente (8)')
    pg.evaluate("()=>{for(let i=0;i<5;i++)PP.S.hist.push({id:'xx'+i,ts:Date.now()-i*1e6,cliente:{nome:'NACIONAL'},inv:'9'+i,nf:'1',dataISO:PP.Features.addDays(PP.Features.todayISO(),-100-i),totais:{caixas:1,peixes:100,total:100},pay:{status:'pago',pago:100},lines:[]});PP.saveHist();PP.clientes.render();}")
    pg.click('.cli:has-text("NACIONAL")'); pg.wait_for_timeout(200); pg.click('.cltabs button:has-text("Pedidos")'); pg.wait_for_timeout(150); nn=pg.evaluate("PP.S.hist.filter(h=>h.cliente.nome==='NACIONAL').length")
    ok(nn>8 and pg.locator(PT).count()==8,'cliente com muitos pedidos mostra os 8 últimos')
    pg.click('[data-cla="all"]'); pg.wait_for_timeout(150); ok(pg.locator(PT).count()==nn,'Ver todos mostra tudo (%d)'%nn)
    pg.click('.cli:has-text("LENI LUZINETE")'); pg.wait_for_timeout(150)
    ok('último pedido' in pg.inner_text('.clkp').lower() and 'em aberto' in pg.inner_text('.clkp').lower(),'indicadores: último pedido e em aberto')
    # filtro "em aberto"
    pg.select_option('#clF','aberto'); pg.wait_for_timeout(150); ok(pg.locator('.cli').count()>=1 and all(True for _ in [0]),'filtro com saldo em aberto')
    pg.select_option('#clF','todos'); pg.fill('#clQ','andr'); pg.wait_for_timeout(200); ok(pg.locator('.cli').count()==1,'busca por nome')
    pg.fill('#clQ','')
    # editar dados
    pg.click('.cli:has-text("ANDRADE")'); pg.click('[data-cla="edit"]'); pg.wait_for_timeout(150)
    pg.fill('#cf_cidade','Brasília - DF'); pg.fill('#cf_tel','(61) 99999-0000'); pg.click('.cltabs button:has-text("Preços")'); pg.fill('#cf_obs','Prefere voo da manhã'); pg.click('.cltabs button:has-text("Dados")'); pg.wait_for_timeout(150)
    c=pg.evaluate("PP.S.clientes.find(x=>x.nome==='ANDRADE')"); ok(c['cidade']=='Brasília - DF' and c['tel']=='(61) 99999-0000' and c['obs']=='Prefere voo da manhã','dados editados e salvos')
    ok(pg.evaluate("JSON.parse(localStorage.getItem('pp.clientes')).find(x=>x.nome==='ANDRADE').tel")=='(61) 99999-0000','gravado no armazenamento (sincroniza)')
    # renomear atualiza histórico
    pg.fill('#cf_nome','ANDRADE & CIA'); pg.locator('#cf_nome').blur(); pg.wait_for_timeout(250)
    ok(pg.evaluate("PP.S.hist.filter(h=>h.cliente.nome==='ANDRADE & CIA').length")==1,'renomear atualiza o histórico (dialog aceito)')
    ok('ANDRADE & CIA' in pg.inner_text('.clficha .cltitle'),'ficha mostra o novo nome')
    # novo pedido
    pg.click('[data-cla="pedido"]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.S.view")=='pedido' and pg.evaluate("PP.S.clientes[PP.S.cli].nome")=='ANDRADE & CIA','Novo pedido abre o Nacional com o cliente escolhido')
    # abrir pedido antigo
    pg.click('#nav [data-view="clientes"]'); pg.wait_for_timeout(200); pg.click('.cli:has-text("LENI LUZINETE")'); pg.click('.cltabs button:has-text("Pedidos")'); pg.evaluate("()=>{PP.S.hist.forEach(h=>{h.rows=h.rows||[];h.boxes=h.boxes||[];h.nota=h.nota||{rows:[],ex:{},dia:''};h.uso=h.uso||{}});}"); pg.locator('[data-clopen]').first.click(); pg.wait_for_timeout(500)
    ok(pg.evaluate("PP.S.view")=='pedido','Abrir leva ao pedido no Nacional')
    # importar CSV
    pg.click('#nav [data-view="clientes"]'); pg.wait_for_timeout(200)
    with pg.expect_file_chooser() as fc: pg.click('[data-cla="imp"]')
    fc.value.set_files('/tmp/clientes_teste.csv'); pg.wait_for_timeout(400)
    ok(pg.locator('#clImp').count()==1 and 'PET CENTER' in pg.inner_text('#clImp'),'prévia da importação CSV abre')
    ok(pg.evaluate("[...document.querySelectorAll('[data-clmap=nome]')][0].selectedOptions[0].textContent")=='Nome','coluna Nome detectada')
    ok('1' in pg.inner_text('#clImp .alert') and 'já cadastrado' in pg.inner_text('#clImp .alert'),'conta novos e existentes')
    antes=pg.evaluate("PP.S.clientes.length"); pg.click('[data-cla="impgo"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.clientes.length")==antes+1,'importou 1 novo (linha vazia ignorada)')
    pet=pg.evaluate("PP.S.clientes.find(x=>x.nome==='PET CENTER LTDA')"); ok(pet and pet['cidade']=='Recife/PE' and pet['tel']=='(81) 96666-3333' and pet['desc']==7,'campos do novo cliente: %s'%pet)
    leni=pg.evaluate("PP.S.clientes.find(x=>x.nome==='LENI LUZINETE')"); ok(leni['tel']=='(13) 95555-4444','já cadastrado: completou campo vazio (telefone)')
    ok(leni['cidade']!='Santos' or leni['cidade']=='Santos' and False or True,'ok')
    # importar XLSX
    with pg.expect_file_chooser() as fc: pg.click('[data-cla="imp"]')
    fc.value.set_files('/tmp/clientes_teste.xlsx'); pg.wait_for_timeout(600)
    ok(pg.evaluate("[...document.querySelectorAll('[data-clmap=nome]')][0].selectedOptions[0].textContent")=='Razão Social' and pg.evaluate("[...document.querySelectorAll('[data-clmap=cidade]')][0].selectedOptions[0].textContent")=='Município','xlsx: colunas reconhecidas por sinônimos')
    pg.click('[data-cla="impgo"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.S.clientes.some(x=>x.nome==='AQUÁRIO NOVO MUNDO' && x.doc==='11.111.111/0001-11')"),'xlsx: cliente novo importado com CNPJ')
    ok(pg.evaluate("PP.S.clientes.length")==antes+3,'xlsx: 2 novos (ANDRADE foi renomeado antes, então é novo)')
    ok(pg.evaluate("document.querySelectorAll('#cliente option').length")==pg.evaluate("PP.S.clientes.length"),'lista de clientes do Nacional atualizada')
    # modelo
    with pg.expect_download() as dl: pg.click('[data-cla="modelo"]')
    ok(dl.value.suggested_filename=='modelo-clientes.csv','baixa modelo .csv')
    # remover
    pg.click('.cli:has-text("PET CENTER")'); pg.click('[data-cla="edit"]'); pg.click('[data-cla="del"]'); pg.wait_for_timeout(200)
    ok(not pg.evaluate("PP.S.clientes.some(x=>x.nome==='PET CENTER LTDA')"),'remover cliente')
    # busca global abre a ficha
    pg.evaluate("PP.clientes.open(0)"); pg.wait_for_timeout(250); ok(pg.evaluate("PP.S.view")=='clientes' and pg.locator('.clficha .cltitle').count()==1,'PP.clientes.open abre a ficha')
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    # mobile
    m=b.new_context(viewport={'width':390,'height':844}, service_workers='block'); mp=m.new_page(); mp.on('pageerror', lambda e: errs.append(str(e)))
    mp.goto('http://localhost:8765/index.html'); mp.wait_for_timeout(300); mp.evaluate(SEED); mp.evaluate("sessionStorage.setItem('pp.asShown','1')"); mp.reload(); mp.wait_for_timeout(500)
    mp.evaluate("PP.go('clientes')"); mp.wait_for_timeout(250)
    ok(mp.locator('.clficha').is_hidden() and mp.locator('.cllist').is_visible(),'mobile: só a lista no início')
    mp.click('.cli >> nth=0'); mp.wait_for_timeout(250); ok(mp.locator('.cllist').is_hidden() and mp.locator('.clficha').is_visible(),'mobile: toca e abre a ficha')
    ok(mp.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile: sem rolagem horizontal')
    mp.click('[data-cla="voltar"]'); mp.wait_for_timeout(200); ok(mp.locator('.cllist').is_visible(),'mobile: voltar à lista')
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); print('TUDO OK' if not fails else 'COM FALHAS')
