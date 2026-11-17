import sys, os; sys.path.insert(0,'test')
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e77/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
NOMES=['RAIZ AQUATICA','AGROPECUARIA PORPETA LTDA','JUVENILDO SOARES DOS SANTOS','PET SHOP CANAA','NETUNO AQUARIUM','AQUARIO MARCIO - MHP','KAUAR','PAULO LEONARDO']
FRETES=[505.9,462.2,517.4,643.19,609.74,437.6,395.6,457.6]
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1400,'height':1000},accept_downloads=True,service_workers='block').new_page()
    pg.on('pageerror',lambda e:errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.evaluate("document.getElementById('config').open=false")
    pg.evaluate("""(a)=>{
      const L=a.n.map((n,i)=>({id:'l'+i,cliente:n,aero:'BSB',cidade:'',caixas:3,peso:'',dim:'',awb:'',status:'programado',chegou:'',obs:'',pedidoId:''}));
      PP.S.embarques=[{id:'e1',titulo:'Terça',saida:'2026-11-17',chegadaPrev:'2026-11-18',linhas:L}]; PP.store.set('embarques',PP.S.embarques);
      const rec={}; a.f.forEach((v,i)=>{rec['e1|l'+i]={frete:v,taxa:90}}); PP.store.set('fretes',{rec,cfg:{taxa:90}});}""",{'n':NOMES,'f':FRETES})
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("sessionStorage.setItem('pp.asShown','1')")
    pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(500)
    H=lambda i: f'[data-fi="hora"][data-k="e1|l{i}"]'
    ok(pg.locator('[data-fi="hora"]').count()==8,'8 campos de hora na tabela')
    ok(pg.get_attribute(H(0),'type')=='text','o campo de hora é texto (não o seletor do navegador)')
    # digitar 11:10 sem soltar o dedo: o campo não pode ser refeito no meio da digitação
    pg.click(H(0)); pg.evaluate("document.querySelector('%s').__marca=1"%H(0))
    pg.keyboard.type('1',delay=80); pg.keyboard.type('1',delay=80); pg.keyboard.type('1',delay=80); pg.wait_for_timeout(300)
    ok(pg.input_value(H(0))=='11:1','digitando 111 aparece 11:1')
    ok(pg.evaluate("document.querySelector('%s').__marca"%H(0))==1 and pg.evaluate("document.activeElement.dataset.k")=='e1|l0','a tela NÃO se refez no meio da digitação (o campo continua o mesmo e com o cursor)')
    pg.keyboard.type('0',delay=80); pg.wait_for_timeout(200)
    ok(pg.input_value(H(0))=='11:10','digitando 1110 sai 11:10 de uma vez')
    pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l0'].hora")=='11:10','Enter grava 11:10')
    ok(pg.evaluate("document.activeElement.dataset.fi+'|'+document.activeElement.dataset.k")=='hora|e1|l1','Enter passa direto para a hora do próximo cliente')
    pg.keyboard.type('930',delay=60); pg.keyboard.press('Tab'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l1'].hora")=='09:30','930 vira 09:30 (o 9 já completa o zero) e Tab também grava')
    pg.click(H(2)); pg.keyboard.type('06',delay=60); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l2'].hora")=='06:00','só a hora (06) vira 06:00')
    pg.click(H(3)); pg.keyboard.type('2575',delay=60); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l3'].hora||''")=='' and 'Hora inválida' in pg.inner_text('#vFrete'),'25:75 é recusada com aviso (não grava hora impossível)')
    pg.click(H(0)); pg.keyboard.type('1405',delay=60); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l0'].hora")=='14:05','dá para corrigir uma hora já preenchida (14:05)')
    pg.click(H(0)); pg.keyboard.press('Backspace'); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l0'].hora||''")=='','apagar o campo limpa a hora')
    # frete: Enter vai para o próximo
    pg.click('[data-fi="frete"][data-k="e1|l0"]'); pg.keyboard.type('500,10',delay=40); pg.keyboard.press('Enter'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.store.get('fretes').rec['e1|l0'].frete")==500.1 and pg.evaluate("document.activeElement.dataset.fi+'|'+document.activeElement.dataset.k")=='frete|e1|l1','frete: Enter grava e vai para o próximo cliente')
    pg.fill('[data-fi="frete"][data-k="e1|l0"]','505,90'); pg.dispatch_event('[data-fi="frete"][data-k="e1|l0"]','change'); pg.wait_for_timeout(300)
    # planilha
    with pg.expect_download() as d: pg.click('[data-fr="xlsx"]')
    f=OUT+'FRETE_t.xlsx'; d.value.save_as(f)
    import openpyxl
    ws=openpyxl.load_workbook(f).active
    ok(ws.max_row==10 and ws['A10'].value=='TOTAL','planilha: 8 clientes + linha TOTAL (10 linhas)')
    ok([ws.cell(r,1).value for r in range(2,10)]==NOMES,'planilha: todos os 8 clientes, na ordem')
    ok(all(ws.cell(r,c).border.left.style and ws.cell(r,c).border.bottom.style for r in range(1,11) for c in range(1,5)),'planilha: bordas completas em A–D, do cabeçalho ao TOTAL')
    ok(all(ws.cell(r,5).value is None and not ws.cell(r,5).border.left.style and not ws.cell(r,5).border.bottom.style and ws.cell(r,5).fill.fill_type is None for r in range(1,12)),'planilha: sem coluna E sobrando (nada amarelo nem com borda além do D)')
    ok(ws['D2'].value=='=(B2+C2)' and ws['B10'].value=='=SUM(B2:B9)','fórmulas mantidas')
    # menos clientes que o modelo: sem restos embaixo
    pg.evaluate("""()=>{const r=PP.store.get('fretes'); ['e1|l4','e1|l5','e1|l6','e1|l7'].forEach(k=>{r.rec[k].frete=''}); PP.store.set('fretes',r);}"""); pg.reload(); pg.wait_for_timeout(1500); pg.click('#nav button[data-view="frete"]'); pg.wait_for_timeout(400)
    with pg.expect_download() as d: pg.click('[data-fr="xlsx"]')
    f2=OUT+'FRETE_4.xlsx'; d.value.save_as(f2); ws=openpyxl.load_workbook(f2).active
    ok(ws['A6'].value=='TOTAL' and all(ws.cell(r,c).value is None and not ws.cell(r,c).border.bottom.style for r in range(7,12) for c in range(1,6)),'planilha com 4 clientes: TOTAL na linha 6 e nada sobrando embaixo')
    pg.screenshot(path=OUT+'frete.png')
    ok(not errs,'sem erros de JavaScript: %s'%errs[:2])
    b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
