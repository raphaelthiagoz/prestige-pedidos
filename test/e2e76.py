import sys; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
PORT=sys.argv[1] if len(sys.argv)>1 else '8765'
def abre(b,w,h):
    ctx=b.new_context(viewport={'width':w,'height':h},accept_downloads=True,service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror',lambda e: errs.append(str(e))); pg.on('dialog',lambda d: d.accept())
    pg.goto(f'http://localhost:{PORT}/index.html'); pg.wait_for_function('window.PP'); pg.wait_for_timeout(400); pg.evaluate(SEED)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)")
    pg.evaluate("PP.S.hist.forEach(h=>{h.rows=h.rows||[];h.nota=h.nota||{rows:[],dia:'SEGUNDA-FEIRA'};h.dia=h.dia||'segunda-feira'});const h=PP.S.hist.find(x=>x.id==='hv');h.lines=[{nome:'Peixe A',sci:'Aaa bbb',comum:'Peixe A',peixes:1000,preco:2,caixa:1},{nome:'Peixe B',sci:'Ccc ddd',comum:'Peixe B',peixes:500,preco:3,caixa:1}];PP.store.set('hist',PP.S.hist)")
    pg.reload(); pg.wait_for_timeout(2000); return ctx,pg,errs
def abrir(pg,id='hv'):
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(400); pg.click('[data-htipo=nac]'); pg.wait_for_timeout(300)
    pg.locator(f'#histTb [data-h=more][data-id={id}]').click(); pg.click('#hMenu [data-h=open]'); pg.wait_for_timeout(400)
E="PP.S.hist.find(x=>x.id==='hv')"
with sync_playwright() as p:
    b=p.chromium.launch()
    ctx,pg,errs=abre(b,1440,1100)
    abrir(pg)
    # 1) mortalidade: digitar número grande na ordem normal
    i=pg.locator('[data-dead="0"]'); i.click(); pg.keyboard.type('205',delay=70); pg.wait_for_timeout(250)
    ok(pg.locator('[data-dead="0"]').input_value()=='205','mortalidade: digitando 2, 0, 5 aparece 205 (não 502)')
    ok(pg.evaluate("document.activeElement&&document.activeElement.dataset.dead")=='0','o cursor continua no campo depois de cada tecla')
    ok(pg.evaluate("PP.Features.mortalidade("+E+",{0:205}).mortos")==205,'o cálculo usa 205 peixes mortos')
    pg.keyboard.type('9',delay=70); pg.wait_for_timeout(200)
    ok(pg.locator('[data-dead="0"]').input_value()=='1000','passou do enviado (1000): trava no máximo')
    pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.keyboard.press('Backspace'); pg.wait_for_timeout(200)
    pg.keyboard.type('12',delay=70); pg.wait_for_timeout(200)
    ok(pg.locator('[data-dead="0"]').input_value()=='12','apagar e digitar de novo funciona (12)')
    pg.locator('[data-dead="1"]').click(); pg.keyboard.type('abc7',delay=50); pg.wait_for_timeout(200)
    ok(pg.locator('[data-dead="1"]').input_value()=='7','letras são ignoradas no campo de mortos')
    # 2) boleto parcelado
    ok(pg.is_visible('#parcBox') and pg.locator('#parcBox [data-h=parcPreset]').count()==5,'bloco "Boletos e parcelas" com 5 prazos prontos')
    ok(pg.locator('#parcBox [data-h=parcPreset]').first.inner_text().replace(' ','')=='30/40/50/60','primeiro atalho é 30 / 40 / 50 / 60')
    pg.click('#parcBox [data-v="30/40/50/60"]'); pg.wait_for_timeout(500)
    ok(pg.locator('#parcTab tbody tr').count()==4,'30/40/50/60 gera 4 parcelas')
    ok(pg.evaluate("JSON.stringify("+E+".pay.parc.map(p=>p.valor))")=='[1605,1605,1605,1605]','6420 dividido em 4 parcelas de 1.605,00')
    ok(pg.evaluate(E+".pay.parc[0].venc")==pg.evaluate("PP.Features.addDays("+E+".dataISO,30)"),'vencimento = data do pedido + 30 dias')
    ok('Boletos emitidos: 0 de 4' in pg.inner_text('#parcResumo'),'resumo: 0 de 4 boletos emitidos')
    pg.locator('[data-pf="boleto|0"]').check(); pg.wait_for_timeout(300)
    ok(pg.evaluate(E+".pay.parc[0].boleto")==pg.evaluate("PP.Features.todayISO()"),'marcar "boleto emitido" grava a data de hoje')
    ok('Boletos emitidos: 1 de 4' in pg.inner_text('#parcResumo') and pg.evaluate(E+".pay.pago")==0,'emitir boleto não conta como pagamento')
    pg.locator('[data-pf="boleto|0"]').uncheck(); pg.wait_for_timeout(250)
    ok(pg.evaluate(E+".pay.parc[0].boleto")=='','desmarcar volta a vazio')
    pg.locator('[data-pf="pago|0"]').check(); pg.wait_for_timeout(300)
    ok(pg.evaluate(E+".pay.pago")==1605 and pg.evaluate("PP.Features.saldo("+E+")")==4815,'pagar a 1ª parcela: recebido 1.605 e saldo 4.815')
    ok(pg.evaluate(E+".pay.status")=='aguardando','pedido segue "aguardando" enquanto faltam parcelas')
    ok(pg.locator('#ppago').get_attribute('readonly') is not None,'"Valor recebido" fica só leitura (vem das parcelas)')
    # atraso por parcela: pedido de 12 dias atrás, 1ª parcela já paga, 2ª vence em 28 dias => NÃO está atrasado (antes estaria, pelo prazo geral)
    ok(pg.evaluate("PP.Features.situacao("+E+",PP.Features.todayISO(),7).key")=='aguardando','pedido de 12 dias com parcela a vencer em 28 dias não aparece atrasado')
    ok('próx. parcela' in pg.inner_text('#hdet .note').lower() or 'próx. parcela' in pg.inner_text('#hdet').lower(),'a situação mostra a data da próxima parcela')
    # pagar tudo
    for k in (1,2,3): pg.locator(f'[data-pf="pago|{k}"]').check(); pg.wait_for_timeout(200)
    ok(pg.evaluate(E+".pay.status")=='pago' and pg.evaluate("PP.Features.saldo("+E+")")==0,'todas pagas: pedido vira Pago e saldo 0')
    pg.locator('[data-pf="pago|3"]').uncheck(); pg.wait_for_timeout(250)
    ok(pg.evaluate(E+".pay.status")=='aguardando' and pg.evaluate("PP.Features.saldo("+E+")")==1605,'desmarcar a última parcela reabre o pedido (saldo 1.605)')
    # prazo personalizado e desfazer
    pg.fill('#parcTxt','25/40'); pg.click('#parcBox [data-h=parcGerar]'); pg.wait_for_timeout(500)
    ok(pg.locator('#parcTab tbody tr').count()==2 and pg.evaluate("JSON.stringify("+E+".pay.parc.map(p=>p.dias))")=='[25,40]','prazo digitado "25/40" gera 2 parcelas (25 e 40 dias)')
    ok(pg.evaluate(E+".pay.pago")==3210 and 'ficou em' in pg.inner_text('#toasts'),'refazer reaplica o recebido em ordem (4.815 -> a 1ª parcela de 3.210 fica paga) e avisa o ajuste')
    pg.click('[data-h=parcUndo]'); pg.wait_for_timeout(400)
    ok(pg.locator('#parcTab tbody tr').count()==4,'"Desfazer a troca" devolve as 4 parcelas')
    pg.fill('#parcTxt','ab'); pg.click('#parcBox [data-h=parcGerar]'); pg.wait_for_timeout(200)
    ok('Digite os prazos' in pg.inner_text('#parcMsg') and pg.locator('#parcTab tbody tr').count()==4,'prazo inválido avisa e não mexe nas parcelas')
    # total mudou (mortalidade/desconto): aviso + redistribuir
    pg.evaluate(E+".totais.total=6000;PP.saveHist()"); pg.evaluate("PP.go('hist')"); abrir(pg)
    ok(pg.is_visible('#parcDif') and 'somam R$' in pg.inner_text('#parcDif'),'soma das parcelas diferente do total: aparece aviso')
    pg.click('[data-h=parcRedis]'); pg.wait_for_timeout(400)
    ok(abs(pg.evaluate("PP.Features.somaParc("+E+")")-6000)<0.01 and pg.evaluate("PP.Features.parcelas("+E+")[0].valor")==1605,'redistribuir fecha em 6.000 sem mexer na parcela já paga')
    # remover parcelamento (com confirmação) e desfazer
    pg.click('[data-h=parcDel]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.Features.parcelas("+E+").length")==0 and pg.is_visible('[data-h=parcUndo]'),'remover parcelamento tira as parcelas e oferece "Desfazer remoção"')
    pg.click('[data-h=parcUndo]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("PP.Features.parcelas("+E+").length")==4,'desfazer a remoção traz as parcelas de volta')
    # previsão a receber usa o vencimento das parcelas
    pt=pg.evaluate("(()=>{const P=PP.hojeplus.pontos(60);return {tot:P.total+P.depois}})()")
    ok(abs(pt['tot']-pg.evaluate("PP.S.hist.filter(PP.Features.active).reduce((a,e)=>a+PP.Features.situacao(e,PP.Features.todayISO(),7).saldo,0)"))<0.02,'previsão a receber soma o mesmo saldo em aberto (R$ %.2f)'%pt['tot'])
    d=pg.evaluate("(()=>{const e="+E+",h=PP.Features.todayISO();const P=PP.hojeplus.pontos(15);return P.B.reduce((a,b)=>a+b.v,0)})()")
    ok(d<pg.evaluate("PP.S.hist.filter(PP.Features.active).reduce((a,e)=>a+PP.Features.situacao(e,PP.Features.todayISO(),7).saldo,0)"),'janela de 15 dias não inclui parcelas que vencem só daqui a 28+ dias')
    # dar baixa com parcelas quita todas
    pg.evaluate("PP.go('hist')"); pg.wait_for_timeout(300)
    pg.locator('#histTb [data-h=baixa][data-id=hv]').click(); pg.wait_for_timeout(500)
    ok(pg.evaluate(E+".pay.status")=='pago' and pg.evaluate("PP.Features.parcelas("+E+").every(p=>p.pago)") and pg.evaluate("PP.Features.saldo("+E+")")==0,'"Dar baixa" marca todas as parcelas como pagas')
    pg.screenshot(path='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/p1.png')
    ok(not errs,'sem erros de JavaScript: %s'%errs[:2])
    ctx.close()
    # tela do celular + captura do bloco de parcelas
    ctx,pg,errs=abre(b,412,900)
    abrir(pg); pg.click('#parcBox [data-v="30/40/50/60"]'); pg.wait_for_timeout(400)
    ok(pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+2"),'celular: sem rolagem lateral da página')
    pg.locator('[data-pf="boleto|0"]').check(); pg.locator('[data-pf="pago|0"]').check(); pg.wait_for_timeout(300)
    pg.locator('#parcBox').scroll_into_view_if_needed(); pg.wait_for_timeout(200)
    ok(not errs,'celular sem erros de JavaScript')
    ctx.close(); b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
