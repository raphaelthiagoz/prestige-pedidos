import sys, os
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e52/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
MAIL="""11/nov/26\tQUARTA FEIRA\tDEST\tLOTE 4\tQTD\tPESO\tENTREGA\tHORARIO\tVOO\t\t
PRESTIGE\tMICHELLE APARECIDA\tGRU\t957-43215480\t12,0\t96,0\t11/nov\ttarde\tLA3847/12\t\t06:30
PRESTIGE\tLEONARDO\tPOA\t957-43217241\t11,0\t88,0\t11/nov\ttarde\tLA3847/12\tLA3420/12\t15:15
PRESTIGE\tLUIZ\tSLZ\t957-43218011\t7,0\t46,0\t11/nov\ttarde\tLA3847/12\tLA3612/12\t16:25
PRESTIGE\tRENATO\tSLZ\t957-43218475\t3,0\t24,0\t11/nov\ttarde\tLA3847/12\tLA3612/12\t16:25
PRESTIGE\tWOLCKMAR\tREC\t957-43219024\t3,0\t24,0\t11/nov\ttarde\tLA3847/12\tLA3676/12\t18:45
PRESTIGE\tMAEDA\tBSB\t957-43219691\t6,0\t48,0\t11/nov\ttarde\tLA3747/12\t\t08:30
PRESTIGE\tICARO DOUGLAS\tFOR\t957-43220144\t6,0\t48,0\t11/nov\ttarde\tLA4510/12\t\t13:10
Segue chave Pix, deposito para Dmarcos:
"""
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':1000},service_workers='block').new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.evaluate("""()=>{
      const L=(id,c,a,cx,aw)=>({id,cliente:c,aero:a,cidade:'',caixas:cx,peso:'',dim:'',awb:aw||'',status:'programado',chegou:'',obs:'',pedidoId:''});
      PP.S.embarques=[{id:'e1',titulo:'Quarta',saida:'2026-11-11',chegadaPrev:'2026-11-12',linhas:[L('a','MICHELE APARECIDA','GRU',12),L('b','LEONARDO MATIAS','POA',11),L('c','LUIZ DUTRA','SLZ',7),L('d','RENATO XAVIER','SLZ',3),L('e','WOLCKMAR ALMEIDA','REC',3),L('f','MAEDA AQUARIOS','BSB',6),L('g','ICARO DOUGLAS','FOR',6),L('h','SEM LINHA NO EMAIL','CNF',2)]}];
      PP.store.set('embarques',PP.S.embarques);
      // CTE já anexado só para a Michele (casa por AWB, apesar do nome escrito diferente)
      const D=PP.store.get('fretes',{cfg:{taxa:90},rec:{}}); D.rec['e1|a']={awb:'957-43215480',cte:'000.180.233',frete:763.61}; PP.store.set('fretes',D);}""")
    pg.reload(); pg.wait_for_timeout(600); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.context.grant_permissions(['clipboard-read','clipboard-write'])
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(300)
    ok(pg.locator('#frDrop').count()==1 and pg.locator('.frst').count()==3,'caixa única + 3 passos aparecem')
    t=pg.inner_text('.frsteps'); print('  passos:',t.replace('\n',' | ')[:200])
    ok('1/8' in t and '0/8' in t,'passos mostram o que falta (CT-e 1/8, hora 0/8)')
    # colar o e-mail direto na página (Ctrl+V sem clicar em caixa)
    pg.evaluate("""(m)=>{const dt=new DataTransfer();dt.setData('text/plain',m);document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}""",MAIL); pg.wait_for_timeout(500)
    H=lambda k: pg.input_value(f'[data-fi="hora"][data-k="e1|{k}"]')
    ok(H('a')=='06:30' and H('f')=='08:30' and H('g')=='13:10','colar (Ctrl+V) na tela preenche as horas')
    t=pg.inner_text('.frsteps'); ok('7/8' in t,'passo 2 vira 7/8: '+t.replace('\n',' | ')[:160])
    # soltar CT-e (PDF) na tela
    import base64
    b64=base64.b64encode(open('test/cte_maeda_bsb.pdf','rb').read()).decode()
    pg.evaluate("""async(b)=>{const by=Uint8Array.from(atob(b),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([by],'CTE_MAEDA.pdf',{type:'application/pdf'}));const el=document.getElementById('frDrop');el.dispatchEvent(new DragEvent('dragover',{dataTransfer:dt,bubbles:true,cancelable:true}));el.dispatchEvent(new DragEvent('drop',{dataTransfer:dt,bubbles:true,cancelable:true}));}""",b64); pg.wait_for_timeout(3500)
    r=pg.evaluate("PP.store.get('fretes').rec['e1|f']"); ok(r and r.get('frete',0)>0 and r.get('cte'),'soltar o PDF do CT-e lê frete e casa com MAEDA: %s'%({k:r.get(k) for k in ('cte','frete','hora')} if r else r))
    ok(r.get('hora')=='08:30','hora do e-mail foi mantida depois do CT-e')
    t=pg.inner_text('.frsteps'); ok('2/8' in t,'passo 1 vira 2/8')
    # copiar próximo aviso
    b1=pg.locator('[data-fr="copynext"]'); ok(b1.count()==1 and 'MICHELE' in b1.inner_text(),'botão "Copiar próximo aviso: MICHELE"')
    b1.click(); pg.wait_for_timeout(400)
    clip=pg.evaluate("navigator.clipboard.readText()"); ok('MICHELE' in clip and '06:30' in clip,'aviso copiado tem cliente e hora: '+clip.replace('\n',' / ')[:110])
    b1=pg.locator('[data-fr="copynext"]'); ok('MAEDA' in b1.inner_text(),'avança para o próximo (MAEDA)')
    b1.click(); pg.wait_for_timeout(400)
    ok(pg.locator('[data-fr="copynext"]').count()==0,'sem mais avisos prontos: botão some')
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|a'].avisado")==True,'marca como avisado')
    # texto sem AWB
    pg.evaluate("""()=>{const dt=new DataTransfer();dt.setData('text/plain','um texto qualquer colado sem nenhum conhecimento aereo');document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}"""); pg.wait_for_timeout(300)
    ok('não tem nenhum AWB' in pg.inner_text('#frNext'),'texto sem AWB: explica o que colar')
    pg.screenshot(path=OUT+'fluxo.png',full_page=False)
    # ---- carimbo upd no histórico
    pg.evaluate("""()=>{PP.S.hist=[{id:'h1',ts:1000,upd:1000,cliente:{nome:'X'},dataISO:'2026-11-01',totais:{caixas:1,peixes:1,total:10},pay:{status:'aguardando',pago:0},lines:[]},{id:'h2',ts:1000,upd:1000,cliente:{nome:'Y'},dataISO:'2026-11-01',totais:{caixas:1,peixes:1,total:10},pay:{status:'aguardando',pago:0},lines:[]}];PP.store.set('hist',PP.S.hist);PP.reloadState();}"""); pg.wait_for_timeout(300)
    pg.evaluate("()=>{PP.S.hist[0].nf='000123';PP.saveHist();}")
    h=pg.evaluate("PP.S.hist.map(e=>e.upd)"); ok(h[0]>1000 and h[1]==1000,'mudar um pedido carimba só ele (upd): %s'%h)
    pg.evaluate("()=>{PP.saveHist();}"); h2=pg.evaluate("PP.S.hist.map(e=>e.upd)"); ok(h2==h,'salvar sem mudar nada não mexe no carimbo')
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)
