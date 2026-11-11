import json, os
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e/'
CTE='/mnt/user-data/attachments/48154143-1c92-5c72-a63a-d8264194645f/11ad9964-CTE_-_957-42508642_-_NACIONAL_-_GRU_-_PRESTIGE.pdf'
ok=lambda c,m: print(('  ok  ' if c else '  FAIL ')+m)
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':950}, accept_downloads=True, service_workers='block').new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append(m.text) if m.type=='error' and 'TUNNEL' not in m.text and 'Failed to load' not in m.text else None)
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    print('nav:', pg.eval_on_selector_all('#nav button','e=>e.map(x=>x.textContent)'))
    # dados: pedido NACIONAL com NF 8976 no histórico e um embarque com 4 clientes
    pg.evaluate("""()=>{
      const emb={id:'e1',titulo:'Quinta',saida:'2026-11-05',chegadaPrev:'2026-11-05',linhas:[
        {id:'l1',cliente:'NACIONAL',aero:'GRU',cidade:'São Paulo',caixas:17,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:'h1'},
        {id:'l2',cliente:'RAQUEL',aero:'CGH',cidade:'',caixas:2,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''},
        {id:'l3',cliente:'RICARDO MANJOR',aero:'VCP',cidade:'',caixas:6,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''},
        {id:'l4',cliente:'UBER PEIXES',aero:'GIG',cidade:'',caixas:4,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''}]};
      PP.S.embarques=[emb]; PP.store.set('embarques',PP.S.embarques);
      PP.S.hist=[{id:'h1',ts:Date.now(),cliente:{nome:'NACIONAL'},inv:'197',nf:'000008976',dataISO:'2026-11-04',totais:{caixas:17,peixes:1,total:1},pay:{status:'aguardando'},lines:[]}]; PP.store.set('hist',PP.S.hist);}""")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(300)
    ok('NACIONAL' in pg.inner_text('#vFrete'),'clientes do embarque aparecem no Frete')
    pg.set_input_files('#frFile',CTE); pg.wait_for_timeout(2500)
    print('  msg:', pg.inner_text('.warnbox').replace('\n',' '))
    ok(pg.input_value('[data-fi="frete"][data-k="e1|l1"]')=='952,86','frete lido do CTE = 952,86')
    txt=pg.inner_text('#vFrete'); ok('1.042,86' in txt,'total 1.042,86 (952,86 + 90)'); ok('957-42508642' in txt and '000.179.326' in txt,'CTE e AWB preenchidos'); ok('17' in txt,'volumes')
    for k,v in [('e1|l1','14:30'),('e1|l2','15:10'),('e1|l3','13:45')]: pg.fill(f'[data-fi="hora"][data-k="{k}"]',v)
    for k,v in [('e1|l2','352,18'),('e1|l3','1.030,73')]: pg.fill(f'[data-fi="frete"][data-k="{k}"]',v); pg.keyboard.press('Tab'); pg.wait_for_timeout(150)
    pg.click('button[data-fr="baixa"][data-k="e1|l2"]'); pg.wait_for_timeout(200)
    t=pg.inner_text('.kp').replace('\n',' '); print('  kpis:',t)
    ok('PAGO' in pg.inner_text('tr[data-k="e1|l2"]'),'dar baixa')
    ok(pg.locator('tr.dev').count()==3 and pg.locator('tr.pg').count()==1,'vermelho nos em aberto (3) e verde no pago (1)')
    pg.evaluate("window.__o=[];window.open=(u)=>{window.__o.push(u);if(!u)console.log('OPENSTACK '+new Error().stack)};0")
    print('  pre:',pg.evaluate("window.__o.length"))
    pg.on('console', lambda m: print('  LOG',m.text[:400]) if 'OPENSTACK' in m.text else None)
    pg.click('a[data-fr="latam"][data-k="e1|l1"]'); print("  after a:",pg.evaluate("window.__o.map(x=>typeof x+\":\"+String(x).slice(0,60))")); pg.click('button[data-fr="latam"]')
    o=pg.evaluate("window.__o"); print('  latam urls:',o)
    ok(o and o[0]=='https://www.latamcargo.com/en/trackshipment?docNumber=42508642&docPrefix=957&soType=SO','link LATAM com AWB do CTE (tabela)')
    ok(len(o)==2 and o[1]==o[0],'botão Abrir rastreio LATAM (painel)')
    pg.screenshot(path=OUT+'q1.png',full_page=True)
    # mensagem
    pg.click('[data-fr="copyall"]'); pg.wait_for_timeout(300); print('  copy:',pg.inner_text('#frCopy'))
    ta=pg.input_value('[data-fi="msg"]'); print('  msg:',repr(ta)); ok('ÀS 14:30 HORAS' in ta and 'EMBARQUE CHEGARÁ' in ta and 'R$ 1.042,86' in ta,'mensagem com hora e total')
    pg.check('[data-fi="detalhe"]'); pg.wait_for_timeout(200); ok('taxa do despachante R$ 90,00' in pg.input_value('[data-fi="msg"]'),'detalhe opcional')
    # xlsx
    with pg.expect_download() as d: pg.click('[data-fr="xlsx"]')
    d.value.save_as(OUT+'FRETE_t.xlsx'); print('  xlsx', d.value.suggested_filename)
    pg.click('[data-fr="sub"][data-v="ctl"]'); pg.wait_for_timeout(200); pg.screenshot(path=OUT+'q2.png',full_page=True)
    ok('RICARDO' in pg.inner_text('#vFrete'),'controle lista em aberto'); ok(pg.locator('tr.dev').count()==2,'2 em aberto no controle (NACIONAL, RICARDO)')
    pg.reload(); pg.wait_for_timeout(500); pg.click('#nav button[data-view="frete"]'); ok('PAGO' in pg.inner_text('#vFrete'),'persistência após recarregar')
    ok(pg.evaluate("PP.snapshot().fretes!=null"),'backup leva fretes')
    print('errs',errs)
