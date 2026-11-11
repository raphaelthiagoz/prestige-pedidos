import sys, os; sys.path.insert(0,'test')
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e48/'
CTE='test/cte_maeda_bsb.pdf'
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':950},service_workers='block').new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.evaluate("""()=>{
      const mk=(id,ch)=>({id,titulo:'Quarta',saida:'2026-11-11',chegadaPrev:'2026-11-12',linhas:[
        {id:'l1',cliente:'MAEDA AQUARIOS',aero:'BSB',cidade:'Brasília',caixas:6,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:'h1'},
        {id:'l2',cliente:'LUIZ DUTRA',aero:'GRU',cidade:'',caixas:7,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''}]});
      PP.S.embarques=[mk('e1')]; PP.store.set('embarques',PP.S.embarques);
      PP.S.hist=[{id:'h1',ts:Date.now(),cliente:{nome:'MAEDA AQUARIOS'},inv:'1',nf:'',dataISO:'2026-11-11',totais:{caixas:6,peixes:1,total:1},pay:{status:'aguardando'},lines:[]}]; PP.store.set('hist',PP.S.hist);}""")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(300)
    pg.set_input_files('#frFile',CTE); pg.wait_for_timeout(2500)
    msg=pg.inner_text('#vFrete .warnbox'); print('  msg:',msg.replace('\n',' '))
    ok('→ MAEDA AQUARIOS' in msg,'CTE da MAEDA (razão social diferente) casa com MAEDA AQUARIOS')
    txt=pg.inner_text('#vFrete')
    ok('372,50' in pg.input_value('[data-fi="frete"][data-k="e1|l1"]') or pg.input_value('[data-fi="frete"][data-k="e1|l1"]')=='372,50','frete 372,50 lido')
    ok('prev. 12/11' in txt,'mostra a data prevista de entrega do CT-e (12/11)')
    ok('3747' in txt,'voo 3747 lido do CT-e (formato sem código de aeroporto)')
    ok(pg.input_value('[data-fi="hora"][data-k="e1|l1"]')=='','hora vem vazia na 1ª vez (CT-e não traz hora)')
    pg.fill('[data-fi="hora"][data-k="e1|l1"]','09:40'); pg.dispatch_event('[data-fi="hora"][data-k="e1|l1"]','change'); pg.wait_for_timeout(300)
    # nova semana: mesmo voo 3747 em BSB -> sugere 09:40
    pg.evaluate("""()=>{const e=PP.S.embarques[0];const n=JSON.parse(JSON.stringify(e));n.id='e2';n.saida='2026-11-18';n.linhas.forEach(l=>l.id='m'+l.id);PP.S.embarques.push(n);PP.store.set('embarques',PP.S.embarques);}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(300)
    opts=pg.eval_on_selector_all('#frEmb option','o=>o.map(x=>x.value)'); print('  opts',opts)
    pg.select_option('#frEmb','e2'); pg.wait_for_timeout(300)
    pg.set_input_files('#frFile',CTE); pg.wait_for_timeout(2500)
    k=pg.eval_on_selector_all('[data-fi="hora"]','e=>e.map(x=>x.dataset.k+"="+x.value)'); print('  horas',k)
    ok(any(x.endswith('=09:40') for x in k),'segunda semana: hora 09:40 sugerida para o mesmo voo 3747 em BSB')
    ok('sugerida' in pg.inner_text('#vFrete'),'mostra "sugerida · confirme"')
    pg.screenshot(path=OUT+'frete.png')
    ok(errs==[],'sem erros de JS %s'%errs)
    b.close()
print('FALHAS:',fails); sys.exit(1 if fails else 0)
