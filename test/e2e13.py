import sys, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':900}, service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    ok(pg.locator('#nav [data-view="tarefas"]').count()==1,'aba Tarefas no menu'); ok(pg.locator('#nav [data-view="mapa"]').count()==1,'aba Notas de entrada no menu')
    ok(pg.locator('#nav [data-view="controle"]').count()==0,'Meu Controle saiu do menu')
    pg.click('#nav [data-view="tarefas"]'); pg.wait_for_timeout(300)
    ok(pg.locator('.kcol').count()==4,'4 colunas'); ok(pg.inner_text('#vTarefas').count('Nada aqui')>=3,'estado vazio')
    # criar
    def nova(t,cat,prio,prazo,col='todo',rec='',obs=''):
        pg.click('#vTarefas .kbt .primary'); pg.wait_for_timeout(150)
        pg.fill('#kmT',t); pg.select_option('#kmC',cat); pg.select_option('#kmP',prio); pg.fill('#kmD',prazo) if prazo else None; pg.select_option('#kmS',col); pg.select_option('#kmR',rec); pg.fill('#kmO',obs); pg.click('#kbForm button[type=submit]'); pg.wait_for_timeout(200)
    hoje=pg.evaluate("PP.Features.todayISO()"); ontem=pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),-1)"); amanha=pg.evaluate("PP.Features.addDays(PP.Features.todayISO(),1)")
    nova('Solicitar reserva ao despachante','Exportação','a',hoje)
    nova('CT-e da LATAM · Ricardo','Frete','a',ontem,'wait')
    nova('Repor Neon cardinal','Compras','b',amanha,'doing')
    nova('Conferir boletos','Financeiro','m',hoje,'todo','d','todo dia')
    ok(pg.locator('.kcol[data-kdrop="todo"] .kc').count()==2,'2 cartões em A fazer'); ok(pg.locator('.kcol[data-kdrop="wait"] .kc').count()==1,'1 em Aguardando')
    ok('hoje' in pg.inner_text('.kcol[data-kdrop="todo"]') and 'venceu' in pg.inner_text('.kcol[data-kdrop="wait"]'),'tags hoje / venceu')
    ok(pg.locator('.banner.kbl').count()==1,'aviso de tarefa vencida')
    ok(pg.evaluate("PP.store.get('kanban').tasks.length")==4,'salvo no armazenamento (kanban)')
    # filtro
    pg.click('[data-kcat="Frete"]'); pg.wait_for_timeout(150); ok(pg.locator('.kc').count()==1,'filtro por categoria'); pg.click('[data-kcat=""]'); pg.wait_for_timeout(150); ok(pg.locator('.kc').count()==4,'filtro Todas')
    # mover com seta
    pg.locator('.kc', has_text='Solicitar reserva').locator('[data-kmv$="|1"]').click(); pg.wait_for_timeout(200)
    ok(pg.locator('.kcol[data-kdrop="doing"] .kc', has_text='Solicitar reserva').count()==1,'seta › move para Em andamento')
    # arrastar
    pg.locator('.kc', has_text='Repor Neon').drag_to(pg.locator('.kcol[data-kdrop="done"]')); pg.wait_for_timeout(250)
    ok(pg.locator('.kcol[data-kdrop="done"] .kc', has_text='Repor Neon').count()==1,'arrastar para Feito funciona')
    # recorrência
    pg.locator('.kc', has_text='Conferir boletos').locator('[data-kmv$="|1"]').click(); pg.locator('.kc', has_text='Conferir boletos').locator('[data-kmv$="|1"]').click(); pg.locator('.kc', has_text='Conferir boletos').locator('[data-kmv$="|1"]').click(); pg.wait_for_timeout(250)
    t=pg.evaluate("PP.store.get('kanban').tasks.filter(t=>t.titulo==='Conferir boletos')")
    ok(len(t)==2 and sorted(x['status'] for x in t)==['done','todo'],'tarefa que se repete cria a próxima em A fazer')
    nx=[x for x in t if x['status']=='todo'][0]; ok(nx['prazo']==amanha,'próxima data = amanhã ('+nx['prazo']+')')
    pg.locator('.kc', has_text='Conferir boletos').first.locator('[data-kmv$="|-1"]').count()
    # editar / excluir
    pg.locator('.kc', has_text='CT-e da LATAM').click(); pg.wait_for_timeout(150); pg.fill('#kmT','CT-e da LATAM · Ricardo Manjor'); pg.click('#kbForm button[type=submit]'); pg.wait_for_timeout(200)
    ok(pg.locator('.kc', has_text='Ricardo Manjor').count()==1,'editar título')
    pg.locator('.kc', has_text='Ricardo Manjor').click(); pg.wait_for_timeout(150); pg.click('[data-kdel]'); pg.wait_for_timeout(200); ok(pg.locator('.kc', has_text='Ricardo Manjor').count()==0,'excluir')
    pg.locator('.kc').first.click(); pg.wait_for_timeout(150); pg.keyboard.press('Escape'); pg.wait_for_timeout(150); ok(not pg.is_visible('#kbModal'),'Esc fecha a janela')
    # persistência + backup
    pg.reload(); pg.wait_for_timeout(500); ok(pg.evaluate("PP.store.get('kanban').tasks.length")>=4,'persiste após recarregar')
    ok(pg.evaluate("Object.keys(__app.PP.store.get('kanban')).length")>0,'dados lidos'); 
    # Hoje e cardinal
    pg.evaluate("PP.go('hoje')"); pg.wait_for_timeout(300)
    ok(pg.locator('#vHoje [data-as^="kb:"]').count()>=1,'tarefa de hoje aparece em Precisa de atenção')
    b1=pg.locator('#vHoje [data-as^="kb:"][data-as$="|ok"]').first
    b1.click(); pg.wait_for_timeout(300); ok(pg.evaluate("PP.store.get('kanban').tasks.filter(t=>t.status==='done').length")>=2,'"Feita" no Hoje conclui a tarefa')
    # busca
    pg.keyboard.press('Control+k'); pg.wait_for_timeout(200); pg.keyboard.type('boletos'); pg.wait_for_timeout(300); ok(pg.locator('#srchRes [data-si]').count()>=1 and 'tarefas' in pg.inner_text('#srchRes').lower(),'busca encontra tarefa')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(300); ok(pg.is_visible('#vTarefas'),'Enter abre a aba Tarefas')
    # backup inclui kanban
    ok(pg.evaluate("JSON.stringify(Object.keys(window.__app.PP.store.get('kanban')))")!='', 'ok')
    # celular
    m=b.new_context(viewport={'width':390,'height':800},service_workers='block').new_page(); m.on('pageerror', lambda e: errs.append('M '+str(e)))
    m.goto('http://localhost:8765/index.html'); m.evaluate(SEED); m.evaluate("sessionStorage.setItem('pp.asShown','1')"); m.evaluate("PP.store.set('kanban',{tasks:[{id:'a',titulo:'Teste celular',cat:'Pedidos',prio:'m',prazo:'',status:'todo',ts:1},{id:'b',titulo:'Em curso',cat:'Frete',prio:'a',prazo:'',status:'doing',ts:2}]})"); m.reload(); m.wait_for_timeout(500)
    m.evaluate("PP.go('tarefas')"); m.wait_for_timeout(300)
    ok(m.locator('.kcol:visible').count()==1,'celular: uma coluna por vez'); m.click('[data-kcol="doing"]'); m.wait_for_timeout(200); ok('Em curso' in m.inner_text('.kcol.on'),'celular: abas trocam de coluna')
    ok(m.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'celular: sem rolagem horizontal')
    m.click('.kc[data-kid="b"]'); m.wait_for_timeout(200); ok(m.is_visible('#kbForm') and m.evaluate("document.documentElement.scrollWidth<=innerWidth+1"),'celular: janela de edição cabe')
    ok(not errs,'sem erros JS '+str(errs))
    print('\n'+(str(len(fails))+' FALHA(S)' if fails else 'TUDO OK'))
