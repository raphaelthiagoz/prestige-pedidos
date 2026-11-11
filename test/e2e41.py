import sys, os, re; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e41/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1100},service_workers='block'); ctx.grant_permissions(['clipboard-read','clipboard-write']); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(600)
    pg.evaluate("""()=>{const t=PP.Features.todayISO(),d=n=>PP.Features.addDays(t,n);
      const mk=(id,n,nome,em,ex,tot,pay)=>({id,n,ano:2026,dest:'MIA',dateISO:em,cons:{name:nome},items:[],ordem:'auto',ex:Object.assign({fee:12},ex),conv:{on:false,rate:'',date:t},rot:{st:{},nt:{},no:{},f:{},only:false},tot:Object.assign({boxes:10,fish:900,goods:900,fee:100,total:1000},tot||{}),pay});
      PP.store.set('exphist',[
       mk('xa',40,'CLIENTE A',d(-25),{dep:d(-14)+'T10:00',vooIntChe:d(-12)+'T08:00',disc:50,doa:20,frete:100}),
       mk('xb',41,'CLIENTE B',d(-35),{dep:d(-24)+'T10:00',vooIntChe:d(-20)+'T08:00'},{total:500}),
       mk('xc',42,'CLIENTE C',d(-1),{dep:d(-1)+'T10:00'},{total:800}),
       mk('xd',43,'CLIENTE D',t,{dep:t+'T22:00'},{total:700}),
       mk('xe',44,'CLIENTE E',t,{},{total:300}),
       mk('xf',45,'CLIENTE F',d(-40),{dep:d(-30)+'T10:00',vooIntChe:d(-28)+'T08:00'},{total:400},{status:'pago',pago:400,dataPago:t,obs:''})]);
      PP.exp.reload();}""")
    pg.click('#nav button[data-view="financeiro"]'); pg.wait_for_timeout(500)
    ok(pg.is_visible('#vFinanceiro button[data-k="exp"]'),'chave Nacional/Exportação aparece')
    ok(pg.locator('#vFinanceiro .hchart svg g[data-tip]').count()>=1,'gráfico de recebimentos aparece (nacional)')
    pg.click('#vFinanceiro button[data-k="exp"]'); pg.wait_for_timeout(500)
    t=pg.inner_text('#vFinanceiro'); print('  ',t.replace('\n',' | ')[:900])
    ok(pg.locator('#vFinanceiro .hchart svg g[data-tip]').count()>=1,'gráfico aparece nas exportações')
    pg.screenshot(path=OUT+'exp.png')
    # A: 1000-50-20+100 = 1030 ; B 500 ; C 800 ; D 700 ; E 300 ; F pago  => receber 3330 ; cobrar A+B = 1530 ; atrasado B = 500
    ok('US$ 3.330,00' in t,'a receber = 3.330,00 (A 1.030 + B 500 + C 800 + D 700 + E 300)')
    ok(re.search(r'US\$ 1\.530,00\s*hora de cobrar',t,re.I),'hora de cobrar = A + B (1.530,00)')
    ok(re.search(r'US\$ 500,00\s*atrasado',t,re.I),'atrasado = só B (500,00)')
    ok(re.search(r'US\$ 400,00\s*recebido',t,re.I),'recebido do mês = 400,00')
    for n in ['A','B','C','D','E']: pg.click(f'#vFinanceiro tr.fgrp:has-text("CLIENTE {n}")'); pg.wait_for_timeout(120)
    t=pg.inner_text('#vFinanceiro')
    def linha(n): return pg.inner_text(f'#vFinanceiro tr.fgrp:has-text("CLIENTE {n}") + tr.fped')
    la,lb,lc,ld,le=[linha(n) for n in 'ABCDE']
    print('  A:',la.replace('\n',' ')); print('  B:',lb.replace('\n',' ')); print('  C:',lc.replace('\n',' '))
    ok('hora de cobrar' in la and '1.030,00' in la,'A: hora de cobrar, valor com frete/discount/DOA = 1.030,00')
    ok('5 dia(s) de atraso' in lb,'B: 5 dia(s) de atraso (20 dias após chegada, limite 15)')
    ok('trânsito' in lc and 'cobrar' not in lc.replace('Copiar cobrança',''),'C: embarcou ontem -> NÃO cobra (em trânsito)')
    ok('trânsito' in ld,'D: embarque hoje -> NÃO cobra (em trânsito)')
    ok('sem data' in le,'E: sem data de embarque -> sem cobrança')
    # só "Hora de cobrar"
    pg.click('#vFinanceiro button[data-fin="fx"][data-k="cobrar"]'); pg.wait_for_timeout(300)
    t=pg.inner_text('#vFinanceiro'); ok('CLIENTE A' in t and 'CLIENTE B' in t and 'CLIENTE C' not in t and 'CLIENTE D' not in t,'filtro "Hora de cobrar" lista só A e B')
    # cobrança em inglês
    pg.click('#vFinanceiro tr.fgrp:has-text("CLIENTE A") button[data-fin="xcobr"]'); pg.wait_for_timeout(300)
    cl=pg.evaluate("navigator.clipboard.readText()"); print('  msg:',cl[:200])
    ok('US$ 1.030,00' in cl and 'Hello' in cl and '040/2026' in cl,'mensagem de cobrança em inglês com invoice e valor')
    # pagamento parcial e total
    PB='#vFinanceiro tr.fgrp:has-text("CLIENTE A") + tr.fped button[data-fin="pag"]'
    pg.click(PB); pg.fill('#finVal','500'); pg.click('[data-fin="pagok"]'); pg.wait_for_timeout(300)
    ok('US$ 530,00' in pg.inner_text('#vFinanceiro'),'pagamento parcial de 500 -> falta 530,00')
    pg.click(PB); pg.click('[data-fin="pagok"]'); pg.wait_for_timeout(300)
    st=pg.evaluate("PP.exp.hist().find(x=>x.id==='xa').pay"); print('  pay',st)
    ok(st['status']=='pago' and abs(st['pago']-1030)<0.01,'pagamento total grava status pago (persistido em exphist)')
    ok(pg.evaluate("JSON.parse(localStorage.getItem('pp.exphist')).find(x=>x.id==='xa').pay.status")=='pago','gravado no armazenamento local')
    # prazo configurável
    pg.evaluate("PP.S.cfg.prazoExpCobrar=30;PP.S.cfg.prazoExpAtraso=40;PP.fin.render()"); pg.wait_for_timeout(200)
    pg.click('#vFinanceiro button[data-fin="fx"][data-k="cobrar"]'); pg.wait_for_timeout(200)
    ok('Nenhuma exportação para cobrar' in pg.inner_text('#vFinanceiro'),'prazos configuráveis (30/40): nada para cobrar')
    # voltar ao nacional
    pg.click('#vFinanceiro button[data-fin="mod"][data-k="nac"]'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+'nac.png')
    ok('R$' in pg.inner_text('#vFinanceiro') and 'A receber' in pg.inner_text('#vFinanceiro'),'volta para Nacional em R$')
    ok(not errs,'sem erros de página %s'%errs)
print('FALHAS',fails)
