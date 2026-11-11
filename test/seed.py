# Dados de exemplo para testes visuais (datas relativas a hoje)
SEED = """()=>{
  const F=PP.Features, t=F.todayISO(), d=n=>F.addDays(t,n), U=()=>'x'+Math.random().toString(36).slice(2,8);
  const L=(id,cli,aero,cx,st,awb)=>({id,cliente:cli,aero,cidade:'',caixas:cx,peso:'',dim:'',awb:awb||'',status:st,chegou:'',obs:'',pedidoId:''});
  const emb=[
    {id:'eH',titulo:'EMBARQUES NACIONAIS',saida:t,chegadaPrev:d(1),linhas:[L('a1','NACIONAL','GRU',17,'embarcado','957-42508642'),L('a2','RAQUEL','CGH',2,'embarcado'),L('a3','RICARDO MANJOR','CNF',6,'programado'),L('a4','UBER PEIXES','GIG',4,'programado')]},
    {id:'eO',titulo:'EMBARQUES NACIONAIS',saida:d(-2),chegadaPrev:d(-1),linhas:[L('b1','LENI LUZINETE','GRU',5,'chegou'),L('b2','ANDRADE','BSB',3,'chegou')]}];
  PP.S.embarques=emb; PP.store.set('embarques',emb);
  const H=[]; for(let w=0;w<8;w++){ for(let k=0;k<2;k++){ const tot=1800+w*420+k*310+(w%3)*260; H.push({id:'h'+w+k,ts:Date.now()-w*7*864e5-k*1e6,cliente:{nome:k?'LENI LUZINETE':'NACIONAL'},inv:String(180+w*2+k),nf:'0000'+(8900+w*2+k),dataISO:d(-w*7-k*2),totais:{caixas:12,peixes:3000,total:tot},pay:{status:w<3?'aguardando':'pago',pago:w<3?0:tot},lines:[]}); } }
  H.push({id:'hv',ts:Date.now()-12*864e5,cliente:{nome:'ANDRADE'},inv:'170',nf:'000008870',dataISO:d(-12),totais:{caixas:9,peixes:2000,total:6420},pay:{status:'aguardando',pago:0},lines:[]});
  PP.S.hist=H; PP.store.set('hist',H);
  PP.S.clientes=[{nome:'NACIONAL',end:'',aero:'GRU',cidade:'São Paulo - SP',desc:0,precos:''},{nome:'LENI LUZINETE',end:'',aero:'GRU',cidade:'',desc:0,precos:''},{nome:'ANDRADE',end:'',aero:'BSB',cidade:'',desc:0,precos:''}]; PP.store.set('clientes',PP.S.clientes);
  PP.store.set('fretes',{cfg:{taxa:90},rec:{'eO|b1':{cte:'000.100.001',awb:'957-1',frete:1030.73,taxa:90,hora:'13:45',avisado:true},'eO|b2':{cte:'000.100.002',awb:'957-2',frete:352.18,taxa:90,hora:'15:10',avisado:true,pago:true,pagoEm:t}}});
  PP.store.set('catalog',[{id:1,sci:'X',comum:'X',preco:1}]); PP.S.catalog=PP.store.get('catalog',[]);
  PP.store.set('lastBackup',Date.now()-9*864e5);
  PP.reloadState();
}"""
