import sys, base64; sys.path.insert(0,'test')
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
N=['PET SHOP CANAA','NETUNO AQUARIUM','KAUAR','PAULO LEONARDO','AQUARIO MARCIO - MHP','JUVENILDO SOARES DOS SANTOS','RAIZ AQUATICA','AGROPECUARIA PORPETA LTDA']
A=['GRU','GRU','CNF','GYN','CWB','JPA','SLZ','BSB']
EXP=['07:30','07:30','14:30','13:15','14:10','17:00','16:30','08:00']  # horas em vermelho no print do dia 17/11
B64=base64.b64encode(open('test/fx/real_mail_print2.png','rb').read()).decode()
errs=[]
def prep(ctx):
    pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.evaluate("""(a)=>{const L=a.n.map((n,i)=>({id:'l'+i,cliente:n,aero:a.a[i],cidade:'',caixas:5,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''}));
      PP.S.embarques=[{id:'e1',titulo:'Terça',saida:'2026-11-17',chegadaPrev:'2026-11-18',linhas:L}]; PP.store.set('embarques',PP.S.embarques); PP.store.set('fretes',{rec:{},cfg:{taxa:90}});}""",{'n':N,'a':A})
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(400); return pg
H=lambda pg,i: pg.evaluate("(k)=>(PP.store.get('fretes').rec[k]||{}).hora||''",'e1|l%d'%i)
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000},service_workers='block',permissions=['clipboard-read','clipboard-write'])
    pg=prep(ctx)
    # colar (Ctrl+V) com o cursor DENTRO de um campo da tabela: antes era ignorado
    pg.click('[data-fi="frete"][data-k="e1|l0"]')
    pg.evaluate("""(b)=>{const by=Uint8Array.from(atob(b),c=>c.charCodeAt(0));const dt=new DataTransfer();dt.items.add(new File([by],'image.png',{type:'image/png'}));document.activeElement.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}""",B64)
    pg.wait_for_function("document.getElementById('frPrintMsg')",timeout=120000); pg.wait_for_timeout(500)
    msg=pg.inner_text('#vFrete'); 
    ok('8 horário(s) em vermelho' in msg,'acha os 8 horários em vermelho do print de 17/11')
    for i in range(8): ok(H(pg,i)==EXP[i],'%s = %s (leu %s)'%(N[i],EXP[i],H(pg,i)))
    ok('Sem linha no e-mail' not in msg,'nenhum cliente ficou sem linha')
    ok('parte do nome' in msg,'casa nomes grudados pelo print (AGROPORPETA, COCOJUVENLDO) por parte do nome')
    pg.screenshot(path='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/frete_print17.png')
    # colou só o link da imagem (copiar do e-mail como HTML)
    pg.evaluate("PP.store.set('fretes',{rec:{},cfg:{taxa:90}}); PP.frete.reload(); PP.frete.render()")
    pg.evaluate("""()=>{const dt=new DataTransfer();dt.setData('text/html','<img src="https://attachments.office.net/x.png">');document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}"""); pg.wait_for_timeout(300)
    ok('só o link da imagem' in pg.inner_text('#vFrete'),'colar só o link da imagem do e-mail explica o que fazer ("Copiar imagem" ou print)')
    # botão "Colar print copiado" (lê a área de transferência)
    pg.evaluate("""async(b)=>{const by=Uint8Array.from(atob(b),c=>c.charCodeAt(0));await navigator.clipboard.write([new ClipboardItem({'image/png':new Blob([by],{type:'image/png'})})]);}""",B64)
    pg.click('[data-fr="colarimg"]')
    pg.wait_for_function("((PP.store.get('fretes').rec||{})['e1|l7']||{}).hora",timeout=120000); pg.wait_for_timeout(400)
    ok(all(H(pg,i)==EXP[i] for i in range(8)),'botão "Colar print copiado" lê o print da área de transferência: %s'%[H(pg,i) for i in range(8)])
    ok(not errs,'sem erros de JavaScript: %s'%errs[:2])
    b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
