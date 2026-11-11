import sys, os, json; sys.path.insert(0,'test')
from seed import SEED
from playwright.sync_api import sync_playwright
OUT='/tmp/claude-0/-home-claude/48154143-1c92-5c72-a63a-d8264194645f/scratchpad/e2e53/'; os.makedirs(OUT,exist_ok=True)
fails=[]
def ok(c,m):
    print(('  ok  ' if c else '  FAIL ')+m)
    if not c: fails.append(m)
M1="Bom dia,\n\nSegue documentos.\n\nINV.: 016/2026\nMAWB: 074-70222390\nHAWB: DM-00058834\nLPCO IBAMA: E2600604683 Em resposta de exigência\nLPCO MAPA: E2600665213\nDU-E: 26BR001971465-1\n\nProgramação de entrega: 07/11/2026 (sabado) as 11 horas\nMAO/GRU – via gol\nG31545 – 01:35 – 06:30\n\nINTERNACIONAL\n\nGRU/AMS - KL0792 - 08/11/2026\n"
with sync_playwright() as p:
    b=p.chromium.launch(); pg=b.new_context(viewport={'width':1500,'height':1000},service_workers='block').new_page()
    errs=[]; pg.on('pageerror',lambda e:errs.append(str(e))); pg.on('dialog',lambda d:d.accept())
    pg.goto('http://localhost:8765/index.html'); pg.wait_for_timeout(400); pg.evaluate(SEED); pg.evaluate("sessionStorage.setItem('pp.asShown','1')"); pg.reload(); pg.wait_for_timeout(700)
    # ---- exportação: colar e-mail
    pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(400)
    if pg.locator('#xMailBox').count()==0:
        pg.click('[data-xgnew]'); pg.wait_for_timeout(500)
    ok(pg.locator('#xMailBox').count()==1,'bloco "Colar o e-mail do despachante" na exportação')
    pg.evaluate("document.getElementById('xMailBox').open=true"); pg.fill('#xMailIn',M1); pg.click('[data-xa="mailin"]'); pg.wait_for_timeout(500)
    V=lambda p_: pg.input_value('[data-xp="%s"]'%p_)
    ok(V('ex.mawb')=='074-70222390' and V('ex.hawb')=='DM-00058834','MAWB e HAWB preenchidos')
    ok(V('ex.lpcoIbama')=='E2600604683' and V('ex.lpcoMapa')=='E2600665213','LPCO IBAMA e MAPA preenchidos')
    ok(V('ex.dued')=='26BR001971465-1' and V('ex.voo')=='KL0792','DU-E e voo internacional preenchidos')
    ok(V('ex.entrega')=='07/11/2026 às 11:00' and 'G31545' in V('ex.dom'),'entrega e voo doméstico: %s | %s'%(V('ex.entrega'),V('ex.dom')))
    msg=pg.inner_text('#xMailBox .warnbox'); print(msg)
    ok('exigência' in msg,'avisa LPCO IBAMA em exigência')
    pg.locator('#xMailBox').scroll_into_view_if_needed(); pg.screenshot(path=OUT+'exp.png')
    # colar de novo via Ctrl+V na tela com outro MAWB
    pg.evaluate("""(m)=>{const dt=new DataTransfer();dt.setData('text/plain',m);document.body.dispatchEvent(new ClipboardEvent('paste',{clipboardData:dt,bubbles:true,cancelable:true}));}""",M1.replace('074-70222390','074-11112222')); pg.wait_for_timeout(500)
    ok(V('ex.mawb')=='074-11112222' and 'antes: 074-70222390' in pg.inner_text('#xMailBox .warnbox'),'Ctrl+V na tela atualiza e mostra o valor anterior')
    pg.reload(); pg.wait_for_timeout(700); pg.evaluate("PP.go('exp')"); pg.wait_for_timeout(400)
    ok(pg.locator('[data-xp="ex.mawb"]').count()==0 or V('ex.mawb')=='074-11112222','rascunho guarda os dados depois de recarregar')
    # ---- CTFs reais em lote
    pg.evaluate("PP.go('mapa')"); pg.wait_for_timeout(400); pg.click('[data-tab=nfs]'); pg.wait_for_timeout(200)
    pg.set_input_files('#nfpdf',['test/fx/real_nf_bento1.pdf','test/fx/real_nf_bebeto.pdf','test/fx/real_nf_bento2.pdf','test/fx/real_nf_bento3.pdf']); pg.wait_for_timeout(9000)
    pg.click('[data-act=salvarrev]'); pg.wait_for_timeout(700)
    nfs=pg.evaluate("PP.mapa.estado().nfs.map(n=>({n:n.numero,f:n.fornecedor,i:n.itens.map(i=>i.esp+'='+i.qtd)}))"); print(json.dumps(nfs,ensure_ascii=False))
    q={x['n']:x for x in nfs}
    ok(len(nfs)==4,'4 NFs reais lidas de uma vez')
    ok(any('genibarbis' in i and i.endswith('=100') for i in q['1709429']['i']),'NF 1709429: P. genibarbis 100')
    ok(len(q['1707627']['i'])==2 and any(i.endswith('=2000') for i in q['1707627']['i']) and any(i.endswith('=1500') for i in q['1707627']['i']),'NF 1707627: Dianema 2000 + Brochis 1500')
    ok(any('eques' in i and i.endswith('=1000') and '(' not in i for i in q['1706547']['i']),'NF 1706547: N. eques 1000, nome sem parêntese solto: %s'%q['1706547']['i'])
    ok(len(q['1706067']['i'])==3 and any(i.endswith('=42000') for i in q['1706067']['i']) and any(i.endswith('=8000') for i in q['1706067']['i']),'NF 1706067: 3 espécies (1000, 8000, 42000)')
    pg.click('[data-tab=pesc]'); pg.wait_for_timeout(300)
    pg.set_input_files('#pescLote',['test/fx/real_ctf_bento.pdf','test/fx/real_ctf_romerio.pdf','test/fx/real_ctf_bebeto.pdf']); pg.wait_for_timeout(6000)
    ps={x['nome']:x for x in pg.evaluate("PP.mapa.estado().meta.pesc")}; print({k:(v.get('ctf'),bool(v.get('ctfArq'))) for k,v in ps.items()})
    bento=[v for k,v in ps.items() if 'bento' in k.lower()]; beb=[v for k,v in ps.items() if 'bebeto' in k.lower()]; rom=[v for k,v in ps.items() if 'romerio' in k.lower()]
    ok(len(bento)==1 and bento[0]['ctf']=='2027-02-09' and bento[0]['ctfArq'],'CTF do Bento foi para o pescador da NF (sem duplicar), validade 09/02/2027')
    ok(len(beb)==1 and beb[0]['ctf']=='2026-12-08','CTF do Bebeto: 08/12/2026')
    ok(len(rom)==1 and rom[0]['ctf']=='2027-02-04','CTF do Romerio: pescador novo criado, 04/02/2027')
    print(pg.inner_text('#mpView .alert.ok'))
    # RGP real: guarda, sem inventar validade
    row=pg.locator('#mpView tbody tr',has_text='Bento').first
    row.locator('input[data-pfile=rgp]').set_input_files('test/fx/real_rgp_aramar.pdf'); pg.wait_for_timeout(2500)
    bt=[v for k,v in {x['nome']:x for x in pg.evaluate("PP.mapa.estado().meta.pesc")}.items() if 'bento' in k.lower()][0]
    ok(bt['rgpArq'] and not bt.get('rgpVal'),'RGP (carteira sem validade): guardado e sem data inventada')
    pg.screenshot(path=OUT+'pesc.png')
    ok(not errs,'sem erros de JS: %s'%errs)
    b.close()
print('\nFALHAS:',fails if fails else 'nenhuma'); sys.exit(1 if fails else 0)
