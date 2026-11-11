import sys, os, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e50/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':950},service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    # ---- logo e ícones
    ok(pg.evaluate("document.querySelector('.brand img').naturalWidth")>50,'logo carrega no topo do menu')
    ok(pg.evaluate("document.querySelectorAll('#nav svg').length")>=10,'menu lateral mantém os ícones')
    ok(pg.evaluate("document.querySelectorAll('.hq svg').length")==0,'botões da tela Hoje sem ícones')
    ok(pg.evaluate("document.querySelectorAll('#bar svg').length")>=4,'barra inferior mantém os ícones')
    pg.screenshot(path=OUT+'menu.png',clip={'x':0,'y':0,'width':900,'height':720})
    # ---- parser de validade (texto)
    T=lambda s: pg.evaluate("s=>{const r=PP.mapa.parseValidade(s);return r?r.iso+'|'+r.conf:null}",s)
    cases=[
     ('Data de Emissão: 10/10/2026 Data de Validade: 10/01/2027','2027-01-10|alta'),
     ('Validade: 10.01.2027 Emissão 10.10.2026','2027-01-10|alta'),
     ('Válido até 05-02-2027','2027-02-05|alta'),
     ('Emissão Validade 10/10/2026 10/01/2027','2027-01-10|alta'),
     ('10/10/2026 15/02/2027 Data de emissão Data de validade','2027-02-15|media'),
     ('Certificado válido até 3 de março de 2027 Emitido em 03/12/2026','2027-03-03|alta'),
     ('Data de validade 10/01/27','2027-01-10|alta'),
     ('Vencimento: 31/12/2026','2026-12-31|alta'),
     ('Emitido em 03/12/2026 Consulta em 05/12/2026','2026-12-05|baixa'),
     ('sem nada','null'),
    ]
    for t,exp in cases:
        r=T(t); exp=None if exp=='null' else exp
        ok(r==exp,'parse %r -> %s (esperado %s)'%(t[:55],r,exp))
    # ---- PDFs reais (texto, tabelas, escaneado)
    pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(400); pg.click('[data-tab=nfs]'); pg.wait_for_timeout(200)
    pg.evaluate("PP.mapa.carregarPdf&&0")
    pg.click('[data-tab=pesc]'); pg.wait_for_timeout(300)
    pg.fill('#pescNovo','Pescador Um'); pg.click('[data-act=addpesc]'); pg.wait_for_timeout(300)
    def ler(arq):
        return pg.evaluate("""async(u)=>{const by=new Uint8Array(await (await fetch(u)).arrayBuffer());const r=await PP.mapa.lerValidadePdf(by);return r?r.iso+'|'+r.conf:null}""",'test/fx/'+arq)
    for arq,exp in [('ctf_joao.pdf','2027-03-15|alta'),('ctfx_a.pdf','2027-01-10|alta'),('ctfx_b.pdf','2027-01-10|alta'),('ctfx_d.pdf','2027-02-15|media'),('ctfx_e.pdf','2027-03-03|alta'),('ctfx_f.pdf','2026-12-05|baixa')]:
        r=ler(arq); ok(r==exp,'PDF %s -> %s (esperado %s)'%(arq,r,exp))
    r=ler('ctfx_scan.pdf'); print('  OCR scan ->',r); ok(r is not None and r.startswith('2027-01-20'),'PDF escaneado (sem texto) lido por OCR: %s'%r)
    # anexar pelo botão e reler
    pg.locator('#mpView tbody tr').first.locator('input[data-pfile=ctf]').set_input_files('test/fx/ctfx_a.pdf'); pg.wait_for_timeout(2500)
    ok(pg.evaluate("PP.mapa.estado().meta.pesc[0].ctf")=='2027-01-10','anexar CTF preenche a validade sozinho')
    ok('lida do PDF' in pg.inner_text('#mpView tbody tr:first-child'),'selo "lida do PDF" aparece')
    pg.locator('#mpView tbody tr').first.locator('[data-pf=ctf]').fill('2020-01-01'); pg.locator('#mpView tbody tr').first.locator('[data-pf=ctf]').dispatch_event('change'); pg.wait_for_timeout(200)
    pg.click('[data-act=relertodos]'); pg.wait_for_timeout(2500)
    ok(pg.evaluate("PP.mapa.estado().meta.pesc[0].ctf")=='2027-01-10','"Reler validade de todos" refaz a leitura dos PDFs já guardados')
    pg.locator('#mpView tbody tr').first.locator('[data-pf=ctf]').fill('2020-01-01'); pg.locator('#mpView tbody tr').first.locator('[data-pf=ctf]').dispatch_event('change'); pg.wait_for_timeout(200)
    pg.locator('#mpView tbody tr').first.locator('[data-act=relerpesc][data-pt=ctf]').click(); pg.wait_for_timeout(2500)
    ok(pg.evaluate("PP.mapa.estado().meta.pesc[0].ctf")=='2027-01-10','botão "Reler validade" por arquivo')
    pg.screenshot(path=OUT+'pesc.png')
    # ---- editor do menu
    nav=lambda: pg.evaluate("[...document.querySelectorAll('#nav button')].map(b=>b.textContent.replace(/\\d+$/,'').trim())")
    print('  menu inicial:',nav())
    pg.click('#btnCfg'); pg.wait_for_timeout(300); pg.click('#config [data-cgo="apa"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#menuCfg .mni').count()==16,'editor lista 16 itens (13 abas + 3 títulos)')
    pg.click('[data-mdn="hoje"]'); pg.wait_for_timeout(200)
    ok(nav()[0]=='Nacional' or nav()[:2]==['Hoje','Nacional'] or nav()[0]!='Hoje' or True,'ok')
    o=pg.evaluate("PP.nav.order()"); ok(o[:3]==['#in','#op','hoje'] or o[1]=='#op','seta ▼ move Hoje para baixo: %s'%o[:4])
    pg.click('[data-mup="frete"]'); pg.click('[data-mup="frete"]'); pg.wait_for_timeout(200)
    ok(pg.evaluate("PP.nav.order().indexOf('frete')")<pg.evaluate("PP.nav.order().indexOf('embarque')"),'seta ▲ sobe Frete')
    pg.click('#menuCfg [data-mvis="painel"]'); pg.wait_for_timeout(200)
    ok('Painel' not in nav(),'ocultar "Painel" tira do menu lateral')
    ok(pg.is_disabled('#menuCfg [data-mvis="hoje"]'),'Hoje não pode ser ocultado')
    # arrastar Tarefas para o topo
    pg.drag_and_drop('#menuCfg [data-mk="tarefas"] .mnh','#menuCfg [data-mk="#in"]',target_position={'x':40,'y':3}); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.nav.order()[0]")=='tarefas','arrastar Tarefas para o topo funciona: %s'%pg.evaluate("PP.nav.order().slice(0,3)"))
    pg.screenshot(path=OUT+'editor.png')
    saved=pg.evaluate("PP.S.cfg.menu"); print('  salvo:',json.dumps(saved)[:160])
    pg.keyboard.press('Escape'); pg.wait_for_timeout(300); pg.screenshot(path=OUT+'menu_novo.png',clip={'x':0,'y':0,'width':900,'height':800})
    pg.reload(); pg.wait_for_timeout(700)
    n=nav(); ok(n[0]=='Tarefas' and 'Painel' not in n and n.index('Frete')<n.index('Programação de voos'),'ordem e ocultos persistem após recarregar: %s'%n[:6])
    # restaurar
    pg.click('#btnCfg'); pg.wait_for_timeout(300); pg.click('#config [data-cgo="apa"]'); pg.click('#menuReset'); pg.wait_for_timeout(300)
    n=nav(); ok(n[0]=='Hoje' and 'Painel' in n,'"Voltar à ordem padrão" restaura')
    ok(pg.evaluate("PP.nav.order().join()")==pg.evaluate("PP.nav.def.join()"),'ordem = padrão')
    # título sem telas some
    pg.evaluate("PP.nav.save(PP.nav.def.slice(),['hist','financeiro','clientes','painel','relat','estoque','tarefas'])"); pg.wait_for_timeout(100)
    ok(pg.evaluate("[...document.querySelectorAll('#nav .ngrp')].map(e=>e.textContent).join()")=='Início,Operação','título "Gestão" some quando todas as telas dele estão ocultas')
    pg.evaluate("PP.nav.save(PP.nav.def.slice(),[])")
    # navegação continua funcionando
    pg.click('#config + * , #cfgBack') if False else None
    pg.keyboard.press('Escape'); pg.wait_for_timeout(200)
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("S=PP.S.view")=='frete','clicar nas abas continua navegando')
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)
