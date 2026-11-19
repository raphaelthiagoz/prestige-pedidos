# v29.20: Exportação no layout C, requerimento, etiqueta menor, CZI (peso líquido, data final, código), troca de modelo, revisão
import sys, os, zipfile, re
sys.path.insert(0,'test')
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e80/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
def txt(path):
    x=zipfile.ZipFile(path).read('word/document.xml').decode()
    return '\n'.join(''.join(re.findall(r'<w:t[^>]*>([^<]*)</w:t>',p)) for p in re.findall(r'<w:p[ >].*?</w:p>',x,re.S))
VALS={'ex.nf':'00008950/8951 S-2','ex.dued':'26BR002109793-1','ex.mawb':'074-70222412','ex.hawb':'DM-00058919','ex.lpcoIbama':'E2600666220','ex.lpcoMapa':'E2600694032','ex.gta':'123456','ex.serie':'H','ex.vooNac':'G31573','ex.vooNacSai':'2026-11-24T16:55','ex.vooNacChe':'2026-11-24T22:00','ex.voo':'KL0792','ex.dep':'2026-11-25T20:59','ex.vooIntChe':'2026-11-26T12:20','ex.pkDate':'2026-11-24','ex.reqDate':'2026-11-19'}
def setv(pg,k,v): pg.evaluate("([k,v])=>{const e=document.querySelector(`[data-xp=\"${k}\"]`); const d=e.closest('details'); if(d) d.open=true; e.value=v; e.dispatchEvent(new Event('input',{bubbles:true})); e.dispatchEvent(new Event('change',{bubbles:true}));}",[k,v])
def baixa(pg,did,nome):
    with pg.expect_download() as d: pg.click(f'[data-xdl="{did}"]')
    p=OUT+nome; d.value.save_as(p); return p
errs=[]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1440,'height':1000},service_workers='block',accept_downloads=True); pg=ctx.new_page(); pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    # dados antigos salvos da Ruinemans (telefone velho, MONTFORT) -> devem ser corrigidos sozinhos
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('bkSnooze',Date.now()+9e9);PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1);PP.store.set('expcfg',{last:17,ano:2026,cons:{AMS:{phone:'+31 20 316 5090',addrAt:'IJSSELVELD 9, 3417 XH MONTFORT'}},ordem:[],used:[]})")
    pg.reload(); pg.wait_for_timeout(1500); pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(500)
    pg.click('[data-xdest="AMS"]'); pg.wait_for_timeout(300)
    ok(pg.is_visible('.xC .xCside #xSum') and pg.is_visible('.xCmain'),'layout C: pedido à esquerda e resumo fixo à direita')
    pg.set_input_files('#xFile','test/fx/stock_dec_real.xlsx'); pg.wait_for_timeout(2500)
    ok('66' in pg.inner_text('#xSumTot') and '4,147.00' in pg.inner_text('#xSumTot'),'resumo: 66 caixas e total US$ 4,147.00')
    ok(pg.locator('[data-xfish]').count()==12 and pg.inner_text('[data-xfish="0"]').strip()!='','tabela com colunas Peixes e Subtotal (12 espécies)')
    ok('PIABA' in [pg.input_value(f'[data-xi="{i}"][data-xk="pt"]') for i in range(12)],'Tucanoichthys tucano aparece como PIABA')
    ok('falta para gerar' in pg.inner_text('#xSumFalta').lower() and 'MAWB' in pg.inner_text('#xSumFalta'),'"Falta para gerar" lista o que está em branco')
    sw=pg.evaluate("(()=>{const w=document.querySelector('.xC .tablewrap');return w.scrollWidth-w.clientWidth})()")
    ok(sw<=2,'a tabela do pedido cabe sem rolar de lado (sobra %d px)'%sw)
    # ordersheet do cliente (Ruinemans): Species + Boxes; preço e qtd/caixa da stocklist guardada
    pg.set_input_files('#xFile','test/fx/ordersheet_ruinemans.xlsx'); pg.wait_for_timeout(2000)
    m=pg.inner_text('#xMsg'); print('  ',m[:160])
    ok('RUINEMANS AQUARIUM B.V.' in m and '26000847' in m and '11 espécies, 100 caixas' in m,'ordersheet da Ruinemans lido: pedido 26000847, 11 espécies, 100 caixas')
    vals=[[pg.input_value(f'[data-xi="{i}"][data-xk="{k}"]') for k in ['sci','boxes','qpb','price']] for i in range(11)]
    d={v[0]:v for v in vals}
    ok(d.get('PARACHEIRODON AXELRODI',[0,'',''])[1:3]==['10','450'] and d['PARACHEIRODON AXELRODI'][3]=='0.16','cardinal: 10 caixas, 450/cx e US$ 0,16 vindos da stocklist')
    ok('OTOCINCLUS VITTATUS L' in m and d.get('OTOCINCLUS VITTATUS',['','','x'])[2]=='','espécie que não está na stocklist entra em branco e é avisada')
    ok('SCHWARTZI HIGHFIN' in m and 'ROBUSTA' in m,'nome ou tamanho parecido (highfin, robusta/robustus) vem marcado para conferir')
    pg.set_input_files('#xFile','test/fx/stock_dec_real.xlsx'); pg.wait_for_timeout(2000)
    # revisão com campos em branco
    pg.click('#xSum [data-xa="revisao"]'); pg.wait_for_timeout(400)
    ok(pg.is_visible('#xRev') and 'para corrigir' in pg.inner_text('#xRev'),'Revisão antes do MAPA abre e aponta o que corrigir')
    pg.locator('#xRev [data-go="ex.mawb"]').first.click(); pg.wait_for_timeout(600)
    ok(pg.evaluate("document.activeElement && document.activeElement.dataset.xp")=='ex.mawb','"Ir para o campo" leva ao MAWB')
    for k,v in VALS.items(): setv(pg,k,v)
    setv(pg,'date','2026-11-24'); pg.wait_for_timeout(400)
    rv=pg.inner_text('#xRev'); print('   revisão:', rv.split('\n')[1] if '\n' in rv else rv[:80])
    ok('1 para corrigir' in rv and pg.locator('#xRev .revi.s-b').count()==1 and 'sem saldo de NF' in pg.inner_text('#xRev .revi.s-b') and 'datas estão em ordem' in rv,'revisão: com tudo preenchido só sobra em vermelho a falta de NF de entrada (o teste não tem NFs) e as datas estão em ordem')
    ok('25/11/2026 (partida de GRU)' in rv and '66,00 kg' in rv and '13026030787' in rv,'revisão mostra data final do CZI, peso líquido (66 kg) e código do estabelecimento')
    setv(pg,'ex.vooNacSai','2026-11-26T16:55'); pg.wait_for_timeout(300)
    ok('Saída de MAO está antes' in pg.inner_text('#xRev') or 'Chegada em GRU está antes' in pg.inner_text('#xRev'),'revisão pega data fora de ordem (saída de MAO depois da chegada em GRU)')
    setv(pg,'ex.vooNacSai','2026-11-24T16:55'); pg.wait_for_timeout(300)
    pg.screenshot(path=OUT+'revisao.png',full_page=True)
    # documentos
    ids=pg.evaluate("[...document.querySelectorAll('[data-xdl]')].map(b=>b.dataset.xdl)")
    ok('req' in ids and 'etm' in ids,'lista de documentos tem Requerimento ao MAPA e Etiquetas menores')
    r=txt(baixa(pg,'req','req.docx'))
    ok('MAO – GRU G31573 – 16:55 – 22:00 (24/11/26)' in r and 'GRU – AMS KL0792 – 20:59 – 12:20 (+1) (25/11/26)' in r,'requerimento: trajeto MAO–GRU e GRU–AMS com voos, horários, (+1) e datas')
    ok('dezessete mil e seiscentos' in r and '17.600' in r,'requerimento: total 17.600 e por extenso')
    ok('MAWB: 074-70222412' in r and 'HAWB: DM-00058919' in r and 'LPCO IBAMA: E2600666220' in r and 'DU-E: 26BR002109793-1' in r,'requerimento: MAWB, HAWB, LPCO IBAMA e DU-E')
    ok('0031 348 479 800' in r and 'purchase@ruinemans.com' in r and 'MONTFORT' not in r and 'MONTFOORT' in r,'requerimento: contato novo da Ruinemans e MONTFOORT')
    ok('enir@dmarcos.com.br' in r and 'MANAUS-AMAZONAS, 19 DE NOVEMBRO DE 2026' in r,'requerimento: e-mail do despachante corrigido e data do dia em que assina')
    ok('PIABA' in r and '\nTUCANO\n' not in r,'requerimento: Tucanoichthys tucano = PIABA')
    x=zipfile.ZipFile(OUT+'req.docx').read('word/document.xml').decode(); ok('SUM(ABOVE)' not in x,'requerimento: total fixo (sem a fórmula que o Word recalculava errado)')
    em=txt(baixa(pg,'etm','etm.docx'))
    ok(em.count('MAWB Nº: 074-70222412')==70 and em.count('AIRPORT DESTINY: AMS')==70 and 'DM-00058919' in em,'etiquetas menores: 7 folhas × 10 (66 caixas) com MAWB, HAWB e AMS')
    cz=txt(baixa(pg,'cz:EN','czi.docx'))
    ok('Peso líquido/ Net weight: 66,00 KG' in cz and '528,00 KG' in cz,'CZI: peso líquido = 66,00 kg (caixas); peso total 528,00 kg')
    ok('Date: São Paulo, 25 de novembro de 2026' in cz and '25/11/2026 – 20:59' in cz,'CZI: data final = partida de GRU (25/11), não a saída do aquário (24/11)')
    ok(cz.count('Código Estabelecimento N° 13026030787')==2,'CZI: código do estabelecimento nos 2 lugares')
    ok('MONTFORT' not in cz and 'PIABA' in cz and 'E2600694032' in cz,'CZI: MONTFOORT, PIABA e LPCO MAPA')
    pg.fill('#xEstab','99999'); pg.dispatch_event('#xEstab','change'); pg.wait_for_timeout(300)
    ok('Código Estabelecimento N° 99999' in txt(baixa(pg,'cz:EN','czi2.docx')),'código do estabelecimento editável (fica guardado)')
    pg.fill('#xEstab','13026030787'); pg.dispatch_event('#xEstab','change'); pg.wait_for_timeout(300)
    # trocar modelo do CZI e voltar
    pg.set_input_files('[data-xtpl="cziEN"]','test/fx/czi_ams_antigo.docx'); pg.wait_for_timeout(800)
    ok('modelo seu' in pg.inner_text('#xDocs') and pg.locator('[data-xa="tplback"][data-k="cziEN"]').count()==1,'"Trocar modelo": CZI enviado fica marcado como modelo seu, com "Voltar ao anterior"')
    c2=txt(baixa(pg,'cz:EN','czi3.docx'))
    ok('Código Estabelecimento' not in c2 and 'Peso líquido/ Net weight: 66,00 KG' in c2,'o CZI sai do modelo enviado (o antigo não tem o código), já com as regras novas')
    pg.click('[data-xa="tplback"][data-k="cziEN"]'); pg.wait_for_timeout(500)
    ok(pg.locator('[data-xa="tplback"]').count()==0 and 'Código Estabelecimento' in txt(baixa(pg,'cz:EN','czi4.docx')),'"Voltar ao anterior" volta para o modelo embutido')
    pg.set_input_files('[data-xtpl="cziEN"]','test/fx/stock_dec_real.xlsx'); pg.wait_for_timeout(500)
    ok(pg.locator('[data-xa="tplback"]').count()==0,'arquivo que não é .docx é recusado')
    # zip do MAPA
    with pg.expect_download() as d: pg.click('#xRev [data-xa="zipmapa"]')
    zp=OUT+'mapa.zip'; d.value.save_as(zp); nm=zipfile.ZipFile(zp).namelist(); print('  ',nm)
    ok(len(nm)==5 and any('REQUERIMENTO' in n for n in nm) and any('PACKING' in n for n in nm) and any('CZI' in n for n in nm) and sum('ATESTADO' in n for n in nm)==2,'"Baixar só os do MAPA": requerimento, packing, 2 atestados e CZI')
    ok(not errs,'sem erros de JavaScript: %s'%errs[:2])
    pg.evaluate("scrollTo(0,0)"); pg.screenshot(path=OUT+'exp.png')
    ctx.close()
    # celular
    ctx=b.new_context(viewport={'width':412,'height':900},service_workers='block'); pg=ctx.new_page(); pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500)
    pg.evaluate("sessionStorage.setItem('pp.asShown','1');PP.store.set('guiaVisto',1);PP.store.set('tourVisto',1)"); pg.reload(); pg.wait_for_timeout(1200); pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(500)
    ok(pg.evaluate("document.querySelector('#xSum').getBoundingClientRect().top < document.querySelector('.xCmain').getBoundingClientRect().top"),'celular: resumo vem antes do pedido')
    ok(pg.evaluate("document.documentElement.scrollWidth<=document.documentElement.clientWidth+2"),'celular: sem rolagem lateral da página')
    pg.screenshot(path=OUT+'cel.png'); ctx.close(); b.close()
print('\nFALHAS:',len(fails)); sys.exit(1 if fails else 0)
