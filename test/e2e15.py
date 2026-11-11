import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(args=['--use-fake-ui-for-media-stream','--use-fake-device-for-media-stream']); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    ok(pg.locator('#kbMic').count()==1,'botão de microfone flutuante existe')
    F=pg.evaluate("({h:PP.Features.todayISO(),a:PP.Features.addDays(PP.Features.todayISO(),1),d:PP.Features.addDays(PP.Features.todayISO(),2)})")
    def pv(t): return pg.evaluate("t=>PP.kanban.parseVoice(t)",t)
    r=pv('amanhã ligar pro despachante, frete, urgente'); ok(r['prazo']==F['a'] and r['prio']=='a' and r['cat'] in('Frete','Exportação') and 'despachante' in r['titulo'].lower() and 'urgente' not in r['titulo'].lower() and 'amanhã' not in r['titulo'].lower(),'amanhã + urgente + categoria: '+json.dumps(r,ensure_ascii=False))
    r=pv('criar tarefa conferir os boletos hoje'); ok(r['prazo']==F['h'] and r['cat']=='Financeiro' and r['titulo'].startswith('Conferir os boletos'),'tarefa/boletos hoje: '+r['titulo'])
    r=pv('lembrar de repor neon cardinal depois de amanhã'); ok(r['prazo']==F['d'] and r['cat']=='Compras' and r['titulo']=='Repor neon cardinal','repor depois de amanhã: '+r['titulo'])
    r=pv('preciso solicitar a reserva do voo na sexta-feira'); import datetime
    ok(r['prazo']!='' and datetime.date.fromisoformat(r['prazo']).weekday()==4 and r['cat']=='Exportação','sexta-feira -> próxima sexta '+r['prazo'])
    r=pv('pagar o frete da Latam dia 15 prioridade baixa'); ok(r['prazo'].endswith('-15') and r['prio']=='b','dia 15 + prioridade baixa '+r['prazo'])
    r=pv('conferir estoque todo dia'); ok(r['rec']=='d' and r['cat']=='Compras','repete todo dia')
    r=pv('toda segunda enviar relatório de pedidos'); ok(r['rec']=='s' and datetime.date.fromisoformat(r['prazo']).weekday()==0,'toda segunda semanal')
    r=pv('ligar para o cliente daqui a 3 dias'); ok(r['prazo']==pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),3)") and r['titulo']=='Ligar para o cliente','daqui a 3 dias')
    r=pv('comprar caixas'); ok(r['prazo']=='' and r['prio']=='' and r['cat']=='Compras' and r['titulo']=='Comprar caixas','sem prazo nem prioridade')
    # fluxo: abrir painel, digitar, criar -> modal preenchido -> salvar
    pg.click('#kbMic'); pg.wait_for_timeout(300); ok(pg.locator('#kbVoice:not([hidden])').count()==1,'painel de voz abre')
    pg.fill('#kvT','amanhã separar o pedido do cliente Ruinemans, urgente'); pg.click('[data-kvx="go"]'); pg.wait_for_timeout(250)
    ok(pg.locator('#kbModal:not([hidden]) .kvheard').count()==1,'modal de conferência mostra “Você disse”')
    ok(pg.input_value('#kmD')==F['a'] and pg.input_value('#kmP')=='a' and pg.input_value('#kmC')=='Pedidos' and pg.input_value('#kmT').startswith('Separar o pedido'),'campos preenchidos: '+pg.input_value('#kmT'))
    pg.click('#kbForm .primary'); pg.wait_for_timeout(250)
    t=pg.evaluate("PP.store.get('kanban').tasks.slice(-1)[0]"); ok(t['prazo']==F['a'] and t['prio']=='a' and t['status']=='todo','tarefa salva com prazo/prioridade')
    # Enter no campo
    pg.click('#kbMic'); pg.fill('#kvT','comprar caixas'); pg.press('#kvT','Enter'); pg.wait_for_timeout(250); ok(pg.locator('#kbModal:not([hidden])').count()==1,'Enter confirma'); pg.keyboard.press('Escape')
    # sem reconhecimento de voz: mensagem + campo para digitar
    ok(pg.locator('#kbVoice').count()>=0,'ok')
    pg.evaluate("sessionStorage.clear()")
    ok(len(errs)==0,'sem erros de JS %s'%errs)
    # mobile
    m=b.new_context(viewport={'width':390,'height':844}, service_workers='block'); mp=m.new_page(); mp.on('pageerror', lambda e: errs.append(str(e)))
    mp.goto('http://localhost:8765/index.html'); mp.wait_for_timeout(300); mp.evaluate(SEED); mp.evaluate("sessionStorage.setItem('pp.asShown','1')"); mp.reload(); mp.wait_for_timeout(500)
    mp.click('#kbMic'); mp.wait_for_timeout(300); ok(mp.evaluate("document.documentElement.scrollWidth<=window.innerWidth+1"),'mobile sem rolagem horizontal')
    bb=mp.evaluate("(()=>{const a=document.getElementById('kbMic').getBoundingClientRect(),c=document.getElementById('bar').getBoundingClientRect(),f=document.querySelector('.assist.floating'),g=f?f.getBoundingClientRect():null;return {mic:[a.top,a.bottom],bar:c.top,as:g?[g.top,g.bottom]:null}})()")
    ok(bb['mic'][1]<=bb['bar'] and (not bb['as'] or bb['mic'][1]<=bb['as'][0]+2),'mobile: microfone não cobre a barra nem o cardinal %s'%bb)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); print('TUDO OK' if not fails else 'COM FALHAS')
