import sys, json, base64, os, subprocess, re; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
import openpyxl
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e36/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
L=[[16,300,'OTOCINCLUS HOPPEI','LIMPA VIDRO',.12],[10,450,'PARACHEIRODON AXELRODI','CARDINAL',.16],[10,200,'HEMIGRAMMUS BLEHERI','RODOSTOMUS',.12],[3,700,'PARACHEIRODON SIMULANS','NEON VERDE',.12]]
items=[{'boxes':b,'qpb':q,'sci':s,'pt':p,'price':pr} for b,q,s,p,pr in L]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1500,'height':1000},device_scale_factor=1.5,accept_downloads=True,service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('dialog', lambda d: d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    # ---- exportações: uma com data de partida, outra SEM data, mais embarques nacionais em datas esparsas
    pg.evaluate("""()=>{const t=PP.Features.todayISO(),d=n=>PP.Features.addDays(t,n);
      PP.S.embarques=[{id:'e1',titulo:'A',saida:d(3),linhas:[{id:'l1',cliente:'Maeda',aero:'CGB',cidade:'Cuiabá',caixas:12,status:'programado'}]},
                      {id:'e2',titulo:'B',saida:d(4),linhas:[{id:'l2',cliente:'Cezar',aero:'GRU',cidade:'SP',caixas:20,status:'programado'}]},
                      {id:'e3',titulo:'C',saida:d(20),linhas:[{id:'l3',cliente:'Maeda',aero:'CGB',cidade:'Cuiabá',caixas:7,status:'programado'}]}];
      PP.store.set('embarques',PP.S.embarques);
      const mk=(id,n,date,dep)=>({id,n,ano:2026,dest:'MIA',dateISO:date,cons:{name:'CLIENTE '+n},items:[{sci:'Paracheirodon axelrodi',pt:'',boxes:5,qpb:100,price:1}],ordem:'auto',ex:{pkDate:t,pkTime:'06:00AM',fee:12,dep:dep},conv:{on:false,rate:'',date:t},rot:{st:{},nt:{},no:{},f:{},only:false},tot:{boxes:5,fish:500,goods:500,fee:60,total:560}});
      PP.store.set('exphist',[mk('x1',30,d(10),d(10)+'T10:00'),mk('x2',31,'','')]);PP.exp.reload();PP.go('embarque');PP.go('hoje');}""")
    pg.wait_for_timeout(600)
    n=pg.locator('#vHoje .hchart svg g[data-tip]').count(); ok(n==4,'gráfico mostra só os 4 dias com venda, não semanas (%d barras)'%n)
    t=pg.inner_text('#vHoje .hchart'); print('  ',t.replace('\n',' | ')[:300])
    ok('sem data marcada' in t and '031/2026' in t,'avisa exportação sem data (031/2026) fora do gráfico')
    ok('esta sem.' not in t,'sem rótulos de semana')
    pg.screenshot(path=OUT+'home.png')
    pg.click('[data-hdet]'); pg.wait_for_timeout(300); d=pg.inner_text('#hDet'); ok('só dias com venda' in d and pg.locator('#hDet tbody tr').count()==4,'detalhe "Por dia" lista 4 dias (%d)'%pg.locator('#hDet tbody tr').count()); pg.keyboard.press('Escape')
    # ---- exportação sem data
    pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(300)
    pg.evaluate("(it)=>{const s=PP.exp.state();s.items=it;s.ex.fee=12;s.ex.dep='';PP.exp.render()}",items); pg.wait_for_timeout(400)
    ok(pg.locator('#xNoDate').count()==1 and not pg.is_checked('#xNoDate'),'campo Data tem a opção "Sem data marcada ainda"')
    pg.check('#xNoDate'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.exp.state().date")=='' and pg.is_disabled('[data-xp="date"]'),'marcando: data fica vazia e o campo desabilitado')
    names=pg.evaluate("PP.exp.docList().map(d=>d.id)"); ok('inv' in names,'documentos continuam disponíveis')
    pg.click('[data-xa="prev"]'); pg.wait_for_timeout(500); st=pg.inner_text('#xStage'); ok('__/__/____' in st,'prévia da invoice mostra __/__/____')
    pg.keyboard.press('Escape')
    b64=pg.evaluate("async()=>{const d=PP.exp.docList().find(x=>x.id=='inv');const u=await d.build();let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)}")
    open(OUT+'inv_semdata.xlsx','wb').write(base64.b64decode(b64))
    ws=openpyxl.load_workbook(OUT+'inv_semdata.xlsx')['Invoice']; vals=[c.value for r in ws.iter_rows(min_row=1,max_row=20) for c in r if c.value is not None]
    ok('__/__/____' in vals,'xlsx da invoice sai com a data em branco (__/__/____)')
    pg.uncheck('#xNoDate'); pg.wait_for_timeout(300); ok(pg.evaluate("PP.exp.state().date")!='' and not pg.is_disabled('[data-xp="date"]'),'desmarcando: volta uma data e o campo libera')
    pg.check('#xNoDate'); pg.wait_for_timeout(200)
    # salvar no histórico (zip) com confirmação
    with pg.expect_download(): pg.click('[data-xa="zip"]')
    pg.wait_for_timeout(700)
    h=pg.evaluate("PP.exp.hist().map(e=>[e.n,e.dateISO])"); print('  hist',h)
    ok(any(x[1]=='' for x in h if x[0] not in (30,31)),'salvou no histórico sem data')
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400)
    # ---- BRL com aduana
    pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(300)
    pg.evaluate("""()=>{const s=PP.exp.state();s.date=PP.Features.todayISO();s.conv.on=true;s.conv.rate='5';PP.exp.render()}"""); pg.wait_for_timeout(300)
    pg.fill('[data-xp="ex.disc"]','500'); pg.fill('[data-xp="ex.doa"]','150'); pg.fill('[data-xp="ex.tarifa"]','8.45'); pg.wait_for_timeout(300)
    t=pg.evaluate("(()=>{const o=PP.exp.orderObj({adu:1});return {goods:o.items.reduce((a,x)=>a+x.boxes*x.qpb*x.price,0),boxes:o.items.reduce((a,x)=>a+x.boxes,0)}})()")
    pg.click('[data-xa="prev"]'); pg.wait_for_timeout(500)
    pg.click('[data-xiv="brl"]'); pg.wait_for_timeout(400); st=pg.inner_text('#xStage'); print('  brl prévia:',st.replace('\n',' | ')[-420:])
    ok('PRE-PAID FREIGHT' in st and 'ADUANA' in st.upper(),'prévia da invoice em R$ mostra frete e avisa que usa valores da aduana')
    pg.screenshot(path=OUT+'brl_prev.png'); pg.keyboard.press('Escape')
    b64=pg.evaluate("async()=>{const d=PP.exp.docList().find(x=>x.id=='brl');const u=await d.build();let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)}")
    open(OUT+'brl.xlsx','wb').write(base64.b64decode(b64))
    ok(not errs,'sem erros de página %s'%errs)
    b.close()
subprocess.run(['soffice','--headless','--convert-to','pdf','--outdir',OUT,OUT+'brl.xlsx'],capture_output=True)
ws=openpyxl.load_workbook(OUT+'brl.xlsx')
sh=[s for s in ws.worksheets if s.title!='Invoice'] or ws.worksheets
txt=subprocess.run(['pdftotext','-layout',OUT+'brl.pdf','-'],capture_output=True,text=True).stdout
ok('PRE-PAID FREIGHT' in txt,'xlsx em R#: linha PRE-PAID FREIGHT presente')
# total geral esperado US$ = líquido (3.xxx) + frete (peso*8,45) -> conferir que o total em US$ bate com a invoice aduana
nums=[float(x.replace(',','')) for x in re.findall(r'\$\s*([\d,]+\.\d{2})',txt)]
print('  valores US$ no pdf:',nums[-6:])
print('FALHAS',fails)
