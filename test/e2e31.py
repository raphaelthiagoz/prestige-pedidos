from playwright.sync_api import sync_playwright
import base64,subprocess,os,openpyxl
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e31/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
L=[[16,300,'OTOCINCLUS HOPPEI','LIMPA VIDRO',.12],[10,450,'PARACHEIRODON AXELRODI','CARDINAL',.16],[10,200,'HEMIGRAMMUS BLEHERI','RODOSTOMUS',.12],[3,700,'PARACHEIRODON SIMULANS','NEON VERDE',.12],[4,250,'CARNEGIELLA STRIGATA','BORBOLETA LISTRADA',.16],[8,100,'CORYDORAS SCHWARTZI','CORIDORA',.15],[3,250,'CORYDORAS SCHWARTZI','CORIDORA',.12],[3,200,'CORYDORAS ELEGANS','CORIDORA',.12],[3,100,'CORYDORAS SODALIS','CORIDORA',.15],[1,250,'DICROSSUS MACULATUS','XADREZINHO',.16],[3,40,'DIANEMA UROSTRIATUM','DIANEMA',1],[1,30,'BROCHIS SPLENDENS','LIMPA FUNDO VERDE',2]]
import json
items=[{'boxes':b,'qpb':q,'sci':s,'pt':p,'price':pr} for b,q,s,p,pr in L]
with sync_playwright() as p:
    b=p.chromium.launch(); ctx=b.new_context(viewport={'width':1400,'height':1000},device_scale_factor=1.5,accept_downloads=True,service_workers='block'); pg=ctx.new_page()
    errs=[]; pg.on('pageerror', lambda e: errs.append(str(e)))
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(500); pg.evaluate("document.getElementById('config').open=false")
    pg.click('#nav button[data-view="exp"]'); pg.wait_for_timeout(300)
    pg.evaluate("(it)=>{const s=PP.exp.state();s.items=it;s.ex.fee=12;PP.exp.render()}",items); pg.wait_for_timeout(400)
    t=pg.inner_text('#vExp')
    ok('Discount' in t and 'DOA' in t and 'Frete pré-pago' in t,'campos Discount / DOA / Frete na tela de exportação')
    names=pg.evaluate("PP.exp.docList().map(d=>d.id+':'+d.name)")
    ok(any(n.startswith('inv:INVOICE_') and 'ORIGINAL' not in n for n in names) and not any(n.startswith('adu') for n in names),'sem discount/DOA/frete: só a invoice normal')
    pg.fill('[data-xp="ex.disc"]','500'); pg.fill('[data-xp="ex.doa"]','150'); pg.fill('[data-xp="ex.tarifa"]','8.45')
    pg.wait_for_timeout(300)
    names=pg.evaluate("PP.exp.docList().map(d=>d.id+':'+d.name)"); print(names[:3])
    ok(any('ORIGINAL' in n for n in names) and any(n.startswith('adu') and 'ADUANA' in n for n in names),'com extras: ORIGINAL + ADUANA na lista')
    note=pg.inner_text('#xAduNote'); print('  nota:',note.replace('\n',' | '))
    ok('2,625.00' in note and '7,019.00' in note and '4,394.00' in note,'nota mostra 2.625 líquido, aduana 2.625 + frete 4.394 = 7.019')
    pg.screenshot(path=OUT+'form.png')
    pg.click('[data-xa="prev"]'); pg.wait_for_timeout(500)
    sub=pg.inner_text('#xPrev'); ok('Invoice ORIGINAL' in sub and 'Invoice ADUANA' in sub,'abas ORIGINAL / ADUANA na prévia')
    st=pg.inner_text('#xStage'); ok('DISCOUNT' in st and 'DOA' in st and '2,625.00' in st,'prévia original com DISCOUNT, DOA e total 2.625')
    pg.screenshot(path=OUT+'prev_orig.png')
    pg.click('[data-xiv="adu"]'); pg.wait_for_timeout(400)
    st=pg.inner_text('#xStage'); ok('PRE-PAID FREIGHT' in st and '7,019.00' in st and '1,845.00' in st,'prévia aduana: peixes 1.845 + fee 780 + frete 4.394 = 7.019')
    ok('Fecha com a invoice original' in st,'faixa verde de conferência')
    pg.screenshot(path=OUT+'prev_adu.png')
    # editar um preço à mão -> demais se ajustam e continua fechando
    sp=pg.locator('#xStage [data-xe$=".padu"]').first
    sp.click(); sp.fill('0.10'); pg.keyboard.press('Enter'); pg.wait_for_timeout(500)
    st=pg.inner_text('#xStage'); ok('1,845.00' in st and 'Fecha com a invoice original' in st,'digitar um preço à mão: os outros se acertam e continua fechando')
    pr=pg.evaluate("PP.exp.state().items[0].padu"); ok(str(pr) in ('0.10','0.1'),'preço manual guardado (padu)')
    pg.screenshot(path=OUT+'prev_adu_manual.png')
    pg.click('[data-xa="aduReset"]'); pg.wait_for_timeout(300)
    ok(pg.evaluate("PP.exp.state().items.every(x=>x.padu===undefined)"),'Recalcular tudo limpa os preços digitados')
    # arquivos
    for did in ['inv','adu']:
        b64=pg.evaluate("async(id)=>{const d=PP.exp.docList().find(x=>x.id==id);const u=await d.build();let s='';for(let i=0;i<u.length;i+=8192)s+=String.fromCharCode.apply(null,u.subarray(i,i+8192));return btoa(s)}",did)
        open(OUT+did+'.xlsx','wb').write(base64.b64decode(b64))
    print('errs',errs); ok(not errs,'sem erros de página')
    b.close()
for did,exp_total,txt in [('inv',2625,['DISCOUNT','DOA']),('adu',7019,['PRE-PAID FREIGHT'])]:
    subprocess.run(['soffice','--headless','--convert-to','pdf','--outdir',OUT,OUT+did+'.xlsx'],capture_output=True)
    sheets=openpyxl.load_workbook(OUT+did+'.xlsx')['Invoice']
    labels=[c.value for r in sheets.iter_rows(min_row=26,max_row=40) for c in r if isinstance(c.value,str)]
    ok(all(t in labels for t in txt),f'{did}: linhas {txt} no arquivo')
    out=subprocess.run(['pdftotext','-f','2','-l','2','-layout',OUT+did+'.pdf','-'],capture_output=True,text=True).stdout
    import re
    ok(f'{exp_total:,.2f}' in out,f'{did}: total {exp_total:,.2f} calculado no xlsx')
    subprocess.run(['pdftoppm','-r','80','-f','2','-l','2','-png',OUT+did+'.pdf',OUT+'x_'+did])
print('FALHAS',fails)
