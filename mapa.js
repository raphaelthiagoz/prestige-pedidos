/* Notas de entrada (MAPA) — controle de saldo das NFs de entrada por espécie.
   Núcleo e telas portados do app "Conferência MAPA" (lógica preservada), agora dentro do app,
   guardando em PP.store('mapa') (sincroniza com a nuvem junto com o resto). */
(function () {
var PP = window.PP;
/* ====================== NÚCLEO (lógica de saldo) ====================== */
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7);}
function p2(n){return (n<10?'0':'')+n;}
function hoje(){var d=new Date();return d.getFullYear()+'-'+p2(d.getMonth()+1)+'-'+p2(d.getDate());}
function norm(s){return String(s||'').normalize('NFD').replace(/[̀-ͯ]/g,'').toLowerCase().replace(/\./g,' ').replace(/\s+/g,' ').trim();}
function parseQtd(s){var d=String(s==null?'':s).replace(/\D/g,'');return d?parseInt(d,10):0;}
function novoDraft(){return {pack:'',sei:'',destino:'',data:'',historico:false,linhas:[]};}
function novoEstado(){return {nfs:[],processos:[],draft:novoDraft(),meta:{},marcas:[]};}

/* nome cientifico (2 primeiras palavras) e o resto como nome comum */
var _pc={};
function parseEsp(s){
  var k=norm(s);if(_pc[k])return _pc[k];
  var t=k?k.split(' '):[];
  var r={full:k,g:t[0]||'',e:t.length>1?t[1]:'',c:t.slice(2).join(' ')};
  _pc[k]=r;return r;
}
function mesmaEsp(a,b){
  var x=parseEsp(a),y=parseEsp(b);
  if(!x.full||!y.full)return false;
  if(x.full===y.full)return true;
  if(x.e&&y.e&&x.e===y.e){
    if(x.g===y.g)return true;
    if(x.g.length===1&&y.g.charAt(0)===x.g)return true;
    if(y.g.length===1&&x.g.charAt(0)===y.g)return true;
  }
  if(y.c&&x.full===y.c)return true;
  if(x.c&&y.full===x.c)return true;
  return false;
}
function nomeSci(s){var w=String(s||'').trim().split(/\s+/);if(!w[0])return '';var g=w[0].charAt(0).toUpperCase()+w[0].slice(1).toLowerCase();return w.length>1?g+' '+w[1].toLowerCase():g;}
function nomeComum(s){var w=String(s||'').trim().split(/\s+/).slice(2).join(' ').toLowerCase();return w?w.charAt(0).toUpperCase()+w.slice(1):'';}

function parseLinhas(t){
  var out=[];
  String(t||'').split(/\r?\n/).forEach(function(l){
    l=l.trim(); if(!l) return;
    var m=l.match(/\d[\d.,]*/g); if(!m) return;
    var tok=m[m.length-1];
    var i=l.lastIndexOf(tok);
    var esp=(l.slice(0,i)+' '+l.slice(i+tok.length))
      .replace(/^(?:\s*[\d.,]+(?:\s*-\s*[\d.,]+)?(?=\s|$))+/,'')
      .replace(/\b(un|und|unid|unidades|pcs)\b\.?/ig,' ')
      .replace(/^[\s\-–—:;|x×]+|[\s\-–—:;|x×]+$/g,'').replace(/\s+/g,' ').trim();
    var q=parseQtd(tok);
    if(!/[a-zA-ZÀ-ÿ]/.test(esp)||!q) return;
    out.push({esp:esp,qtd:q});
  });
  return out;
}
function nfsOrdenadas(S){return S.nfs.slice().sort(function(a,b){return String(a.data||'').localeCompare(String(b.data||''))||String(a.numero).localeCompare(String(b.numero),'pt-BR',{numeric:true});});}
function getNF(S,id){for(var i=0;i<S.nfs.length;i++){if(S.nfs[i].id===id)return S.nfs[i];}return null;}
function entradaNF(nf,sp){var t=0;nf.itens.forEach(function(i){if(mesmaEsp(i.esp,sp))t+=i.qtd;});return t;}
function usosNF(S,nfId,sp){
  var out=[];
  S.processos.forEach(function(p){
    if(p.status!=='ativo')return;
    var q=0;p.itens.forEach(function(i){if(i.nfId===nfId&&mesmaEsp(i.esp,sp))q+=i.qtd;});
    if(q>0)out.push({pack:p.pack,sei:p.sei,qtd:q,procId:p.id,historico:!!p.historico});
  });
  return out;
}
function saldoNF(S,nfId,sp){
  var nf=getNF(S,nfId);if(!nf)return 0;
  var u=0;usosNF(S,nfId,sp).forEach(function(x){u+=x.qtd;});
  return entradaNF(nf,sp)-u;
}
function especiesNF(nf){
  var out=[];
  nf.itens.forEach(function(i){for(var k=0;k<out.length;k++){if(mesmaEsp(out[k].esp,i.esp))return;}out.push({key:i.esp,esp:i.esp});});
  return out;
}
function resumoNF(S,nf){
  var livres=[],esg=[],neg=false,usadoTotal=0;
  especiesNF(nf).forEach(function(e){
    var ent=entradaNF(nf,e.key),us=usosNF(S,nf.id,e.key),u=0;
    us.forEach(function(x){u+=x.qtd;});
    var o={esp:e.esp,ent:ent,usado:u,saldo:ent-u,usos:us};
    usadoTotal+=u;
    if(o.saldo>0)livres.push(o);else esg.push(o);
    if(o.saldo<0)neg=true;
  });
  var st;
  if(neg)st='estourada';
  else if(!livres.length)st='esgotada';
  else if(esg.length)st='parcial';
  else if(usadoTotal===0)st='livre';
  else st='comsaldo';
  return {livres:livres,esg:esg,neg:neg,usadoTotal:usadoTotal,status:st};
}
function sugerir(S,sp,qtd,jaUsado){
  var falta=qtd,aloc=[];
  nfsOrdenadas(S).forEach(function(nf){
    if(falta<=0)return;
    if(!entradaNF(nf,sp))return;
    var sd=saldoNF(S,nf.id,sp)-((jaUsado&&jaUsado[nf.id])||0);
    if(sd<=0)return;
    var q=Math.min(sd,falta);aloc.push({nfId:nf.id,qtd:q});falta-=q;
  });
  return {aloc:aloc,faltam:falta};
}
function somaDraft(d,nfId,sp){
  var t=0;
  d.linhas.forEach(function(L){if(!mesmaEsp(L.esp,sp))return;L.aloc.forEach(function(a){if(a.nfId===nfId)t+=a.qtd||0;});});
  return t;
}
function algumaNFComSaldo(S,sp){
  for(var i=0;i<S.nfs.length;i++){if(entradaNF(S.nfs[i],sp)>0&&saldoNF(S,S.nfs[i].id,sp)>0)return true;}
  return false;
}
function validarDraft(S,d){
  var res={linhas:[],erros:0,avisos:0};
  d.linhas.forEach(function(L){
    var sp=L.esp,r={problemas:[]},soma=0;
    if(!norm(sp))r.problemas.push({nivel:'erro',tipo:'sem_nome',msg:'Informe a espécie.'});
    if(!(L.qtd>0))r.problemas.push({nivel:'erro',tipo:'sem_qtd',msg:'Informe a quantidade que sai.'});
    L.aloc.forEach(function(a,j){
      soma+=a.qtd||0;
      if(!a.nfId){r.problemas.push({nivel:'erro',tipo:'sem_nf',j:j,msg:'Escolha a NF de entrada.'});return;}
      var nf=getNF(S,a.nfId);
      if(!nf){r.problemas.push({nivel:'erro',tipo:'nf_inexistente',j:j,msg:'NF não encontrada.'});return;}
      var ent=entradaNF(nf,sp);
      if(!ent){r.problemas.push({nivel:'erro',tipo:'sem_especie',j:j,msg:'A NF '+nf.numero+' ('+nf.fornecedor+') não tem esta espécie.'});return;}
      var sd=saldoNF(S,nf.id,sp),usado=somaDraft(d,nf.id,sp);
      if(usado>sd){r.problemas.push({nivel:d.historico?'aviso':'erro',tipo:'sem_saldo',j:j,nf:nf.numero,fornecedor:nf.fornecedor,entrada:ent,saldo:sd,precisa:usado,usos:usosNF(S,nf.id,sp)});}
    });
    if(norm(sp)&&L.qtd>0){
      if(L.aloc.length===0){
        var temEsp=S.nfs.some(function(n){return entradaNF(n,sp)>0;});
        if(!temEsp){var pr=parecidas(S,sp);if(pr.length)r.problemas.push({nivel:'info',tipo:'parecida',nomes:pr});}
        r.problemas.push({nivel:'erro',tipo:'sem_alocacao',semNF:!algumaNFComSaldo(S,sp)});
      }
      else if(soma!==L.qtd)r.problemas.push({nivel:'erro',tipo:'soma',soma:soma,qtd:L.qtd});
    }
    r.problemas.forEach(function(p){if(p.nivel==='erro')res.erros++;else res.avisos++;});
    res.linhas.push(r);
  });
  return res;
}
function conflitosEstado(S){
  var out=[];
  S.nfs.forEach(function(nf){especiesNF(nf).forEach(function(e){var sd=saldoNF(S,nf.id,e.key);if(sd<0)out.push({nf:nf.numero,esp:e.esp,saldo:sd});});});
  return out;
}
function aguardaProt(p){return p.status==='ativo'&&p.protocolado===false;} // processos antigos não têm o campo = já protocolados
function protocolar(S,d){
  var pack=String(d.pack||'').trim(),sei=String(d.sei||'').trim();
  if(!pack)return {ok:false,erro:'Informe o número do pack.'};
  if(!d.linhas.length)return {ok:false,erro:'Adicione ao menos uma espécie.'};
  for(var i=0;i<S.processos.length;i++){
    var p=S.processos[i];if(p.status!=='ativo')continue;
    if(norm(p.pack)===norm(pack))return {ok:false,erro:'Já existe processo ativo com o pack '+pack+'. Se ele foi cancelado, cancele-o na aba Processos primeiro.'};
    if(sei&&norm(p.sei)===norm(sei))return {ok:false,erro:'Já existe processo ativo com este SEI.'};
  }
  var v=validarDraft(S,d);
  if(v.erros)return {ok:false,erro:v.erros+' problema(s) a resolver antes de gravar.'};
  var itens=[];
  d.linhas.forEach(function(L){L.aloc.forEach(function(a){itens.push({esp:String(L.esp).trim(),nfId:a.nfId,qtd:a.qtd});});});
  // gravar o consumo NÃO é protocolar: o pack nasce "aguardando protocolo" (packs antigos/históricos já nascem protocolados)
  var proc={id:uid(),pack:pack,sei:sei,destino:String(d.destino||'').trim(),data:d.data||hoje(),status:'ativo',historico:!!d.historico,protocolado:!!d.historico,dataProt:d.historico?(d.data||hoje()):'',itens:itens};
  S.processos.push(proc);
  return {ok:true,proc:proc};
}

/* ---------- marcacoes do PDF (destaques) x exportacoes ---------- */
function nfDaMarca(S,m){for(var i=0;i<S.nfs.length;i++){var n=S.nfs[i];if(norm(n.numero)===norm(m.nfNum)&&norm(n.fornecedor)===norm(m.nfForn))return n;}return null;}
function addMarcas(S,numero,fornecedor,marcados,itens){
  var n=0;
  (marcados||[]).forEach(function(k){
    for(var i=0;i<S.marcas.length;i++){var m=S.marcas[i];if(norm(m.nfNum)===norm(numero)&&norm(m.nfForn)===norm(fornecedor)&&mesmaEsp(m.esp,k.esp))return;}
    var q=0;(itens||[]).forEach(function(it){if(mesmaEsp(it.esp,k.esp))q+=it.qtd;});
    S.marcas.push({id:uid(),nfNum:String(numero||'').trim(),nfForn:String(fornecedor||'').trim(),esp:k.esp,data:k.data||'',qtdLinha:q,ignorada:false,mais:false,vinc:[]});n++;
  });
  return n;
}
function vincValidos(S,m){
  return (m.vinc||[]).filter(function(v){
    for(var i=0;i<S.processos.length;i++){var p=S.processos[i];if(p.id===v.procId&&p.status==='ativo'){var nf=nfDaMarca(S,m);return !!nf&&p.itens.some(function(x){return x.nfId===nf.id&&mesmaEsp(x.esp,m.esp);});}}
    return false;
  });
}
function marcaPendente(S,m){return !m.ignorada&&(m.mais||vincValidos(S,m).length===0);}
function jaVinculadoPack(S,pack,sp){
  var q=0;S.processos.forEach(function(p){if(p.status!=='ativo'||!mesmoPack(p.pack,pack))return;p.itens.forEach(function(i){if(mesmaEsp(i.esp,sp))q+=i.qtd;});});
  return q;
}
/* exportacoes que levaram esta especie, da mais provavel para a menos */
function candidatosMarca(S,m,exps){
  var nf=nfDaMarca(S,m),out=[];
  (exps||[]).forEach(function(e){
    var q=0;(e.items||[]).forEach(function(it){if(mesmaEsp(it.esp,m.esp))q+=it.qtd;});
    if(!(q>0))return;
    var ja=jaVinculadoPack(S,e.num,m.esp),falta=q-ja;
    if(falta<=0)return;
    var ref=m.data||'',dd=(ref&&e.dataISO)?Math.abs((Date.parse(e.dataISO)-Date.parse(ref))/864e5):9999;
    var antes=!!(nf&&nf.data&&e.dataISO&&e.dataISO<nf.data);
    out.push({num:e.num,cliente:e.cliente,dataISO:e.dataISO,qtd:q,falta:falta,dd:dd,antes:antes,sei:((S.meta.expSei||{})[e.num])||''});
  });
  out.sort(function(a,b){return (a.antes-b.antes)||(a.dd-b.dd)||String(b.dataISO).localeCompare(String(a.dataISO));});
  return out;
}
function vincularMarca(S,m,d){
  var nf=nfDaMarca(S,m);
  if(!nf)return {ok:false,erro:'Cadastre esta NF primeiro.'};
  var pack=String(d.pack||'').trim(),qtd=Math.round(+d.qtd||0);
  if(!pack)return {ok:false,erro:'Informe o pack.'};
  if(!(qtd>0))return {ok:false,erro:'Informe a quantidade usada.'};
  var it=null;nf.itens.forEach(function(x){if(!it&&mesmaEsp(x.esp,m.esp))it=x;});
  if(!it)return {ok:false,erro:'Esta NF não tem a espécie '+m.esp+' cadastrada.'};
  var proc=null;
  S.processos.forEach(function(p){if(!proc&&p.status==='ativo'&&mesmoPack(p.pack,pack))proc=p;});
  if(!proc){proc={id:uid(),pack:pack,sei:String(d.sei||'').trim(),destino:String(d.destino||'').trim(),data:d.data||hoje(),status:'ativo',historico:true,itens:[]};S.processos.push(proc);}
  var ex=null;proc.itens.forEach(function(x){if(!ex&&x.nfId===nf.id&&mesmaEsp(x.esp,it.esp))ex=x;});
  if(ex)ex.qtd+=qtd;else proc.itens.push({esp:it.esp,nfId:nf.id,qtd:qtd});
  m.vinc=(m.vinc||[]).concat([{procId:proc.id,pack:proc.pack,qtd:qtd}]);m.mais=false;m.ignorada=false;
  return {ok:true,proc:proc,saldo:saldoNF(S,nf.id,it.esp)};
}
function setStatusProc(S,id,status){
  var p=null;S.processos.forEach(function(x){if(x.id===id)p=x;});
  if(!p)return {ok:false,erro:'Processo não encontrado.'};
  var antes=p.status;p.status=status;
  if(status==='ativo'){
    var c=conflitosEstado(S);
    if(c.length){p.status=antes;return {ok:false,erro:'Reativar deixaria sem saldo: NF '+c[0].nf+' / '+c[0].esp+' ('+c[0].saldo+').'};}
  }
  return {ok:true};
}
function salvarNF(S,f){
  var numero=String(f.numero||'').trim(),forn=String(f.fornecedor||'').trim();
  if(!numero)return {ok:false,erro:'Informe o número da NF.'};
  if(!forn)return {ok:false,erro:'Informe o fornecedor.'};
  var itens=[];
  (f.itens||[]).forEach(function(i){
    if(!norm(i.esp)||!(i.qtd>0))return;
    for(var k=0;k<itens.length;k++){if(mesmaEsp(itens[k].esp,i.esp)){itens[k].qtd+=i.qtd;return;}}
    itens.push({esp:String(i.esp).trim(),qtd:i.qtd});
  });
  if(!itens.length)return {ok:false,erro:'Informe ao menos uma espécie com quantidade.'};
  for(var i=0;i<S.nfs.length;i++){var o=S.nfs[i];if(o.id!==f.id&&norm(o.numero)===norm(numero)&&norm(o.fornecedor)===norm(forn))return {ok:false,erro:'Já existe a NF '+numero+' deste fornecedor.'};}
  if(f.id){
    var nf=getNF(S,f.id);if(!nf)return {ok:false,erro:'NF não encontrada.'};
    var old={numero:nf.numero,fornecedor:nf.fornecedor,data:nf.data,itens:nf.itens};
    nf.numero=numero;nf.fornecedor=forn;nf.data=f.data||'';nf.itens=itens;
    var c=conflitosEstado(S);
    if(c.length){nf.numero=old.numero;nf.fornecedor=old.fornecedor;nf.data=old.data;nf.itens=old.itens;return {ok:false,erro:'A alteração deixaria '+c[0].esp+' com saldo negativo ('+c[0].saldo+') na NF '+c[0].nf+'.'};}
    return {ok:true,nf:nf};
  }
  var novo={id:uid(),numero:numero,fornecedor:forn,data:f.data||hoje(),itens:itens};
  S.nfs.push(novo);return {ok:true,nf:novo};
}
function excluirNF(S,id){
  for(var i=0;i<S.processos.length;i++){
    if(S.processos[i].itens.some(function(x){return x.nfId===id;}))return {ok:false,erro:'Esta NF aparece no processo '+S.processos[i].pack+'. Exclua ou ajuste esse processo antes.'};
  }
  S.nfs=S.nfs.filter(function(n){return n.id!==id;});
  return {ok:true};
}
function lerImport(txt){
  var o;try{o=JSON.parse(txt);}catch(e){return null;}
  if(!o||!Array.isArray(o.nfs)||!Array.isArray(o.processos))return null;
  var S=novoEstado();S.nfs=o.nfs;S.processos=o.processos;S.meta=o.meta||{};return S;
}
/* ---------- leitura de PDF (NF-e, NFS-e e packing list) ---------- */
var GENEROS=['Corydoras','Paracheirodon','Hemigrammus','Carnegiella','Otocinclus','Nannostomus','Poecilocharax','Symphysodon','Heros','Dianema','Tucanoichthys','Mesonauta','Rineloricaria','Hemiodus','Bunocephalus','Nannacara','Apistogramma','Pterophyllum','Hyphessobrycon','Thayeria','Gymnocorymbus','Moenkhausia','Pyrrhulina','Anostomus','Leporinus','Peckoltia','Hypancistrus','Ancistrus','Brochis','Scleromystax','Aspidoras','Crenicichla','Geophagus','Satanoperca','Uaru','Biotodoma','Mikrogeophagus','Laetacara','Cichlasoma','Astronotus','Gasteropelecus','Thoracocharax','Metynnis','Myleus','Serrasalmus','Colossoma','Arowana','Osteoglossum','Potamotrygon','Brachyplatystoma','Phractocephalus','Pimelodus','Sorubim','Hoplosternum','Callichthys','Farlowella','Sturisoma','Loricaria','Pseudacanthicus','Baryancistrus','Scobinancistrus','Parancistrus','Leporacanthicus','Pterygoplichthys','Panaque','Pyrrhulina','Copella','Nannobrycon','Iguanodectes','Characidium','Abramites','Chilodus','Semaprochilodus','Prochilodus','Tetragonopterus','Hasemania','Inpaichthys','Axelrodia','Petitella','Rachoviscus','Aphyocharax'];
var EPITETOS={weitzman:'weitzmani'};
function lev(a,b){var m=a.length,n=b.length,d=[],i,j;for(i=0;i<=m;i++){d[i]=[i];}for(j=1;j<=n;j++)d[0][j]=j;for(i=1;i<=m;i++)for(j=1;j<=n;j++)d[i][j]=Math.min(d[i-1][j]+1,d[i][j-1]+1,d[i-1][j-1]+(a.charAt(i-1)===b.charAt(j-1)?0:1));return d[m][n];}
function capi(s){s=String(s||'').toLowerCase();return s.charAt(0).toUpperCase()+s.slice(1);}
function corrigirGenero(g,extra){
  var gl=norm(g),lista=GENEROS.concat(extra||[]),i;
  for(i=0;i<lista.length;i++){if(norm(lista[i])===gl)return lista[i];}
  if(gl.length>=6){for(i=0;i<lista.length;i++){var k=norm(lista[i]);if(k.length>=6&&lev(k,gl)===1)return lista[i];}}
  return capi(g);
}
function limparComum(s){
  s=String(s||'').replace(/\?/g,' ').replace(/[-–—]+/g,' ').replace(/\s+/g,' ').trim();
  s=s.replace(/^[\s,;:.()]+|[\s,;:.()]+$/g,'');
  return s?capi(s):'';
}
/* desc bruta (ex.: "NANNOSTOMUS MARGINATUS (TORPEDINHO, PEIXE- LAPIS ...)" ou "CORYDORAS ROBUSTUS - CORIDORA") -> "Nannostomus marginatus Torpedinho" */
function espDeTexto(desc,extra){
  var t=String(desc||'').replace(/\?/g,' ').replace(/\s+/g,' ').trim();
  var m=t.match(/^([A-Za-zÀ-ÿ]{3,})\s+([A-Za-zÀ-ÿ]{3,})(.*)$/);
  if(!m)return '';
  var g=corrigirGenero(m[1],extra),e=m[2].toLowerCase();
  if(EPITETOS[norm(e)])e=EPITETOS[norm(e)];
  var rest=m[3].trim(),c='';
  if(rest.charAt(0)==='('){var inn=rest.slice(1);var k=inn.search(/[,)]/);c=limparComum(k>=0?inn.slice(0,k):inn);}
  else if(/^[-–—]/.test(rest)){c=limparComum(rest.replace(/^[-–—]\s*/,'').split(/[(,]/)[0]);}
  else c=limparComum(rest.split(/[(,]/)[0]);
  if(c){
    c=c.split(' ').filter(function(w){return norm(w)!==norm(e);}).join(' ');
    if(norm(c)==='coridoras')c='Coridora';
    if(norm(c).indexOf(norm(g))===0&&c.length<=g.length+1)c='';
  }
  return g+' '+e+(c?' '+c:'');
}
function qtdBR(s){var p=String(s).split(',')[0];return parseQtd(p);}
function dataISO(s){var m=String(s||'').match(/(\d{2})\/(\d{2})\/(\d{2,4})/);if(!m)return '';var a=m[3].length===2?'20'+m[3]:m[3];return a+'-'+m[2]+'-'+m[1];}
function agruparLinhas(items,tol){
  tol=tol||1.5;
  var its=items.filter(function(i){return i.str&&String(i.str).trim();}).slice().sort(function(a,b){return b.y-a.y||a.x-b.x;});
  var linhas=[];
  its.forEach(function(it){
    var L=null;
    for(var k=linhas.length-1;k>=0&&k>=linhas.length-4;k--){if(Math.abs(linhas[k].y-it.y)<=tol){L=linhas[k];break;}}
    if(!L){L={y:it.y,its:[]};linhas.push(L);}
    L.its.push(it);
  });
  linhas.forEach(function(L){
    L.its.sort(function(a,b){return a.x-b.x;});
    var t='',px=null;
    L.its.forEach(function(i){if(px!==null){var gap=i.x-px;t+=gap>6?'  ':(gap>0.3?' ':'');}t+=i.str;px=i.x+(i.w||0);});
    L.text=t.replace(/[ \t]+$/,'');
  });
  linhas.sort(function(a,b){return b.y-a.y;});
  return linhas;
}
function itensDeNFe(linhas,extra){
  var rows=[],outras=[];
  linhas.forEach(function(L){
    var m=L.text.match(/\bund\s+([\d.]+,\d{2})\b/i);
    if(m&&/\b\d{8}\b/.test(L.text))rows.push({y:L.y,text:L.text,qtd:qtdBR(m[1]),its:L.its});
    else outras.push(L);
  });
  rows.forEach(function(r){r.cima=[];r.baixo=[];
    var t=r.text.replace(/^\s*\d+\s+/,'');var k=t.search(/\s*\b\d{8}\b/);r.desc=(k>=0?t.slice(0,k):t).replace(/\s+/g,' ').trim();});
  outras.forEach(function(L){
    if(/DESCRI|CÓD\.|COD\.|Quantid|VALOR|DADOS|ICMS|NCM/.test(L.text))return;
    var best=null,bd=1e9;
    rows.forEach(function(r){var d=Math.abs(r.y-L.y);if(d<bd){bd=d;best=r;}});
    if(best&&bd<=7&&/[A-Za-zÀ-ÿ]/.test(L.text)){(L.y>best.y?best.cima:best.baixo).push(L);}
  });
  var out=[];
  rows.forEach(function(r){
    var d=r.cima.sort(function(a,b){return b.y-a.y;}).map(function(l){return l.text;}).join(' ')+' '+r.desc+' '+r.baixo.sort(function(a,b){return b.y-a.y;}).map(function(l){return l.text;}).join(' ');
    var e=espDeTexto(d.trim(),extra);
    if(e&&r.qtd>0)out.push({esp:e,qtd:r.qtd,y:r.y,its:r.its,ext:r.cima.concat(r.baixo).map(function(l){return l.its;})});
  });
  return out;
}
function parsePaginaNF(linhas,extra){
  var txt=linhas.map(function(l){return l.text;}).join('\n'),r={tipo:'outro',numero:'',fornecedor:'',data:'',itens:[]};
  if(/DANFSe|Documento Auxiliar da NFS-e/i.test(txt)){
    r.tipo='nfse';
    for(var i=0;i<linhas.length;i++){
      if(/NÚMERO DA NFS-e/i.test(linhas[i].text)&&linhas[i+1]){var m=linhas[i+1].text.match(/^\s*(\d{6,})/);if(m)r.numero='NFS-e '+m[1];var d=linhas[i+1].text.match(/\d{2}\/\d{2}\/\d{4}/);if(d)r.data=dataISO(d[0]);}
      if(!r.fornecedor&&/Nome \/ Nome Empresarial/i.test(linhas[i].text)&&linhas[i+1]){r.fornecedor=titulo(linhas[i+1].text.split(/\s{2,}/)[0]);}
    }
    var a=txt.search(/REFERENTE A/i),b=txt.search(/TRIBUTAÇÃO MUNICIPAL/i);
    if(a>=0){
      var desc=txt.slice(a,b>a?b:undefined).replace(/\s+/g,' ');
      var re=/([A-Za-zÀ-ÿ]{3,})\s+([A-Za-zÀ-ÿ]{3,})\s*-\s*([^;]*?)\s*-\s*([\d.]+)\s*-\s*R\$/g,mm;
      while((mm=re.exec(desc))){
        var e=espDeTexto(mm[1]+' '+mm[2]+' - '+mm[3],extra);
        if(e)r.itens.push({esp:e,qtd:parseQtd(mm[4])});
      }
    }
    return r;
  }
  if(/RECEBEMOS DE/i.test(txt)||/DANFE/i.test(txt)){
    r.tipo='nfe';
    var f=txt.replace(/\n/g,' ').match(/RECEBEMOS DE (.+?) OS PRODUTOS/i);if(f)r.fornecedor=titulo(f[1]);
    var n=txt.match(/Nº\.?\s*(\d{5,})/);if(n)r.numero=n[1];
    var ix=txt.search(/DATA DE EMISSÃO/i);if(ix>=0){var dd=txt.slice(ix).match(/\d{2}\/\d{2}\/\d{2,4}/);if(dd)r.data=dataISO(dd[0]);}
    r.itens=itensDeNFe(linhas,extra);
    return r;
  }
  return r;
}
function titulo(s){return String(s||'').toLowerCase().replace(/\s+/g,' ').trim().replace(/(^|\s)([a-zà-ÿ])/g,function(x,a,b){return a+b.toUpperCase();}).replace(/\b(De|Da|Do|Dos|Das|E)\b/g,function(x){return x.toLowerCase();});}
function parsePackingList(linhas,extra){
  var txt=linhas.map(function(l){return l.text;}).join('\n');
  if(!/Packing List/i.test(txt))return null;
  var r={pack:'',data:'',destino:'',itens:[]};
  var m=txt.match(/Packing List\s+N\.?\s*[º°o]?\.?\s*(\d+\s*\/\s*\d{4})/i);if(m)r.pack=m[1].replace(/\s+/g,'');
  var d=txt.match(/DATE:\s*(\d{2}\/\d{2}\/\d{4})/i);if(d)r.data=dataISO(d[1]);
  var s=txt.match(/SOLD TO:\s*([^\n]*)/i);if(s){r.destino=titulo(s[1].split(/\s{2,}|DATE:/)[0]);}
  var start=-1,i;
  for(i=0;i<linhas.length;i++){if(/Total Fishes/i.test(linhas[i].text)){start=i;break;}}
  var map=[];
  for(i=start+1;i<linhas.length&&start>=0;i++){
    var t=linhas[i].text;
    if(/Digitally|Reason:|Location:/i.test(t))break;
    if(!/[A-Z]{3,}\s+[A-Z]{3,}/.test(t))continue;
    var p=parseLinhas(t);
    if(!p.length)continue;
    var e=espDeTexto(p[0].esp,extra);if(!e)continue;
    var achou=false;
    map.forEach(function(x){if(mesmaEsp(x.esp,e)){x.qtd+=p[0].qtd;achou=true;}});
    if(!achou)map.push({esp:e,qtd:p[0].qtd});
  }
  r.itens=map;
  return r;
}
/* ---------- destaques (marca-texto) do PDF: quais especies voce marcou em cada NF ---------- */
function quadsDe(a){
  var out=[],q=a.quadPoints;
  function box(pts){var xs=pts.map(function(p){return p.x;}),ys=pts.map(function(p){return p.y;});return {x0:Math.min.apply(null,xs),x1:Math.max.apply(null,xs),y0:Math.min.apply(null,ys),y1:Math.max.apply(null,ys)};}
  if(q&&q.length){
    if(typeof q[0]==='number'){for(var k=0;k+7<q.length;k+=8){var pts=[];for(var j=0;j<4;j++)pts.push({x:q[k+2*j],y:q[k+2*j+1]});out.push(box(pts));}}
    else if(Array.isArray(q[0])){q.forEach(function(g){if(g.length&&typeof g[0]==='object')out.push(box(g));else if(g.length>=8){var pts=[];for(var j=0;j<4;j++)pts.push({x:g[2*j],y:g[2*j+1]});out.push(box(pts));}});}
    else if(typeof q[0]==='object'){for(var m=0;m+3<q.length;m+=4)out.push(box(q.slice(m,m+4)));}
  }
  if(!out.length&&a.rect&&a.rect.length>=4)out.push({x0:Math.min(a.rect[0],a.rect[2]),x1:Math.max(a.rect[0],a.rect[2]),y0:Math.min(a.rect[1],a.rect[3]),y1:Math.max(a.rect[1],a.rect[3])});
  return out;
}
function dataDeAnot(s){var m=String(s||'').match(/D?:?(\d{4})(\d{2})(\d{2})/);return m?m[1]+'-'+m[2]+'-'+m[3]:'';}
/* its: itens de texto da pagina {str,x,y,w}; itens: especies lidas da pagina; retorna [{esp,data}] */
function marcasDaPagina(anots,its,itens,extra){
  var res=[];
  function add(esp,data){if(!esp)return;for(var i=0;i<res.length;i++){if(mesmaEsp(res[i].esp,esp)){if(data&&(!res[i].data||data>res[i].data))res[i].data=data;return;}}res.push({esp:esp,data:data||''});}
  (anots||[]).forEach(function(a){
    if(!a||a.subtype!=='Highlight')return;
    var data=dataDeAnot(a.modificationDate||a.creationDate);
    quadsDe(a).forEach(function(b){
      var tx=its.filter(function(i){return i.str&&i.y>=b.y0-0.3&&i.y<=b.y1+0.3&&(i.x+(i.w||0))>=b.x0+1&&i.x<=b.x1-1;}).sort(function(p,q){return p.x-q.x;}).map(function(i){
        var w=i.w||0,n=i.str.length;
        if(w<=0||(i.x>=b.x0-1&&i.x+w<=b.x1+1))return i.str;
        var f0=Math.max(0,(b.x0-i.x)/w),f1=Math.min(1,(b.x1-i.x)/w);
        return i.str.slice(Math.floor(f0*n),Math.ceil(f1*n));
      }).join(' ');
      var nt=' '+norm(tx).replace(/[^a-z0-9]+/g,' ')+' ',achou=false;
      itens.forEach(function(it){
        var w=norm(it.esp).split(' ');
        if(w.length>1&&nt.indexOf(' '+w[1]+' ')>=0){add(it.esp,data);achou=true;}
        else if(it.y!=null&&it.y>=b.y0-0.3&&it.y<=b.y1+0.3){add(it.esp,data);achou=true;}
      });
      if(!achou){var e=espDeTexto(tx.replace(/\d[\d.,]*.*$/,''),extra);if(e&&e.split(' ').length>=2)add(e,data);}
    });
  });
  return res;
}
/* pdfjsLib: biblioteca ja carregada; data: Uint8Array. Retorna {nfs:[], packs:[]} */
async function lerPdfBuffer(pdfjsLib,data,extra){
  var doc=await pdfjsLib.getDocument({data:data}).promise,out={nfs:[],packs:[]},ult=null;
  for(var p=1;p<=doc.numPages;p++){
    var pg=await doc.getPage(p),tc=await pg.getTextContent();
    var its=tc.items.map(function(i){return {str:i.str,x:i.transform[4],y:i.transform[5],w:i.width};});
    var linhas=agruparLinhas(its);
    if(linhas.some(function(l){return /Packing List/i.test(l.text);}))linhas=agruparLinhas(its,4);
    var pl=parsePackingList(linhas,extra);
    if(pl&&pl.itens.length){out.packs.push(pl);continue;}
    var r=parsePaginaNF(linhas,extra);
    if(r.tipo==='outro')continue;
    var anots=[];try{anots=await pg.getAnnotations();}catch(e){anots=[];}
    var mk=marcasDaPagina(anots,its,r.itens,extra);
    if(!r.numero&&ult){r.itens.forEach(function(i){ult.itens.push(i);});mk.forEach(function(m){ult.marcados.push(m);});ult.pags.push(p);continue;}
    r.marcados=mk;r.pags=[p];
    out.nfs.push(r);ult=r;
  }
  return out;
}

/* ---------- nomes parecidos ---------- */
function nomesConhecidos(S){var out=[];S.nfs.forEach(function(nf){nf.itens.forEach(function(i){for(var k=0;k<out.length;k++){if(mesmaEsp(out[k],i.esp))return;}out.push(i.esp);});});return out;}
function parecidas(S,esp,extraNomes){
  var x=parseEsp(esp),out=[];
  if(!x.g||!x.e)return out;
  nomesConhecidos(S).concat(extraNomes||[]).forEach(function(n){
    if(mesmaEsp(n,esp))return;
    var y=parseEsp(n);if(!y.g||!y.e)return;
    var gOk=x.g===y.g||(x.g.length>=6&&y.g.length>=6&&lev(x.g,y.g)<=1);
    var eOk=x.e===y.e||(x.e.length>=5&&y.e.length>=5&&(lev(x.e,y.e)<=2||x.e.indexOf(y.e)===0||y.e.indexOf(x.e)===0));
    if(!(gOk&&eOk))return;
    for(var k=0;k<out.length;k++){if(mesmaEsp(out[k],n))return;}
    out.push(n);
  });
  return out;
}
/* ---------- sugestao de NFs ---------- */
function sugerirAjuste(S,sp,qtd,jaUsado){
  var falta=qtd,aloc=[],usadas={};
  while(falta>0){
    var cand=[];
    S.nfs.forEach(function(nf){
      if(usadas[nf.id]||!entradaNF(nf,sp))return;
      var sd=saldoNF(S,nf.id,sp)-((jaUsado&&jaUsado[nf.id])||0);
      if(sd>0)cand.push({nf:nf,sd:sd});
    });
    if(!cand.length)break;
    var cobre=cand.filter(function(c){return c.sd>=falta;}),esc;
    var cmp=function(a,b){return String(a.nf.data||'').localeCompare(String(b.nf.data||''));};
    if(cobre.length){cobre.sort(function(a,b){return a.sd-b.sd||cmp(a,b);});esc=cobre[0];}
    else{cand.sort(function(a,b){return b.sd-a.sd||cmp(a,b);});esc=cand[0];}
    var q=Math.min(esc.sd,falta);aloc.push({nfId:esc.nf.id,qtd:q});usadas[esc.nf.id]=1;falta-=q;
  }
  return {aloc:aloc,faltam:falta};
}
function sugerirModo(S,sp,qtd,jaUsado,modo){return modo==='ajuste'?sugerirAjuste(S,sp,qtd,jaUsado):sugerir(S,sp,qtd,jaUsado);}
/* ---------- folha de grifos ---------- */
function itensDoDraft(d){var out=[];d.linhas.forEach(function(L){L.aloc.forEach(function(a){if(a.nfId&&a.qtd>0)out.push({esp:L.esp,nfId:a.nfId,qtd:a.qtd});});});return out;}
function folhaGrifos(S,itens,descontar){
  var ordem=[],mp={};
  itens.forEach(function(i){
    var nf=getNF(S,i.nfId);if(!nf)return;
    if(!mp[nf.id]){mp[nf.id]={nf:nf,usados:[]};ordem.push(mp[nf.id]);}
    var g=mp[nf.id];
    for(var k=0;k<g.usados.length;k++){if(mesmaEsp(g.usados[k].esp,i.esp)){g.usados[k].qtd+=i.qtd;return;}}
    g.usados.push({esp:i.esp,qtd:i.qtd});
  });
  ordem.forEach(function(g){
    g.usados.forEach(function(u){var sd=saldoNF(S,g.nf.id,u.esp);u.entrada=entradaNF(g.nf,u.esp);u.saldoApos=descontar?sd-u.qtd:sd;});
    g.naoUsados=especiesNF(g.nf).filter(function(e){return !g.usados.some(function(u){return mesmaEsp(u.esp,e.esp);});}).map(function(e){return {esp:e.esp,entrada:entradaNF(g.nf,e.esp)};});
  });
  ordem.sort(function(a,b){return String(a.nf.data||'').localeCompare(String(b.nf.data||''));});
  return ordem;
}
/* ---------- resumo e carta ---------- */
function tabelaProcesso(S,p){
  var linhas=[];
  p.itens.forEach(function(i){var nf=getNF(S,i.nfId);linhas.push({esp:i.esp,nf:nf?nf.numero:'(NF removida)',forn:nf?nf.fornecedor:'',qtd:i.qtd});});
  linhas.sort(function(a,b){return nomeSci(a.esp).localeCompare(nomeSci(b.esp));});
  return linhas;
}
function resumoProcessoTexto(S,p){
  var t=tabelaProcesso(S,p),tot=0;t.forEach(function(x){tot+=x.qtd;});
  var s='PACK '+p.pack+(p.sei?'  |  SEI '+p.sei:'')+(p.destino?'  |  '+p.destino:'')+(p.data?'  |  '+dataBR(p.data):'')+'\n\n';
  t.forEach(function(x){s+=nomeSci(x.esp)+(nomeComum(x.esp)?' ('+nomeComum(x.esp)+')':'')+'  —  NF '+x.nf+(x.forn?' ('+x.forn+')':'')+'  —  '+qtdBR2(x.qtd)+'\n';});
  s+='\nTotal: '+qtdBR2(tot)+' peixes';
  return s;
}
function dataBR(s){var p=String(s||'').split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:String(s||'');}
function qtdBR2(n){return String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g,'.');}
function cartaMAPA(S,p,apontamento,responsavel){
  var t=tabelaProcesso(S,p);
  var s='À\nServiço de Fiscalização de Insumos Pecuários e Saúde Animal – SFISPA/AM\nMinistério da Agricultura e Pecuária – MAPA\n\n';
  s+='Assunto: Processo SEI nº '+(p.sei||'[número do SEI]')+' – Pack '+p.pack+' – Esclarecimento sobre as notas fiscais de origem\n\n';
  s+='Prezados,\n\nEm atenção à comunicação recebida sobre o processo acima'+(apontamento&&apontamento.trim()?', na qual foi apontado: "'+apontamento.trim()+'"':'')+', informamos que revisamos o controle de saldo das notas fiscais de entrada e apresentamos, a seguir, a relação das notas de origem vinculadas a cada espécie deste processo, com as respectivas quantidades:\n\n';
  t.forEach(function(x){s+='• '+nomeSci(x.esp)+(nomeComum(x.esp)?' ('+nomeComum(x.esp)+')':'')+': NF '+x.nf+(x.forn?' – '+x.forn:'')+' – '+qtdBR2(x.qtd)+' unidades\n';});
  s+='\nAs notas fiscais de origem estão anexadas, com as espécies e quantidades utilizadas neste processo devidamente assinaladas. Colocamo-nos à disposição para qualquer esclarecimento adicional.\n\nAtenciosamente,\n\n'+(responsavel||'[Nome do responsável]')+'\nPRESTIGE AQUARIUM LTDA – CNPJ 04.463.469/0001-18';
  return s;
}
/* ---------- painel de saldo por especie ---------- */
function painelEspecies(S){
  var lista=[];
  nomesConhecidos(S).forEach(function(n){
    var o={esp:n,entrada:0,usado:0,nfs:0,nfsComSaldo:0,neg:false,packs:0};
    S.nfs.forEach(function(nf){var e=entradaNF(nf,n);if(!e)return;o.nfs++;var sd=saldoNF(S,nf.id,n);o.entrada+=e;o.usado+=e-sd;if(sd>0)o.nfsComSaldo++;if(sd<0)o.neg=true;});
    S.processos.forEach(function(p){if(p.status!=='ativo')return;if(p.itens.some(function(i){return mesmaEsp(i.esp,n);}))o.packs++;});
    o.saldo=o.entrada-o.usado;
    o.media=o.packs?Math.round(o.usado/o.packs):0;
    o.restam=o.media>0?o.saldo/o.media:null;
    o.status=o.neg?'estourada':(o.saldo<=0?'esgotada':(o.restam!==null&&o.restam<2?'baixo':'ok'));
    lista.push(o);
  });
  var peso={estourada:0,esgotada:1,baixo:2,ok:3};
  lista.sort(function(a,b){return peso[a.status]-peso[b.status]||nomeSci(a.esp).localeCompare(nomeSci(b.esp));});
  return lista;
}
function diasDesdeBackup(S,agora){
  var u=S.meta&&S.meta.ultimoBackup;if(!u)return null;
  return Math.floor(((agora||Date.now())-new Date(u).getTime())/86400000);
}
function precisaBackup(S,agora){
  if(!S.nfs.length&&!S.processos.length)return false;
  var d=diasDesdeBackup(S,agora);return d===null||d>=7;
}
/* ---------- nuvem (Supabase por funcoes RPC) ---------- */

/* ====================== ESTADO E UTILIDADES ====================== */
var S=novoEstado();
var tab='verificar';
var formNF={id:null,numero:'',fornecedor:'',data:hoje(),texto:''};
var filtroNF='';
var filtroSaldo=false;
var filtroEsp='';
var rev=[];
var cartaEstado={procId:null,apont:''};
var IDMAP={view:'mpView',tabs:'mpTabs',modal:'mpModal',tip:'mpTip'};
function $(id){return document.getElementById(IDMAP[id]||id);}
function carregar(){
  var o=PP.store.get('mapa',null);
  S=novoEstado();
  if(o&&Array.isArray(o.nfs)&&Array.isArray(o.processos)){S.nfs=o.nfs;S.processos=o.processos;S.meta=o.meta||{};S.draft=o.draft||novoDraft();S.marcas=Array.isArray(o.marcas)?o.marcas:[];}
  if(!S.meta)S.meta={};
  if(!Array.isArray(S.marcas))S.marcas=[];
  if(!S.draft)S.draft=novoDraft();
}
function salvar(){PP.store.set('mapa',{nfs:S.nfs,processos:S.processos,meta:S.meta,draft:S.draft,marcas:S.marcas||[]});}
function toast(m){PP.toast(m);}
function esc(s){return String(s==null?'':s).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function fmt(n){return Number(n).toLocaleString('pt-BR');}
function dt(s){if(!s)return '';var p=String(s).split('-');return p.length===3?p[2]+'/'+p[1]+'/'+p[0]:s;}
function todasEspecies(){return nomesConhecidos(S).sort();}
function nomeHTML(sp){var s=nomeSci(sp),c=nomeComum(sp);return '<span class="sp">'+esc(s)+'</span>'+(c?' <span class="muted">'+esc(c)+'</span>':'');}
function rotulo(sp){var n=nomeSci(sp).split(' ');return n.length>1?n[0].charAt(0).toUpperCase()+'. '+n[1]:n[0];}

/* ---------- ajuda (icone i) ---------- */
var AJ={
  protocolar:'Grava este pack e desconta das NFs as quantidades escolhidas, para o saldo ficar certo desde já. Isso NÃO é o protocolo: quando você protocolar no SEI/MAPA, volte em Processos e clique em "Marcar como protocolado".',
  ler:'Lê o texto colado e cria uma linha por espécie. Depois sugere automaticamente as NFs que ainda têm saldo.',
  addlinha:'Adiciona uma espécie manualmente, sem precisar colar texto.',
  sugerirtudo:'Escolhe as NFs só para as espécies que ainda não têm NF ou estão com problema, seguindo a regra de "Como sugerir" ao lado. As que você já acertou ficam como estão.',
  sugerir:'Refaz a escolha de NFs só para esta espécie. Se ela já estiver certa, o app pergunta antes de trocar.',
  trocar:'Abre esta espécie para você escolher outra NF ou dividir a quantidade entre duas NFs.',
  hist:'Marque ao registrar um pack antigo, que já foi protocolado. O app só avisa se faltar saldo, sem bloquear. Serve para carregar o histórico.',
  limpar:'Apaga o pedido que está sendo montado. Não mexe nos packs já gravados.',
  modo:'Mais antiga primeiro: usa as NFs em ordem de data. Esgotar NF: prefere a NF que melhor se encaixa na quantidade, para zerar notas e deixar menos sobras espalhadas.',
  pesc:'Aqui você só controla a validade do CTF de cada pescador e se já tem o CTF e o RGP salvos no seu computador. Os arquivos em si continuam com você. O app avisa quando o CTF estiver perto de vencer ou vencido.',
  pdfnfs:'Junta num só PDF as NFs de entrada usadas neste pack, já com a espécie e a quantidade grifadas em amarelo, pronto para anexar no SEI. Sem capa. Se faltar o PDF de alguma NF, o app pede para você anexar uma vez só; depois fica guardado.',
  grifos:'Mostra, nota por nota, o que você deve grifar de amarelo antes de anexar no MAPA, com as quantidades. Dá para imprimir ou salvar em PDF.',
  packpdf:'Escolha o PDF do packing list. O app lê o número do pack, o destino e as espécies com quantidades, e já sugere as NFs.',
  nfpdf:'Escolha os PDFs das notas de entrada (pode ser vários de uma vez). O app lê fornecedor, número, data, espécies e quantidades. Você confere antes de salvar.',
  cadastrarnf:'Salva a NF no controle. A partir daí o saldo dela passa a ser acompanhado.',
  salvarrev:'Cadastra as NFs marcadas, já com as espécies e quantidades que você conferiu.',
  sosaldo:'Mostra só as NFs que ainda têm saldo em alguma espécie.',
  marcarprot:'Clique quando você realmente protocolar o processo no SEI/MAPA. O app pergunta o nº do SEI (opcional) e guarda a data de hoje.',
  cancelproc:'Use só depois que o MAPA confirmar o cancelamento ou a devolução. Libera de volta o saldo das NFs deste pack.',
  reativar:'Volta a contar este pack no saldo das NFs.',
  delproc:'Remove este pack do histórico e recalcula o saldo. Se o pack foi cancelado de verdade, prefira Cancelar e liberar saldo.',
  resumo:'Lista deste pack: espécie, NF e quantidade. Dá para copiar ou imprimir.',
  carta:'Gera um rascunho de ofício para o MAPA com as NFs deste pack. Revise antes de enviar.',
  exportar:'Baixa um arquivo com todos os seus dados. Guarde em lugar seguro: serve para restaurar em outro computador.',
  importar:'Carrega um arquivo de backup. Substitui os dados atuais deste navegador.',
  apagar:'Remove todas as NFs e packs deste navegador. Só use se tiver um backup.',
  autobackup:'Baixa um backup automaticamente toda vez que você grava um pack.',
  nuvem:'Guarda uma cópia na nuvem (Supabase) para você abrir o app em outro computador ou celular com os mesmos dados.',
  saldo:'Soma de todas as NFs por espécie. "Dá para" estima quantos packs ainda cabem, pela média que você costuma enviar.'
};
function ia(k){return '<i class="info" tabindex="0" role="note" aria-label="'+esc(AJ[k])+'" data-tip="'+esc(AJ[k])+'">i</i>';}
function mostrarTip(el){
  var t=$('tip');t.textContent=el.getAttribute('data-tip');t.className='on';
  var r=el.getBoundingClientRect(),w=t.offsetWidth,h=t.offsetHeight;
  var l=Math.max(8,Math.min(window.innerWidth-w-8,r.left+r.width/2-w/2));
  var tp=r.bottom+8;if(tp+h>window.innerHeight-8)tp=r.top-h-8;
  t.style.left=l+'px';t.style.top=Math.max(8,tp)+'px';
}
function esconderTip(){var t=$('tip');if(t)t.className='';}

var TABS=[['nfs','1 · NFs de entrada'],['verificar','2 · Verificar pedido'],['processos','Processos'],['saldonf','Saldo por nota'],['saldo','Saldo por espécie'],['pesc','Pescadores (CTF/RGP)']];
var _pdfFeito=null;
function renderTabs(){
  $('tabs').innerHTML=TABS.map(function(t){var nP=t[0]==='processos'?S.processos.filter(aguardaProt).length:0;return '<button type="button" data-tab="'+t[0]+'" class="'+(tab===t[0]?'on':'')+'">'+t[1]+(nP?' <span class="badge b-w" style="margin-left:4px" title="Packs com consumo gravado que ainda faltam protocolar no SEI/MAPA">'+nP+'</span>':'')+'</button>';}).join('');
}
/* ---------- faixa "passo a passo" ---------- */
function fluxoEstado(){
  var d=S.draft,nNF=S.nfs.length,semPdf=S.nfs.filter(function(n){return !n.arq;}).length,nLin=d.linhas.length,v=nLin?validarDraft(S,d):{erros:0,avisos:0,linhas:[]};
  var temAloc=d.linhas.some(function(L){return L.aloc.some(function(a){return a.nfId&&a.qtd>0;});});
  var pronto=nLin>0&&!v.erros&&temAloc,pdfOk=pronto&&_pdfFeito!==null&&_pdfFeito===String(d.pack||''),nProc=S.processos.length,nPend=S.processos.filter(aguardaProt).length;
  var d1=nNF>0,d2=pronto,d3=pdfOk,d4=false,cur=!d1?1:(!d2?2:(!d3?3:4));
  var rotulos=[
    ['1. Cadastrar as NFs',d1?(nNF+' NF(s) cadastrada(s)'+(semPdf?' · '+semPdf+' sem PDF anexado':' · todas com PDF')):'Cadastre as NFs de entrada (PDF ou colando o texto)'],
    ['2. Conferir o pedido',nLin?(pronto?'Pack '+(d.pack||'(sem nº)')+': todas as espécies cobertas':(v.erros?v.erros+' espécie(s) com problema':'Escolha as NFs de cada espécie')):'Anexe o packing list ou cole o pedido'],
    ['3. Gerar o PDF único',d3?'PDF das NFs gerado':'Junta as NFs usadas, com as espécies grifadas, para o SEI'],
    ['4. Gravar o consumo','Desconta das NFs o que será usado neste pack'],
    ['5. Protocolar no SEI/MAPA',nPend?nPend+' pack(s) aguardando protocolo (marque em Processos)':(nProc?nProc+' processo(s) gravado(s) e protocolado(s)':'Quando protocolar, marque em Processos')]
  ];
  var agora='',bt='';
  if(cur===1){agora='<b>Cadastre as NFs de entrada.</b> Sem elas o app não tem de onde tirar o saldo das espécies.';bt='<button type="button" class="btn pri" data-tab="nfs">Cadastrar NFs</button>';}
  else if(cur===2){
    if(!nLin){agora='<b>Anexe o packing list (PDF) ou cole o pedido</b> na aba "2 · Verificar pedido".';bt='<button type="button" class="btn pri" data-tab="verificar">Ir para Verificar pedido</button>';}
    else if(!temAloc||v.erros){agora='<b>Pack '+esc(d.pack||'(sem nº)')+(d.destino?' · '+esc(d.destino):'')+'</b>: '+(v.erros?'falta escolher NF para '+v.erros+' espécie(s).':'falta escolher as NFs.');bt='<button type="button" class="btn pri" data-act="sugerirtudo">Sugerir NFs onde falta</button>';}
  }
  else if(cur===3){agora='<b>Pedido conferido.</b> Gere o PDF único das NFs (com as espécies grifadas) para anexar no SEI.';bt='<button type="button" class="btn pri" data-act="pdfdraft">PDF das NFs (SEI)</button>';}
  else{agora='<b>PDF pronto.</b> Grave o consumo das NFs agora (o saldo já fica certo) e anexe o PDF no SEI. Depois que protocolar no MAPA, marque o pack como protocolado em Processos.';bt='<button type="button" class="btn pri" data-act="protocolar">Gravar consumo</button>';}
  return {cur:cur,done:[d1,d2,d3,d4,false],rot:rotulos,agora:agora,bt:bt};
}
function fluxoHTML(){
  var e=fluxoEstado();
  var h='<div class="card" id="mpFluxoCard" style="margin-bottom:14px"><div class="muted" style="font-size:12px;letter-spacing:.12em;text-transform:uppercase;margin-bottom:8px">Passo a passo</div><div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:10px">';
  e.rot.forEach(function(r,i){
    var st=e.done[i]?'done':(e.cur===i+1?'now':'');
    var bd=st==='now'?'var(--ac,#35d0c0)':(st==='done'?'#2b6b4d':'var(--bd,#1f2c32)');
    h+='<div data-step="'+(i+1)+'" class="'+st+'" style="border:1px solid '+bd+';'+(st==='now'?'box-shadow:0 0 0 1px '+bd+' inset;':'')+'border-radius:12px;padding:10px 12px"><div style="display:flex;gap:8px;align-items:center"><span style="width:22px;height:22px;border-radius:99px;display:inline-flex;align-items:center;justify-content:center;font-size:12px;font-weight:700;background:'+(st==='done'?'#2b6b4d':(st==='now'?'var(--ac,#35d0c0)':'#1b2a30'))+';color:'+(st==='now'?'#05161a':'inherit')+'">'+(st==='done'?'✓':(i+1))+'</span><b style="font-size:14px">'+esc(r[0].replace(/^\d\.\s*/,''))+'</b></div><div class="muted" style="font-size:12.5px;margin-top:4px">'+esc(r[1])+'</div></div>';
  });
  h+='</div>';
  if(e.agora)h+='<div id="mpAgora" style="margin-top:12px;padding:12px 14px;border:1px solid #1d5a55;border-radius:12px;background:rgba(53,208,192,.07)"><div class="muted" style="font-size:12px;letter-spacing:.12em;text-transform:uppercase">Agora, faça isto</div><div style="margin:4px 0 8px">'+e.agora+'</div>'+e.bt+'</div>';
  return h+'</div>';
}
function paintFluxo(){var e=$('mpFluxo');if(e)e.innerHTML=fluxoHTML();}
function render(){
  renderTabs();
  var v=$('view'),h;
  if(tab==='verificar')h=viewVerificar();
  else if(tab==='nfs')h=viewNFs();
  else if(tab==='saldo')h=viewSaldo();
  else if(tab==='saldonf')h=viewSaldoNF();
  else if(tab==='pesc')h=viewPesc();
  else h=viewProcessos();
  v.innerHTML=((tab==='verificar'||tab==='nfs')?'<div id="mpFluxo">'+fluxoHTML()+'</div>':'')+h;
  if(tab==='verificar')paintAll();
}

/* ---------- Verificar pedido ---------- */
function viewVerificar(){
  var d=S.draft,modo=S.meta.modo||'antiga';
  var dl='<datalist id="dl-esp">'+todasEspecies().map(function(e){return '<option value="'+esc(e)+'">';}).join('')+'</datalist>';
  var temAloc=d.linhas.some(function(L){return L.aloc.some(function(a){return a.nfId&&a.qtd>0;});});
  return dl
  +'<div class="card"><h2>Novo processo</h2>'
  +'<div class="row"><label>Pack nº<input type="text" data-f="pack" value="'+esc(d.pack)+'" placeholder="016/2026"></label>'
  +'<label>Processo SEI<input type="text" data-f="sei" value="'+esc(d.sei)+'" placeholder="21010.003135/2026-25"></label>'
  +'<label>Destino (cliente)<input type="text" data-f="destino" value="'+esc(d.destino||'')+'" placeholder="Ruinemans Group"></label></div>'
  +'<label style="display:flex;gap:8px;align-items:center;margin-top:10px;font-size:13px"><input type="checkbox" data-f="hist" '+(d.historico?'checked':'')+'> Registro de histórico (processo antigo: avisa, mas não bloqueia por falta de saldo)'+ia('hist')+'</label></div>'
  +'<div class="card"><h2>Pedido</h2>'
  +'<div class="row" style="margin-bottom:8px;align-items:center"><label class="btn" style="cursor:pointer;flex:0 0 auto;min-width:0;display:inline-flex;align-items:center;flex-direction:row;gap:6px;color:var(--tx);font-size:14px">Anexar packing list (PDF)<input type="file" id="packpdf" accept="application/pdf,.pdf" style="display:none"></label>'+ia('packpdf')+'<span class="muted" style="flex:1">ou cole o texto abaixo</span></div>'
  +'<textarea id="colar" placeholder="Cole o pedido, uma espécie por linha (pode colar direto da tabela do packing list):&#10;Otocinclus hoppei Limpa vidro 15.000&#10;Paracheirodon axelrodi Cardinal 8.000"></textarea>'
  +'<div class="row" style="margin-top:8px;align-items:center"><span><button class="btn" data-act="ler">Ler pedido</button>'+ia('ler')+'</span><span><button class="btn" data-act="addlinha">Adicionar espécie</button>'+ia('addlinha')+'</span><span><button class="btn" data-act="sugerirtudo">Sugerir NFs onde falta</button>'+ia('sugerirtudo')+'</span>'
  +'<label style="flex:0 0 auto;min-width:0;flex-direction:row;align-items:center;gap:6px;font-size:13px;color:var(--tx)">Como sugerir<select data-f="modo" style="width:auto"><option value="antiga"'+(modo==='antiga'?' selected':'')+'>NF mais antiga primeiro</option><option value="ajuste"'+(modo==='ajuste'?' selected':'')+'>Esgotar NF (melhor encaixe)</option></select>'+ia('modo')+'</label></div></div>'
  +'<div id="banner"></div><div id="pescAv"></div><div id="linhas"></div>'
  +'<div class="row" style="margin-top:12px;align-items:center"><span><button class="btn pri" data-act="protocolar">Gravar consumo</button>'+ia('protocolar')+'</span>'
  +(temAloc?'<span><button class="btn" data-act="grifosdraft">Folha de grifos</button>'+ia('grifos')+'</span><span><button class="btn" data-act="pdfdraft">PDF das NFs (SEI)</button>'+ia('pdfnfs')+'</span>':'')
  +'<span><button class="btn" data-act="limpar">Limpar pedido</button>'+ia('limpar')+'</span></div>'
  +'<p class="muted">Gravar o consumo desconta das NFs, mas ainda <b>não</b> é o protocolo: quando protocolar no SEI/MAPA, abra a aba Processos e clique em “Marcar como protocolado”.</p>';
}
function linhaCardHTML(i){
  var L=S.draft.linhas[i];
  var editar=(!L.esp||!(L.qtd>0)||L.editNome);
  var topo=editar
    ?'<div class="head"><label style="flex:2;min-width:180px">Espécie<input type="text" list="dl-esp" data-l="'+i+'" data-k="esp" value="'+esc(L.esp)+'"></label>'
     +'<label style="width:120px">Sai no pack<input type="text" inputmode="numeric" data-l="'+i+'" data-k="qtd" value="'+(L.qtd?esc(fmt(L.qtd)):'')+'"></label>'
     +'<span><button class="btn sm" data-act="sugerir" data-i="'+i+'">Sugerir NFs</button>'+ia('sugerir')+'</span>'
     +'<button class="btn sm dg" data-act="rmlinha" data-i="'+i+'">Remover</button></div>'
    :'<div class="head2"><div class="tt">'+nomeHTML(L.esp)+'</div><div>Sai <b>'+fmt(L.qtd)+'</b></div>'
     +'<div class="hb"><span><button class="btn sm" data-act="sugerir" data-i="'+i+'">Sugerir NFs</button>'+ia('sugerir')+'</span><button class="btn sm" data-act="editnome" data-i="'+i+'">Editar</button><button class="btn sm dg" data-act="rmlinha" data-i="'+i+'">Remover</button></div></div>';
  return '<div class="card" id="L'+i+'" style="padding:12px 14px">'+topo+'<div id="al-'+i+'"></div><div id="st-'+i+'"></div></div>';
}
function okRowHTML(i){
  var L=S.draft.linhas[i];
  var nfs=L.aloc.map(function(a){var nf=getNF(S,a.nfId);return nf?('NF '+esc(nf.numero)+' '+esc(nf.fornecedor)+(L.aloc.length>1?' ('+fmt(a.qtd)+')':'')):'';}).join(' + ');
  return '<div class="okrow"><span>'+nomeHTML(L.esp)+'</span><span><b style="font-weight:600">'+fmt(L.qtd)+'</b> <span class="muted">· '+nfs+'</span> <button class="btn sm" data-act="trocar" data-i="'+i+'">Trocar NF</button>'+ia('trocar')+'</span></div>';
}
function allocHTML(i){
  var L=S.draft.linhas[i],sp=L.esp,out='';
  var cand=nfsOrdenadas(S);
  var com=cand.filter(function(n){return entradaNF(n,sp)>0;}),sem=cand.filter(function(n){return !entradaNF(n,sp);});
  L.aloc.forEach(function(a,j){
    var opts='<option value="">Escolha a NF…</option>';
    com.concat(sem).forEach(function(nf){
      var has=entradaNF(nf,sp)>0,sd=has?saldoNF(S,nf.id,sp):0;
      var lab='NF '+nf.numero+' · '+nf.fornecedor+(has?(sd>0?' (saldo '+fmt(sd)+')':' (esgotada)'):' (não tem esta espécie)');
      opts+='<option value="'+nf.id+'"'+(a.nfId===nf.id?' selected':'')+'>'+esc(lab)+'</option>';
    });
    out+='<div class="al"><select data-a="'+j+'" data-l="'+i+'" data-k="nf">'+opts+'</select>'
      +'<input type="text" inputmode="numeric" data-a="'+j+'" data-l="'+i+'" data-k="aq" value="'+(a.qtd?esc(fmt(a.qtd)):'')+'" aria-label="Quantidade desta NF">'
      +'<button class="btn sm dg" data-act="rmaloc" data-i="'+i+'" data-j="'+j+'">Tirar</button></div>';
  });
  out+='<div class="al"><button class="btn sm" data-act="addaloc" data-i="'+i+'">+ Adicionar NF</button></div>';
  return out;
}
function statusHTML(i,r){
  var out='',L=S.draft.linhas[i];
  r.problemas.forEach(function(p){
    var cls=p.nivel==='aviso'?'w':'e';
    if(p.tipo==='sem_saldo'){
      var us=p.usos.map(function(u){return '<div class="u"><span>'+esc(u.pack)+(u.sei?' · '+esc(u.sei):'')+(u.historico?' (histórico)':'')+'</span><span>'+fmt(u.qtd)+'</span></div>';}).join('');
      out+='<div class="alert '+cls+'"><b>'+(p.nivel==='aviso'?'Aviso (histórico): ':'')+'Você já usou a NF '+esc(p.nf)+' ('+esc(p.fornecedor)+')</b><div style="margin:4px 0">Nesta espécie entraram '+fmt(p.entrada)+' e restam '+fmt(Math.max(p.saldo,0))+'. Este pack precisa de '+fmt(p.precisa)+' (faltam '+fmt(p.precisa-Math.max(p.saldo,0))+'). Já consumida em:</div>'+(us||'<div class="u"><span>nenhum processo (a soma desta tela passa do saldo)</span></div>')+'</div>';
    }else if(p.tipo==='soma'){
      var falta=p.qtd-p.soma;
      out+='<div class="alert e">Alocado '+fmt(p.soma)+' de '+fmt(p.qtd)+': '+(falta>0?'faltam '+fmt(falta)+'. Use outra NF com saldo ou cadastre a NF que falta.':'passou '+fmt(-falta)+'.')+(falta>0?' <button class="btn sm" data-tab="nfs">Cadastrar NF</button>':'')+'</div>';
    }else if(p.tipo==='sem_alocacao'){
      out+='<div class="alert '+(p.semNF?'w':'e')+'">'+(p.semNF?'Nenhuma NF cadastrada tem saldo desta espécie. ':'Escolha a NF desta espécie ou use Sugerir NFs. ')+(p.semNF?'<button class="btn sm" data-tab="nfs">Cadastrar NF</button>':'')+'</div>';
    }else if(p.tipo==='parecida'){
      out+='<div class="alert w"><b>Nome parecido já cadastrado.</b> É a mesma espécie?'+p.nomes.map(function(n){return '<div class="u"><span>'+nomeHTML(n)+'</span><button class="btn sm" data-act="usarnome" data-i="'+i+'" data-nome="'+esc(n)+'">Usar este nome</button></div>';}).join('')+'</div>';
    }else{
      out+='<div class="alert '+cls+'">'+esc(p.msg)+'</div>';
    }
  });
  if(!r.problemas.length&&L.aloc.length&&L.edit)out+='<div style="margin-top:8px"><button class="btn sm" data-act="concluir" data-i="'+i+'">Pronto</button></div>';
  return out;
}
function paintAlloc(i){var e=$('al-'+i);if(e)e.innerHTML=allocHTML(i);}
function paintStatus(){
  paintFluxo();
  var d=S.draft,res=validarDraft(S,d);
  res.linhas.forEach(function(r,i){
    var e=$('st-'+i);if(e)e.innerHTML=statusHTML(i,r);
    var c=$('L'+i);if(c){var er=r.problemas.some(function(p){return p.nivel==='erro';}),av=r.problemas.some(function(p){return p.nivel==='aviso';});c.style.borderColor=er?'var(--e)':(av?'var(--w)':'var(--bd)');}
  });
  var b=$('banner');if(!b)return;
  var cls,txt,nErr=0,nOk=0;
  res.linhas.forEach(function(r,i){if(r.problemas.some(function(p){return p.nivel==='erro';}))nErr++;else if(!r.problemas.length&&d.linhas[i].aloc.length)nOk++;});
  if(!d.linhas.length){cls='b-n';txt=S.nfs.length?'Cole o pedido, anexe o packing list em PDF ou adicione as espécies. O app sugere as NFs com saldo.':'Primeiro cadastre as NFs de entrada na aba NFs de entrada. Depois volte aqui e cole o pedido.';}
  else if(!S.nfs.length){cls='b-w';txt='Nenhuma NF de entrada cadastrada ainda. Cadastre as NFs antes de conferir o pedido.';}
  else if(nErr){cls='b-e';txt=nErr+' espécie(s) precisam da sua atenção e '+nOk+' estão certas. Ainda não grave o consumo.';}
  else if(res.avisos){cls='b-w';txt='Sem bloqueios, com '+res.avisos+' aviso(s) de histórico. Ao gravar, a NF ficará com saldo negativo.';}
  else{cls='b-ok';txt='Todas as '+nOk+' espécies têm NF com saldo. Pode gravar o consumo; o protocolo no SEI/MAPA você marca depois.';}
  b.innerHTML='<div class="banner '+cls+'">'+esc(txt)+'</div>';
}
function paintAll(){
  var d=S.draft,res=validarDraft(S,d),att=[],ok=[],h='';
  d.linhas.forEach(function(L,i){
    var pronta=!res.linhas[i].problemas.length&&L.aloc.length>0&&!L.edit;
    (pronta?ok:att).push(i);
  });
  if(!S.nfs.length&&d.linhas.length){
    h+='<div class="card"><b>Nenhuma NF de entrada cadastrada ainda</b><p class="muted">Cadastre as NFs na aba NFs de entrada. Depois volte aqui e clique em Sugerir NFs onde falta.</p><button class="btn pri" data-tab="nfs">Cadastrar NFs</button></div>';
    h+='<div class="sec n">Espécies do pedido ('+d.linhas.length+')</div><div class="card">'+d.linhas.map(function(L,i){return '<div class="okrow"><span>'+nomeHTML(L.esp)+'</span><span><b style="font-weight:600">'+fmt(L.qtd)+'</b> <button class="btn sm dg" data-act="rmlinha" data-i="'+i+'">Remover</button></span></div>';}).join('')+'</div>';
    att=[];
  }else{
    if(att.length){h+='<div class="sec e">Precisa da sua atenção ('+att.length+')</div>';att.forEach(function(i){h+=linhaCardHTML(i);});}
    if(ok.length){h+='<div class="sec ok">Tudo certo ('+ok.length+')</div><div class="card" style="padding:4px 14px">'+ok.map(okRowHTML).join('')+'</div>';}
  }
  $('linhas').innerHTML=h;
  att.forEach(function(i){paintAlloc(i);});
  paintStatus();paintPesc();
}
function jaUsadoOutras(i,sp){
  var u={};
  S.draft.linhas.forEach(function(L,k){if(k===i||!mesmaEsp(L.esp,sp))return;L.aloc.forEach(function(a){if(a.nfId)u[a.nfId]=(u[a.nfId]||0)+(a.qtd||0);});});
  return u;
}
function sugerirLinha(i){
  var L=S.draft.linhas[i];
  if(!norm(L.esp)||!(L.qtd>0)){toast('Informe a espécie e a quantidade primeiro.');return false;}
  var r=sugerirModo(S,L.esp,L.qtd,jaUsadoOutras(i,L.esp),S.meta.modo);
  L.aloc=r.aloc;L.edit=false;L.editNome=false;
  if(!r.aloc.length)toast('Nenhuma NF cadastrada tem saldo de '+nomeSci(L.esp)+'.');
  return true;
}

/* ---------- NFs de entrada ---------- */
function badgeNF(st){
  return {estourada:'<span class="badge b-e">Estourada</span>',esgotada:'<span class="badge b-e">Esgotada</span>',parcial:'<span class="badge b-w">Parcialmente usada</span>',livre:'<span class="badge b-ok">Livre</span>',comsaldo:'<span class="badge b-ok">Com saldo</span>'}[st];
}
function revAvisos(idx){
  var r=rev[idx],out=[],extra=[];
  rev.forEach(function(o,k){if(k===idx)return;parseLinhas(o.texto).forEach(function(l){extra.push(l.esp);});});
  parseLinhas(r.texto).forEach(function(l){
    parecidas(S,l.esp,extra).forEach(function(n){out.push({de:l.esp,para:n});});
  });
  return out;
}
function viewRevisao(){
  if(!rev.length)return '';
  var h='<div class="card" style="border-color:var(--ac)"><h2>Conferir as NFs lidas ('+rev.length+')</h2><p class="muted">Confira os dados e corrija o que precisar. As marcadas serão cadastradas.</p>';
  rev.forEach(function(r,i){
    var av=revAvisos(i);
    h+='<div class="sub'+(r.incluir?' liv':'')+'"><div class="top"><label style="display:flex;gap:8px;align-items:center"><input type="checkbox" data-r="'+i+'" data-rk="incluir" '+(r.incluir?'checked':'')+'> <b>'+(r.tipo==='nfse'?'NFS-e':'NF-e')+' '+esc(r.numero||'(sem número)')+'</b></label>'
      +(r.ja?'<span class="badge b-w">Já cadastrada</span>':'<span class="badge b-ok">Nova</span>')+'</div>'
      +'<div class="row" style="margin-top:8px"><label>Número<input type="text" data-r="'+i+'" data-rk="numero" value="'+esc(r.numero)+'"></label>'
      +'<label>Fornecedor<input type="text" data-r="'+i+'" data-rk="fornecedor" value="'+esc(r.fornecedor)+'"></label>'
      +'<label style="max-width:170px">Data<input type="date" data-r="'+i+'" data-rk="data" value="'+esc(r.data)+'"></label></div>'
      +((r.marcados&&r.marcados.length)?'<div class="alert w" style="margin-top:8px">✎ Marcações (destaques) encontradas no PDF: <b>'+r.marcados.map(function(k){return esc(rotulo(k.esp));}).join(', ')+'</b>. '+(r.ja?'Esta nota já está cadastrada: ao clicar em Cadastrar selecionadas, só as marcações são importadas.':'Depois de cadastrar, você vincula cada uma ao pack.')+'</div>':'')
      +'<label style="display:flex;flex-direction:column;font-size:12px;color:var(--tx2);gap:3px;margin-top:8px">Espécies e quantidades<textarea data-r="'+i+'" data-rk="texto" style="min-height:'+(60+r.texto.split('\n').length*20)+'px">'+esc(r.texto)+'</textarea></label>'
      +av.map(function(a){return '<div class="alert w">Nome parecido: <b>'+esc(a.de)+'</b> ≈ <b>'+esc(a.para)+'</b> (já cadastrada). <button class="btn sm" data-act="unificar" data-r="'+i+'" data-de="'+esc(a.de)+'" data-para="'+esc(a.para)+'">Usar '+esc(rotulo(a.para))+'</button></div>';}).join('')
      +'</div>';
  });
  h+='<div class="row" style="margin-top:6px;align-items:center"><span><button class="btn pri" data-act="salvarrev">Cadastrar selecionadas</button>'+ia('salvarrev')+'</span><button class="btn" data-act="cancelrev">Descartar</button></div></div>';
  return h;
}
function viewNFs(){
  var f=formNF,edit=!!f.id;
  var pdf='<div class="card"><h2>Anexar NFs em PDF'+ia('nfpdf')+'</h2><label class="drop" id="dropnf" style="display:block"><b>Clique aqui para escolher os PDFs</b> ou arraste para cá<div class="muted">Pode ser vários de uma vez. O app lê fornecedor, número, data, espécies e quantidades. Você confere antes de salvar.</div><input type="file" id="nfpdf" accept="application/pdf,.pdf" multiple style="display:none"></label></div>';
  var form='<div class="card"><h2>'+(edit?'Editar NF':'Cadastrar NF de entrada (digitando)')+'</h2>'
  +'<div class="row"><label>Número da NF<input type="text" data-n="numero" value="'+esc(f.numero)+'"></label>'
  +'<label>Fornecedor<input type="text" data-n="fornecedor" value="'+esc(f.fornecedor)+'"></label>'
  +'<label style="max-width:170px">Data<input type="date" data-n="data" value="'+esc(f.data)+'"></label></div>'
  +'<label style="display:flex;flex-direction:column;font-size:12px;color:var(--tx2);gap:3px;margin-top:10px">Espécies e quantidades que entraram (uma por linha: nome científico, nome comum se quiser, quantidade)<textarea data-n="texto" placeholder="Otocinclus hoppei Limpa vidro 20.000&#10;Paracheirodon axelrodi Cardinal 80.000">'+esc(f.texto)+'</textarea></label>'
  +'<div class="row" style="margin-top:8px;align-items:center"><span><button class="btn pri" data-act="salvarnf">'+(edit?'Salvar alterações':'Cadastrar NF')+'</button>'+ia('cadastrarnf')+'</span>'+(edit?'<button class="btn" data-act="cancelaredit">Cancelar edição</button>':'')+'</div></div>';
  var comS=0,esg=0;
  S.nfs.forEach(function(nf){if(resumoNF(S,nf).livres.length)comS++;else esg++;});
  var met='<div class="mt"><div class="met"><span class="muted">NFs cadastradas</span><b>'+S.nfs.length+'</b></div><div class="met"><span class="muted">Ainda com saldo</span><b>'+comS+'</b></div><div class="met"><span class="muted">Sem saldo</span><b>'+esg+'</b></div></div>';
  return pdf+viewRevisao()+viewMarcas()+form+met+'<div class="card"><div class="row" style="margin-bottom:8px;align-items:center"><label>Buscar por NF, fornecedor ou espécie<input type="text" id="busca" value="'+esc(filtroNF)+'"></label>'
  +'<label style="flex:0 0 auto;min-width:0;flex-direction:row;align-items:center;gap:8px;white-space:nowrap;font-size:13px;color:var(--tx)"><input type="checkbox" id="sosaldo" '+(filtroSaldo?'checked':'')+'> Só NFs com saldo'+ia('sosaldo')+'</label></div><div id="nflist">'+listaNFs()+'</div></div>'+importCardHTML();
}

/* ---------- Marcacoes do PDF: vincular NF x pack ---------- */
var mv={};
function expsApp(){try{return (PP.exp&&PP.exp.mapaAll)?PP.exp.mapaAll().filter(function(e){return e.salva;}):[];}catch(er){return [];}}
function mvDe(m,cands,nf){
  var v=mv[m.id];
  if(!v){var c=cands[0];v=mv[m.id]={sel:c?c.num:'__outro',pack:'',qtd:'',qAuto:true};}
  if(v.sel!=='__outro'&&!cands.some(function(c){return c.num===v.sel;}))v.sel=cands[0]?cands[0].num:'__outro';
  if(v.qAuto){
    var c=null;cands.forEach(function(x){if(x.num===v.sel)c=x;});
    var sd=nf?saldoNF(S,nf.id,m.esp):0;
    v.qtd=c?String(sd>0?Math.min(c.falta,sd):c.falta):'';
  }
  return v;
}
function marcaCardHTML(m){
  var nf=nfDaMarca(S,m),cab='<b>NF '+esc(m.nfNum)+'</b> · '+esc(m.nfForn)+(m.data?' <span class="muted">· marcada em '+dt(m.data)+'</span>':'');
  if(!nf)return '<div class="sub"><div class="top"><span>'+cab+'</span><span class="badge b-w">NF ainda não cadastrada</span></div><div style="margin-top:6px">'+nomeHTML(m.esp)+'</div><div class="muted" style="font-size:12px">Cadastre esta NF para poder vincular.</div></div>';
  var cands=candidatosMarca(S,m,expsApp()),v=mvDe(m,cands,nf),sd=saldoNF(S,nf.id,m.esp),ent=entradaNF(nf,m.esp);
  var vv=vincValidos(S,m);
  var jaTxt=vv.length?'<div class="muted" style="font-size:12px;margin-top:4px">Já vinculado: '+vv.map(function(x){return 'Pack '+esc(x.pack)+' ('+fmt(x.qtd)+')';}).join(' · ')+'</div>':'';
  var opts=cands.map(function(c){return '<option value="'+esc(c.num)+'"'+(v.sel===c.num?' selected':'')+'>Pack '+esc(c.num)+' · '+esc(c.cliente||'—')+' · '+dt(c.dataISO)+' · levou '+fmt(c.qtd)+(c.falta!==c.qtd?' (faltam '+fmt(c.falta)+')':'')+(c.antes?' · ⚠ antes da data da NF':'')+'</option>';}).join('')
    +'<option value="__outro"'+(v.sel==='__outro'?' selected':'')+'>Outro pack (digitar)…</option>';
  return '<div class="sub"><div class="top"><span>'+cab+'</span><span class="muted">A nota tem '+fmt(ent)+' · saldo agora '+fmt(sd)+'</span></div>'
    +'<div style="margin:6px 0">'+nomeHTML(m.esp)+'</div>'+jaTxt
    +'<div class="row" style="margin-top:6px;align-items:flex-end">'
    +'<label style="flex:3;min-width:220px">Foi usada em qual pack?<select data-mk="'+m.id+'" data-mf="sel">'+opts+'</select></label>'
    +(v.sel==='__outro'?'<label style="flex:1;min-width:110px">Pack nº<input type="text" data-mk="'+m.id+'" data-mf="pack" value="'+esc(v.pack)+'" placeholder="009/2026"></label>':'')
    +'<label style="flex:1;min-width:110px">Quantidade<input type="text" inputmode="numeric" data-mk="'+m.id+'" data-mf="qtd" value="'+esc(v.qtd?fmt(parseQtd(v.qtd)):'')+'"></label></div>'
    +(cands.length?'':'<div class="muted" style="font-size:12px;margin-top:4px">Nenhuma exportação cadastrada levou esta espécie. Cadastre o pack em Exportação (＋ Adicionar exportação) ou digite o pack acima.</div>')
    +'<div class="row" style="margin-top:8px;align-items:center"><button class="btn pri sm" data-act="mkvinc" data-id="'+m.id+'">Vincular</button><button class="btn sm" data-act="mkign" data-id="'+m.id+'">Ignorar (não usei)</button></div></div>';
}
function viewMarcas(){
  if(!S.marcas.length)return '';
  var pend=S.marcas.filter(function(m){return marcaPendente(S,m);}),feitas=S.marcas.filter(function(m){return !marcaPendente(S,m);});
  var h='';
  if(pend.length){
    h+='<div class="card" style="border-color:var(--ac)"><h2>Marcações do PDF para vincular ('+pend.length+')</h2><p class="muted" style="margin-top:0">São as espécies que você destacou nas notas. Diga em qual pack cada uma foi usada: o app pega a quantidade da invoice e desconta da nota.</p>'+pend.map(marcaCardHTML).join('')+'</div>';
  }
  if(feitas.length){
    h+='<details class="card"><summary><b>Marcações já tratadas ('+feitas.length+')</b></summary>'+feitas.map(function(m){
      var vv=vincValidos(S,m);
      return '<div class="sub"><div class="top"><span><b>NF '+esc(m.nfNum)+'</b> · '+nomeHTML(m.esp)+'</span>'+(m.ignorada?'<span class="badge b-w">Ignorada</span>':'<span class="badge b-ok">Vinculada</span>')+'</div>'
        +(vv.length?'<div class="muted" style="font-size:12px">'+vv.map(function(x){return 'Pack '+esc(x.pack)+' · '+fmt(x.qtd);}).join(' · ')+'</div>':'')
        +'<div class="row" style="margin-top:6px">'+(m.ignorada?'<button class="btn sm" data-act="mkreabrir" data-id="'+m.id+'">Reabrir</button>':'<button class="btn sm" data-act="mkmais" data-id="'+m.id+'">＋ Vincular outro pack</button>')+'</div></div>';
    }).join('')+'</details>';
  }
  return h;
}
function importCardHTML(){
  return '<div class="card"><h2>Já usava o app antigo (Conferência MAPA)?</h2><p class="muted" style="margin-top:0">Escolha aqui o arquivo de backup (.json) que você baixou dele. As NFs e os packs já protocolados passam a aparecer neste app.</p>'
  +'<label class="btn" style="display:inline-block;cursor:pointer">Importar backup do app antigo (.json)<input type="file" accept=".json,application/json" id="imp" style="display:none"></label></div>';
}
function especieNFHTML(o,livre){
  var pct=o.ent>0?Math.min(100,Math.round(o.usado/o.ent*100)):0;
  var cor=livre?'var(--ok)':(o.saldo<0?'var(--e)':'var(--tx2)');
  var trilha=o.usos.length?'<div class="muted" style="font-size:12px">Usada em: '+o.usos.map(function(u){return esc(u.pack)+(u.sei?' ('+esc(u.sei)+')':'')+' '+fmt(u.qtd);}).join(' · ')+'</div>':'';
  return '<div class="sub'+(livre?' liv':'')+'"><div class="top"><span>'+nomeHTML(o.esp)+'</span>'
    +(livre?'<span style="color:var(--ok);font-weight:600">Saldo '+fmt(o.saldo)+'</span>':'<span class="badge b-e">'+(o.saldo<0?'Estourada ('+fmt(o.saldo)+')':'Esgotada')+'</span>')+'</div>'
    +'<div class="bar" style="background:'+(livre?'var(--okbg)':'var(--bd)')+'"><i style="width:'+pct+'%;background:'+cor+'"></i></div>'
    +'<div class="muted" style="font-size:12px">Entrada '+fmt(o.ent)+' · Usado '+fmt(o.usado)+(livre?(o.usado===0?' · Livre para a próxima exportação':' · Ainda pode usar'):'')+'</div>'+trilha+'</div>';
}
function listaNFs(){
  var q=norm(filtroNF),h='';
  var lista=nfsOrdenadas(S).reverse().filter(function(nf){
    if(filtroSaldo&&!resumoNF(S,nf).livres.length)return false;
    if(!q)return true;
    return norm(nf.numero).indexOf(q)>=0||norm(nf.fornecedor).indexOf(q)>=0||nf.itens.some(function(i){return norm(i.esp).indexOf(q)>=0;});
  });
  if(!lista.length)return '<p class="muted">'+(S.nfs.length?'Nada encontrado.':'Nenhuma NF cadastrada ainda. Anexe os PDFs acima ou cadastre digitando.')+'</p>';
  lista.forEach(function(nf){
    var r=resumoNF(S,nf);
    var linha='';
    if(r.livres.length){var nomes=r.livres.slice(0,3).map(function(o){return esc(rotulo(o.esp))+' '+fmt(o.saldo);}).join(' · ');linha+='<span style="color:var(--ok)">Ainda serve: '+nomes+(r.livres.length>3?' +'+(r.livres.length-3):'')+'</span>';}
    if(r.esg.length)linha+=(linha?' · ':'')+'<span>Esgotadas: '+r.esg.length+'</span>';
    h+='<details><summary><span><b>NF '+esc(nf.numero)+'</b> · '+esc(nf.fornecedor)+' <span class="muted">· '+dt(nf.data)+'</span><div class="muted" style="font-size:12px">'+linha+'</div></span>'+badgeNF(r.status)+'</summary>'
    +(r.livres.length?'<div class="sec ok" style="margin-top:10px">Ainda pode usar</div>'+r.livres.map(function(o){return especieNFHTML(o,true);}).join(''):'')
    +(r.esg.length?'<div class="sec n" style="margin-top:10px">Esgotadas: não use mais esta NF para elas</div>'+r.esg.map(function(o){return especieNFHTML(o,false);}).join(''):'')
    +'<div class="row" style="margin-top:8px"><button class="btn sm" data-act="editnf" data-id="'+nf.id+'">Editar</button><button class="btn sm dg" data-act="delnf" data-id="'+nf.id+'">Excluir</button></div></details>';
  });
  return h;
}

/* ---------- Saldo por especie ---------- */
function listaSaldo(){
  var q=norm(filtroEsp),lista=painelEspecies(S).filter(function(o){return !q||norm(o.esp).indexOf(q)>=0;});
  if(!lista.length)return '<p class="muted">'+(S.nfs.length?'Nada encontrado.':'Cadastre as NFs de entrada para ver o saldo por espécie.')+'</p>';
  var bd={estourada:'<span class="badge b-e">Estourada</span>',esgotada:'<span class="badge b-e">Esgotada</span>',baixo:'<span class="badge b-w">Baixo</span>',ok:'<span class="badge b-ok">OK</span>'};
  return '<div style="overflow-x:auto"><table><thead><tr><th>Espécie</th><th class="r">Entrou</th><th class="r">Usado</th><th class="r">Saldo</th><th class="r">NFs c/ saldo</th><th class="r">Média/pack</th><th class="r">Dá para</th><th></th></tr></thead><tbody>'
  +lista.map(function(o){
    var dap=o.restam===null?'—':(o.restam<1?'menos de 1 pack':'~'+Math.floor(o.restam)+' pack'+(Math.floor(o.restam)>1?'s':''));
    return '<tr><td>'+nomeHTML(o.esp)+'</td><td class="r">'+fmt(o.entrada)+'</td><td class="r">'+fmt(o.usado)+'</td><td class="r" style="font-weight:600;color:'+(o.saldo<0?'var(--e)':(o.status==='baixo'||o.status==='esgotada'?'var(--w)':'var(--ok)'))+'">'+fmt(o.saldo)+'</td><td class="r">'+o.nfsComSaldo+' de '+o.nfs+'</td><td class="r">'+(o.media?fmt(o.media):'—')+'</td><td class="r">'+dap+'</td><td class="r">'+bd[o.status]+'</td></tr>';
  }).join('')+'</tbody></table></div>';
}
function viewSaldo(){
  var l=painelEspecies(S),pr=l.filter(function(o){return o.status==='estourada'||o.status==='esgotada';}).length,bx=l.filter(function(o){return o.status==='baixo';}).length;
  return '<div class="mt"><div class="met"><span class="muted">Espécies controladas</span><b>'+l.length+'</b></div><div class="met"><span class="muted">Saldo baixo</span><b style="color:var(--w)">'+bx+'</b></div><div class="met"><span class="muted">Esgotadas ou estouradas</span><b style="color:var(--e)">'+pr+'</b></div></div>'
  +'<div class="card"><h2>Saldo total por espécie'+ia('saldo')+'</h2><p class="muted" style="margin-top:0">Soma de todas as NFs. Use para saber o que está acabando antes de fechar um pedido ou pedir nota nova.</p><label style="display:flex;flex-direction:column;font-size:12px;color:var(--tx2);gap:3px;margin-bottom:10px">Buscar espécie<input type="text" id="buscaE" value="'+esc(filtroEsp)+'"></label><div id="saldolist">'+listaSaldo()+'</div></div>';
}


/* ---------- Saldo por nota (NF x especie) ---------- */
var filtroSN='todas',buscaSN='';
function linhasSN(){
  var out=[];
  nfsOrdenadas(S).reverse().forEach(function(nf){
    var r=resumoNF(S,nf);
    r.livres.concat(r.esg).forEach(function(o){
      var pct=o.ent>0?o.saldo/o.ent:0,sit=o.saldo<0?'estourada':(o.saldo===0?'esgotada':(pct<=0.15?'quase':'serve'));
      out.push({nf:nf,esp:o.esp,ent:o.ent,usado:o.usado,saldo:o.saldo,usos:o.usos,sit:sit});
    });
  });
  return out;
}
function tabelaSN(){
  var q=norm(buscaSN),L=linhasSN().filter(function(x){
    if(filtroSN==='saldo'&&x.saldo<=0)return false;
    if(filtroSN==='quase'&&x.sit!=='quase')return false;
    if(filtroSN==='esg'&&x.sit!=='esgotada'&&x.sit!=='estourada')return false;
    if(q&&norm(x.nf.numero).indexOf(q)<0&&norm(x.nf.fornecedor).indexOf(q)<0&&norm(x.esp).indexOf(q)<0)return false;
    return true;
  });
  if(!L.length)return '<p class="muted">'+(S.nfs.length?'Nada neste filtro.':'Cadastre as NFs de entrada para ver o saldo de cada nota.')+'</p>';
  var chip={serve:'<span class="badge b-ok">Serve</span>',quase:'<span class="badge b-w">Quase esgotada</span>',esgotada:'<span class="badge b-e">Esgotada</span>',estourada:'<span class="badge b-e">Estourada</span>'};
  return '<div style="overflow-x:auto"><table><thead><tr><th>NF</th><th>Espécie</th><th class="r">Entrou</th><th class="r">Usado</th><th class="r">Saldo</th><th>Situação</th><th>Usada em</th></tr></thead><tbody>'
  +L.map(function(x){
    var pct=x.ent>0?Math.min(100,Math.round(x.usado/x.ent*100)):0,cor=x.sit==='serve'?'var(--ok)':(x.sit==='quase'?'var(--w)':'var(--e)');
    return '<tr><td><b>'+esc(x.nf.numero)+'</b><div class="muted" style="font-size:11px">'+esc(x.nf.fornecedor)+' · '+dt(x.nf.data)+'</div></td><td>'+nomeHTML(x.esp)+'</td><td class="r">'+fmt(x.ent)+'</td>'
    +'<td class="r">'+fmt(x.usado)+'<div class="bar" style="margin-left:auto;width:70px;background:var(--bd)"><i style="width:'+pct+'%;background:'+cor+'"></i></div></td>'
    +'<td class="r" style="font-weight:600;color:'+cor+'">'+fmt(x.saldo)+'</td><td>'+chip[x.sit]+'</td>'
    +'<td class="muted" style="font-size:12px">'+(x.usos.length?x.usos.map(function(u){return 'Pack '+esc(u.pack)+' ('+fmt(u.qtd)+')';}).join('<br>'):'—')+'</td></tr>';
  }).join('')+'</tbody></table></div>';
}
function viewSaldoNF(){
  var L=linhasSN(),n=function(f){return L.filter(f).length;};
  var fb=function(k,t){return '<button type="button" class="btn sm'+(filtroSN===k?' pri':'')+'" data-act="snf" data-id="'+k+'">'+t+'</button>';};
  return '<div class="mt"><div class="met"><span class="muted">Serve</span><b style="color:var(--ok)">'+n(function(x){return x.sit==='serve';})+'</b></div><div class="met"><span class="muted">Quase esgotadas</span><b style="color:var(--w)">'+n(function(x){return x.sit==='quase';})+'</b></div><div class="met"><span class="muted">Esgotadas</span><b style="color:var(--e)">'+n(function(x){return x.sit==='esgotada'||x.sit==='estourada';})+'</b></div></div>'
  +'<div class="card"><h2>Saldo de cada nota, espécie por espécie</h2><p class="muted" style="margin-top:0">Mostra o que entrou, o que já foi usado e em quais packs. “Quase esgotada” = restam 15% ou menos.</p>'
  +'<div class="row" style="margin-bottom:10px;align-items:center">'+fb('todas','Todas')+fb('saldo','Só com saldo')+fb('quase','Quase esgotadas')+fb('esg','Esgotadas')+'</div>'
  +'<label style="display:flex;flex-direction:column;font-size:12px;color:var(--tx2);gap:3px;margin-bottom:10px">Buscar por NF, fornecedor ou espécie<input type="text" id="buscaSN" value="'+esc(buscaSN)+'"></label><div id="snlist">'+tabelaSN()+'</div></div>';
}
function marcarProt(id){
  var p=S.processos.filter(function(x){return x.id===id;})[0];if(!p)return false;
  var sei=prompt('Processo protocolado no SEI/MAPA.\nNº do processo SEI (opcional):',p.sei||'');
  if(sei===null)return false;
  if(String(sei).trim())p.sei=String(sei).trim();p.protocolado=true;p.dataProt=hoje();salvar();
  if(typeof render==='function'&&document.getElementById('mpView'))render();
  toast('Pack '+p.pack+' marcado como protocolado'+(p.sei?' (SEI '+p.sei+')':'')+'.');
  if(PP.assist&&PP.assist.refresh)PP.assist.refresh();
  return true;
}
/* ---------- Processos ---------- */
function viewProcessos(){
  var lista=S.processos.slice().reverse();
  if(!lista.length)return '<div class="card"><p class="muted" style="margin:0">Nenhum processo gravado ainda. Quando você gravar o consumo na aba Verificar pedido, ele aparece aqui, esperando o protocolo.</p></div>'+importCardHTML();
  return lista.map(function(p){
    var ativo=p.status==='ativo';
    var rows=p.itens.map(function(i){var nf=getNF(S,i.nfId);return '<tr><td>'+nomeHTML(i.esp)+'</td><td>'+(nf?'NF '+esc(nf.numero)+' · '+esc(nf.fornecedor):'NF removida')+'</td><td class="r">'+fmt(i.qtd)+'</td></tr>';}).join('');
    return '<div class="card"><div class="row" style="justify-content:space-between;align-items:center"><div><b>Pack '+esc(p.pack)+'</b>'+(p.sei?' · SEI '+esc(p.sei):'')+' <span class="muted">· '+(p.destino?esc(p.destino)+' · ':'')+dt(p.data)+(p.historico?' · histórico':'')+'</span></div>'
    +'<span><span class="badge '+(ativo?'b-ok':'b-w')+'">'+(ativo?'Consumo gravado':'Cancelado (saldo liberado)')+'</span> '+(ativo?(aguardaProt(p)?'<span class="badge b-w">Falta protocolar no SEI/MAPA</span>':'<span class="badge b-ok">Protocolado'+(p.dataProt?' em '+dt(p.dataProt):'')+'</span>'):'')+'</span></div>'
    +'<table style="margin-top:8px"><thead><tr><th>Espécie</th><th>NF</th><th class="r">Qtd</th></tr></thead><tbody>'+rows+'</tbody></table>'
    +'<div class="row" style="margin-top:8px;align-items:center">'
    +'<span><button class="btn sm" data-act="grifosproc" data-id="'+p.id+'">Folha de grifos</button>'+ia('grifos')+'</span>'
    +'<span><button class="btn sm" data-act="pdfproc" data-id="'+p.id+'">PDF das NFs (SEI)</button>'+ia('pdfnfs')+'</span>'
    +'<span><button class="btn sm" data-act="resumoproc" data-id="'+p.id+'">Resumo</button>'+ia('resumo')+'</span>'
    +'<span><button class="btn sm" data-act="cartaproc" data-id="'+p.id+'">Carta ao MAPA</button>'+ia('carta')+'</span>'
    +(ativo&&aguardaProt(p)?'<span><button class="btn sm pri" data-act="marcarprot" data-id="'+p.id+'">Marcar como protocolado</button>'+ia('marcarprot')+'</span>':'')
    +(ativo&&p.protocolado===true&&!p.historico?'<span><button class="btn sm" data-act="desmarcarprot" data-id="'+p.id+'">Ainda não protocolei</button></span>':'')
    +(ativo?'<span><button class="btn sm" data-act="cancelproc" data-id="'+p.id+'">Cancelar e liberar saldo</button>'+ia('cancelproc')+'</span>':'<span><button class="btn sm" data-act="reativar" data-id="'+p.id+'">Reativar</button>'+ia('reativar')+'</span>')
    +'<span><button class="btn sm dg" data-act="delproc" data-id="'+p.id+'">Excluir</button>'+ia('delproc')+'</span></div></div>';
  }).join('');
}

/* ---------- Modal (grifos, resumo, carta) ---------- */
function barraModal(extra){return '<div class="noprint row" style="margin-bottom:12px;align-items:center;justify-content:flex-end">'+(extra||'')+'<button class="btn sm" data-act="imprimir">Imprimir / salvar PDF</button><button class="btn sm" data-act="fechar">Fechar</button></div>';}
function grifosHTML(titulo,folha,aviso){
  var txt=titulo+'\n';
  var h=barraModal('<button class="btn sm" data-act="copiarmodal">Copiar texto</button>')+'<div class="paper"><h2>'+esc(titulo)+'</h2><p class="muted">Antes de anexar no MAPA, grife de amarelo, em cada nota, só as linhas abaixo. As demais espécies da nota não devem ser grifadas.</p>'+(aviso?'<div class="alert e noprint" style="margin-bottom:8px">'+esc(aviso)+'</div>':'');
  if(!folha.length)h+='<p class="muted">Nenhuma NF escolhida ainda.</p>';
  folha.forEach(function(g){
    txt+='\nNF '+g.nf.numero+' – '+g.nf.fornecedor+' – '+dt(g.nf.data)+'\n';
    h+='<h3 style="margin:16px 0 4px">NF '+esc(g.nf.numero)+' · '+esc(g.nf.fornecedor)+' <span class="muted">· '+dt(g.nf.data)+'</span></h3><table><thead><tr><th>Grifar</th><th class="r">Qtd a usar</th><th class="r">Entrou</th><th class="r">Saldo depois</th></tr></thead><tbody>';
    g.usados.forEach(function(u){
      txt+='  GRIFAR: '+nomeSci(u.esp)+(nomeComum(u.esp)?' ('+nomeComum(u.esp)+')':'')+' – usar '+qtdBR2(u.qtd)+' (saldo depois: '+qtdBR2(u.saldoApos)+')\n';
      h+='<tr class="grifo"><td>☐ '+nomeHTML(u.esp)+'</td><td class="r"><b>'+fmt(u.qtd)+'</b></td><td class="r">'+fmt(u.entrada)+'</td><td class="r">'+fmt(u.saldoApos)+'</td></tr>';
    });
    h+='</tbody></table>';
    if(g.naoUsados.length){
      txt+='  NÃO grifar: '+g.naoUsados.map(function(x){return nomeSci(x.esp);}).join(', ')+'\n';
      h+='<p class="muted" style="margin:6px 0 0">Não grifar nesta nota: '+g.naoUsados.map(function(x){return esc(nomeSci(x.esp));}).join(', ')+'</p>';
    }
  });
  h+='<pre id="modaltxt" style="display:none">'+esc(txt)+'</pre></div>';
  return h;
}
function resumoHTML(p){
  var t=tabelaProcesso(S,p),tot=0;t.forEach(function(x){tot+=x.qtd;});
  return barraModal('<button class="btn sm" data-act="copiarmodal">Copiar texto</button>')+'<div class="paper"><h2>Pack '+esc(p.pack)+(p.sei?' · SEI '+esc(p.sei):'')+'</h2><p class="muted">'+(p.destino?esc(p.destino)+' · ':'')+dt(p.data)+'</p>'
  +'<table><thead><tr><th>Espécie</th><th>NF</th><th class="r">Qtd</th></tr></thead><tbody>'+t.map(function(x){return '<tr><td>'+nomeHTML(x.esp)+'</td><td>NF '+esc(x.nf)+(x.forn?' · '+esc(x.forn):'')+'</td><td class="r">'+fmt(x.qtd)+'</td></tr>';}).join('')+'</tbody></table>'
  +'<p style="margin-top:8px"><b>Total: '+fmt(tot)+' peixes</b></p><pre id="modaltxt" style="display:none">'+esc(resumoProcessoTexto(S,p))+'</pre></div>';
}
function cartaHTML(p){
  var apont=cartaEstado.apont;
  return barraModal('<button class="btn sm" data-act="copiarcarta">Copiar carta</button>')+'<div class="paper"><h2>Carta ao MAPA (rascunho)</h2><p class="muted">Revise e ajuste antes de enviar. Preencha o que o MAPA apontou e clique em Atualizar texto.</p>'
  +'<label class="noprint" style="display:flex;flex-direction:column;font-size:12px;color:var(--tx2);gap:3px;margin-bottom:8px">O que o MAPA apontou (opcional)<textarea id="cartaApont" style="min-height:60px">'+esc(apont)+'</textarea></label>'
  +'<label class="noprint" style="display:flex;flex-direction:column;font-size:12px;color:var(--tx2);gap:3px;margin-bottom:8px">Seu nome na assinatura<input type="text" id="cartaResp" value="'+esc(S.meta.responsavel||'')+'"></label>'
  +'<div class="noprint" style="margin-bottom:8px"><button class="btn sm" data-act="atualizarcarta">Atualizar texto</button></div>'
  +'<textarea id="cartaTxt" style="min-height:360px;white-space:pre-wrap">'+esc(cartaMAPA(S,p,apont,S.meta.responsavel))+'</textarea></div>';
}


function abrirModal(h){var m=$('modal');m.innerHTML='<div class="box">'+h+'</div>';m.className='on';m.scrollTop=0;document.body.classList.add('mpPrint');}
function fecharModal(){var m=$('modal');m.className='';m.innerHTML='';document.body.classList.remove('mpPrint');}

/* ---------- leitura de PDF ---------- */
var _pdfP=null;
function carregarPdfJs(){
  if(window.pdfjsLib)return Promise.resolve(window.pdfjsLib);
  if(_pdfP)return _pdfP;
  _pdfP=new Promise(function(res,rej){
    var s=document.createElement('script');s.src='vendor/pdf.min.js';
    s.onload=function(){window.pdfjsLib.GlobalWorkerOptions.workerSrc='vendor/pdf.worker.min.js';res(window.pdfjsLib);};
    s.onerror=function(){rej(new Error('offline'));};
    document.head.appendChild(s);
  });
  _pdfP.catch(function(){_pdfP=null;});
  return _pdfP;
}
function generosConhecidos(){return nomesConhecidos(S).map(function(n){return n.split(' ')[0];});}
async function lerArquivos(files){
  var lib=await carregarPdfJs(),nfs=[],packs=[],falhas=0;
  for(var k=0;k<files.length;k++){
    try{var buf=await files[k].arrayBuffer();var by=new Uint8Array(buf);var r=await lerPdfBuffer(lib,by.slice(),generosConhecidos());var h=(PP.nfpdf&&r.nfs.length)?await PP.nfpdf.hash(by):'';if(h)PP.nfpdf.pend[h]={bytes:by,name:files[k].name};r.nfs.forEach(function(n){n.arq=h;nfs.push(n);});r.packs.forEach(function(p){packs.push(p);});}
    catch(e){falhas++;}
  }
  return {nfs:nfs,packs:packs,falhas:falhas};
}
async function processarNFs(files){
  toast('Lendo o PDF…');
  var r;
  try{r=await lerArquivos(files);}catch(e){toast('Não consegui carregar o leitor de PDF. Recarregue a página e tente de novo.');return;}
  var vistos={},novos=[],anex=0;
  r.nfs.forEach(function(n){
    var k=norm(n.numero)+'|'+norm(n.fornecedor);if(!n.numero||vistos[k])return;vistos[k]=1;
    var ja=S.nfs.some(function(o){return norm(o.numero)===norm(n.numero)&&norm(o.fornecedor)===norm(n.fornecedor);});
    if(ja&&n.arq&&PP.nfpdf){var ex=S.nfs.filter(function(o){return norm(o.numero)===norm(n.numero)&&norm(o.fornecedor)===norm(n.fornecedor);})[0];if(ex){ex.arq=n.arq;ex.pags=n.pags;PP.nfpdf.guardar(n.arq);anex++;}}
    novos.push({arq:n.arq,pags:n.pags,marcados:n.marcados||[],tipo:n.tipo,numero:n.numero,fornecedor:n.fornecedor,data:n.data||hoje(),texto:n.itens.map(function(i){return String(i.esp).replace(/\s*\(([^()]*)$/,' $1').replace(/\s+/g,' ').trim()+' '+fmt(i.qtd);}).join('\n'),ja:ja,incluir:!ja});
  });
  if(!novos.length){toast(r.packs.length?'Este PDF é um packing list. Use o botão "Anexar packing list" na aba Verificar pedido.':(r.falhas?'Não consegui ler este PDF.':'Não encontrei NF neste PDF. Se for escaneado (imagem), cadastre digitando.'));return;}
  if(anex)salvar();
  rev=novos;render();
  toast(novos.length+' nota(s) lida(s). Confira e clique em Cadastrar selecionadas.'+(anex?' PDF guardado em '+anex+' nota(s) já cadastrada(s).':''));
  var e=$('view').querySelector('.card[style*="--ac"]');if(e)e.scrollIntoView({behavior:'smooth',block:'start'});
}
async function processarPack(files){
  toast('Lendo o packing list…');
  var r;
  try{r=await lerArquivos(files);}catch(e){toast('Não consegui carregar o leitor de PDF. Recarregue a página e tente de novo.');return;}
  var p=r.packs[0];
  if(!p||!p.itens.length){toast(r.nfs.length?'Este PDF parece ser uma NF de entrada. Use a aba NFs de entrada.':'Não encontrei o packing list neste PDF. Cole o texto do pedido.');return;}
  var d=S.draft;
  if(d.linhas.length&&!confirm('Já existem espécies no pedido. Substituir pelas do packing list?'))return;
  d.pack=p.pack||d.pack;d.destino=p.destino||d.destino||'';d.data=p.data||'';
  d.linhas=p.itens.map(function(i){return {esp:i.esp,qtd:i.qtd,aloc:[]};});
  if(S.nfs.length)d.linhas.forEach(function(L,k){sugerirLinha(k);});
  salvar();render();
  var ja=S.processos.some(function(x){return x.status==='ativo'&&norm(x.pack)===norm(d.pack);});
  toast('Pack '+(d.pack||'?')+' lido: '+p.itens.length+' espécies.'+(ja?' Atenção: este pack já está gravado em Processos.':(S.nfs.length?' Confira as NFs sugeridas.':' Cadastre as NFs para conferir.')));
}
/* ---------- Pescadores: validade do CTF e RGP guardados ---------- */
function diasAte(iso){return Math.round((Date.parse(iso+'T12:00:00')-Date.parse(hoje()+'T12:00:00'))/864e5);}
function pescLista(){
  var m=(S.meta.pesc=S.meta.pesc||[]),mp={},out=m.slice();
  m.forEach(function(p){mp[norm(p.nome)]=1;});
  S.nfs.forEach(function(nf){var k=norm(nf.fornecedor);if(!k||mp[k])return;mp[k]=1;out.push({id:'p-'+k.replace(/\s+/g,'-'),nome:nf.fornecedor,ctf:'',ctfSalvo:false,rgpSalvo:false,rgpVal:'',obs:'',ctfArq:'',ctfNome:'',rgpArq:'',rgpNome:'',auto:true});});
  return out.sort(function(a,b){return String(a.nome).localeCompare(String(b.nome),'pt-BR');});
}
function pescGet(nome){
  var m=(S.meta.pesc=S.meta.pesc||[]),k=norm(nome);
  for(var i=0;i<m.length;i++){if(norm(m[i].nome)===k)return m[i];}
  var n={id:'p-'+k.replace(/\s+/g,'-'),nome:nome,ctf:'',ctfSalvo:false,rgpSalvo:false,rgpVal:'',obs:'',ctfArq:'',ctfNome:'',rgpArq:'',rgpNome:''};m.push(n);return n;
}
function validade(iso,rot){
  if(!iso)return {k:'sem',cls:'b-w',t:'sem validade'};
  var d=diasAte(iso);
  if(d<0)return {k:'venc',cls:'b-e',t:rot+' vencido há '+(-d)+' dia(s)',dias:d};
  if(d<=30)return {k:'perto',cls:'b-w',t:rot+' vence em '+d+' dia(s)',dias:d};
  return {k:'ok',cls:'b-ok',t:'em dia',dias:d};
}
function pescAvisosDe(nomes){
  var out=[],ja={};
  nomes.forEach(function(n){
    var k=norm(n);if(ja[k])return;ja[k]=1;
    var p=null;(S.meta.pesc||[]).forEach(function(x){if(norm(x.nome)===k)p=x;});if(!p)return;
    var c=validade(p.ctf,'CTF'),r=validade(p.rgpVal,'RGP');
    if(c.k==='venc'||c.k==='perto')out.push({nivel:c.k==='venc'?'e':'w',t:n+': '+c.t+' ('+dt(p.ctf)+')'});
    if(r.k==='venc'||r.k==='perto')out.push({nivel:r.k==='venc'?'e':'w',t:n+': '+r.t+' ('+dt(p.rgpVal)+')'});
    if(!(p.ctfArq||p.ctfSalvo))out.push({nivel:'w',t:n+': CTF sem arquivo anexado'});
    if(!(p.rgpArq||p.rgpSalvo))out.push({nivel:'w',t:n+': RGP sem arquivo anexado'});
  });
  return out;
}
function pescAvisosHTML(itens){
  var nomes=[];(itens||[]).forEach(function(i){var nf=getNF(S,i.nfId);if(nf)nomes.push(nf.fornecedor);});
  var av=pescAvisosDe(nomes);if(!av.length)return '';
  return '<div class="alert '+(av.some(function(a){return a.nivel==='e';})?'e':'w')+'"><b>CTF e RGP dos pescadores deste pedido:</b><div class="u">'+av.map(function(a){return '<span>'+esc(a.t)+'</span>';}).join('</div><div class="u">')+'</div> <button class="btn sm" data-tab="pesc">Abrir Pescadores</button></div>';
}
function paintPesc(){var e=$('pescAv');if(e)e.innerHTML=pescAvisosHTML(itensDoDraft(S.draft));}
function ativoPesc(nome){
  var k=norm(nome),r=false;
  S.nfs.forEach(function(nf){if(norm(nf.fornecedor)!==k)return;especiesNF(nf).forEach(function(e){if(saldoNF(S,nf.id,e.esp)>0)r=true;});});
  return r;
}
function ctfAvisos(){
  carregar();var out=[];
  (S.meta.pesc||[]).forEach(function(p){
    if(!ativoPesc(p.nome))return;
    var c=validade(p.ctf,'CTF');
    if(c.k==='venc'||c.k==='perto')out.push({id:p.id,nome:p.nome,dias:c.dias,venc:c.k==='venc',data:p.ctf});
  });
  return out;
}
/* lê a data de validade escrita no PDF do CTF/RGP.
   Entende "Validade: 10/01/2027", "Válido até 10/01/2027", "10 de janeiro de 2027", datas com ponto/traço e
   tabelas em que os rótulos ficam numa linha e as datas na outra (antes ou depois). Devolve {iso, conf} ou null. */
var MESES_PT={janeiro:1,jan:1,fevereiro:2,fev:2,marco:3,'março':3,mar:3,abril:4,abr:4,maio:5,mai:5,junho:6,jun:6,julho:7,jul:7,agosto:8,ago:8,setembro:9,set:9,outubro:10,out:10,novembro:11,nov:11,dezembro:12,dez:12};
function parseValidade(txt){
  txt=String(txt||'').replace(/\s+/g,' ');
  var datas=[],m,r1=/(\d{1,2})\s*[\/\.\-]\s*(\d{1,2})\s*[\/\.\-]\s*(\d{4}|\d{2})(?!\d)/g;
  function add(d,mo,y,i,e){y=+y;if(y<100)y+=2000;d=+d;mo=+mo;if(mo<1||mo>12||d<1||d>31||y<2000||y>2100)return;datas.push({iso:y+'-'+('0'+mo).slice(-2)+'-'+('0'+d).slice(-2),i:i,e:e});}
  while((m=r1.exec(txt)))add(m[1],m[2],m[3],m.index,m.index+m[0].length);
  var r2=/(\d{1,2})\s+de\s+([A-Za-zçÇãÃ]+)\.?\s+(?:de\s+)?(\d{4})/gi;
  while((m=r2.exec(txt))){var mo=MESES_PT[m[2].toLowerCase()];if(mo)add(m[1],mo,m[3],m.index,m.index+m[0].length);}
  datas.sort(function(x,y){return x.i-y.i;});
  if(!datas.length)return null;
  var kws=[],rk=/(validade|v[aá]lid[oa]s?\s+at[eé]|v[aá]lid[oa]s?\s+até|vencimento|vence\b|expira|data\s+limite)|(emiss[aã]o|emitid[oa]|expedi[cç][aã]o|consulta|impress[aã]o|gerad[oa]|data\s+do\s+certificado)/gi;
  while((m=rk.exec(txt)))kws.push({v:!!m[1],i:m.index,e:m.index+m[0].length});
  var cand=[];
  kws.forEach(function(k,n){
    if(!k.v)return;
    var ini=n;while(ini>0&&!datas.some(function(d){return d.i>=kws[ini-1].e&&d.i<kws[ini].i;}))ini--;
    var fim=n;while(fim<kws.length-1&&!datas.some(function(d){return d.i>=kws[fim].e&&d.i<kws[fim+1].i;}))fim++;
    var pos=n-ini,tam=fim-ini+1;
    /* 1) rótulo isolado seguido da data */
    var prox=null;
    for(var j=0;j<datas.length;j++){if(datas[j].i>=k.e){prox=datas[j];break;}}
    if(tam===1&&prox&&prox.i-k.e<=140){cand.push({iso:prox.iso,pri:1});return;}
    /* 2) linha de rótulos seguida de linha de datas (na mesma ordem): "Emissão Validade  01/10/2026 01/01/2027" */
    var apos=datas.filter(function(d){return d.i>=kws[fim].e;});
    if(tam>1&&apos.length>=tam&&apos[0].i-kws[fim].e<=200){cand.push({iso:apos[pos].iso,pri:2});return;}
    /* 3) datas escritas ANTES da linha de rótulos */
    var antes=datas.filter(function(d){return d.e<=kws[ini].i;});
    if(antes.length>=tam){antes=antes.slice(antes.length-tam);cand.push({iso:antes[pos].iso,pri:3});return;}
    if(prox)cand.push({iso:prox.iso,pri:4});
  });
  if(cand.length){cand.sort(function(a,b){return a.pri-b.pri||(a.iso<b.iso?1:-1);});var bp=cand[0].pri,top=cand.filter(function(c){return c.pri===bp;}).map(function(c){return c.iso;}).sort();return {iso:top[top.length-1],conf:bp<=2?'alta':'media'};}
  /* sem rótulo de validade: a data mais tardia depois da emissão (confira) */
  var iso=datas.map(function(d){return d.iso;}).sort().pop();
  return {iso:iso,conf:'baixa'};
}
var _ocrP=null;
function carregarOcr(){
  if(window.Tesseract)return Promise.resolve(window.Tesseract);
  if(_ocrP)return _ocrP;
  _ocrP=new Promise(function(res,rej){var s=document.createElement('script');s.src='vendor/ocr/tesseract.min.js';s.onload=function(){res(window.Tesseract);};s.onerror=function(){rej(new Error('ocr'));};document.head.appendChild(s);});
  _ocrP.catch(function(){_ocrP=null;});
  return _ocrP;
}
/* PDF escaneado/foto (sem texto): desenha a página e lê com OCR */
async function ocrPdf(doc){
  var T=await carregarOcr(),w=await T.createWorker('por',1,{workerPath:'vendor/ocr/worker.min.js',corePath:'vendor/ocr/',langPath:'vendor/ocr/',gzip:true,workerBlobURL:false}),txt='';
  try{
    for(var p=1;p<=Math.min(doc.numPages,2);p++){
      var pg=await doc.getPage(p),vp=pg.getViewport({scale:2.2}),cv=document.createElement('canvas');cv.width=vp.width;cv.height=vp.height;
      await pg.render({canvasContext:cv.getContext('2d'),viewport:vp}).promise;
      var r=await w.recognize(cv);txt+=' '+r.data.text;
    }
  }finally{try{await w.terminate();}catch(e){}}
  return txt;
}
async function lerValidadePdf(by,tipo){
  try{
    var lib=await carregarPdfJs(),doc=await lib.getDocument({data:by.slice()}).promise,txt='';
    for(var p=1;p<=Math.min(doc.numPages,3);p++){var pg=await doc.getPage(p),tc=await pg.getTextContent();txt+=' '+tc.items.map(function(i){return i.str;}).join(' ');}
    var r=parseValidade(txt);
    /* a carteira do RGP não tem validade (só nascimento, registro e expedição): nada de OCR nem de dedução */
    if(tipo==='rgp')return r&&r.conf!=='baixa'?r:null;
    if(!r&&txt.replace(/\s/g,'').length<40){try{r=parseValidade(await ocrPdf(doc));if(r&&r.conf==='alta')r.conf='media';}catch(e){/* sem OCR */}}
    if(r){var mn=/Nome:\s*([A-ZÀ-Ú][A-ZÀ-Ú .'-]{4,60}?)\s+(?:Endere[cç]o|CPF|CNPJ|logradouro)/.exec(txt.replace(/\s+/g,' '));if(mn)r.nome=mn[1].trim();}
    return r;
  }catch(e){return null;}
}
function aplicarValidade(p,T,r){
  if(T==='ctf'){p.ctf=r.iso;p.ctfLido=true;p.ctfConf=r.conf;}else{p.rgpVal=r.iso;p.rgpLido=true;p.rgpConf=r.conf;}
}
/* relê a validade dos PDFs que já estão guardados (ex.: anexados antes desta versão) */
async function relerPesc(nome,tipo,todos){
  if(!PP.nfpdf){toast('Recurso indisponível neste momento.');return;}
  var L=todos?pescLista():[pescGet(nome)],ok=0,falha=0,tt=tipo?[tipo]:['ctf','rgp'];
  toast('Lendo a validade dos PDFs…');
  for(var i=0;i<L.length;i++){
    var p=L[i];
    for(var j=0;j<tt.length;j++){
      var T=tt[j],h=p[T+'Arq'];if(!h)continue;
      var by=await PP.nfpdf.obter(h);if(!by){falha++;continue;}
      var r=await lerValidadePdf(by,T);
      if(r){aplicarValidade(p,T,r);ok++;}else if(T==='ctf')falha++;
    }
  }
  salvar();render();
  toast(ok?('Validade lida em '+ok+' arquivo(s).'+(falha?' '+falha+' sem data legível: digite a data.':'')):'Não achei a data de validade nos PDFs: digite a data à mão.');
}
/* vários CTFs de uma vez: o app lê o nome que está no certificado e acha o pescador sozinho */
function acharPescPorNome(nome){
  var k=norm(nome),tk=k.split(' ').filter(function(x){return x.length>1;}),L=pescLista(),best=null;
  for(var i=0;i<L.length;i++){
    var n=norm(L[i].nome);if(n===k)return L[i].nome;
    var tn=n.split(' ').filter(function(x){return x.length>1;}),menor=tn.length<=tk.length?tn:tk,maior=tn.length<=tk.length?tk:tn;
    if(menor.length>=2&&menor.every(function(x){return maior.indexOf(x)>=0;})){if(best)return null;best=L[i].nome;} /* dois candidatos: não arrisca */
  }
  return best;
}
async function anexarCtfLote(files){
  if(!PP.nfpdf){toast('Recurso indisponível neste momento.');return;}
  var out=[];toast('Lendo '+files.length+' CTF(s)…');
  for(var i=0;i<files.length;i++){
    var f=files[i];
    if(!/\.pdf$/i.test(f.name)&&f.type!=='application/pdf'){out.push('✗ '+f.name+': não é PDF.');continue;}
    var by=new Uint8Array(await f.arrayBuffer()),r=await lerValidadePdf(by,'ctf');
    if(!r||!r.nome){out.push('? '+f.name+': não achei o nome do pescador no PDF. Anexe na linha dele.');continue;}
    var alvo=acharPescPorNome(r.nome)||r.nome,novo=!acharPescPorNome(r.nome);
    await anexarPesc(alvo,'ctf',f);
    out.push('✓ '+alvo+': válido até '+dt(r.iso)+(novo?' (pescador novo, criado agora)':''));
  }
  _loteMsg=out.join('\n');render();
}
var _loteMsg='';
async function anexarPesc(nome,tipo,file){
  if(!PP.nfpdf){toast('Recurso indisponível neste momento.');return;}
  if(!file)return;
  if(!/\.pdf$/i.test(file.name)&&file.type!=='application/pdf'){toast('Escolha o arquivo em PDF.');return;}
  toast('Guardando o '+tipo.toUpperCase()+'…');
  var by=new Uint8Array(await file.arrayBuffer()),h=await PP.nfpdf.hash(by),p=pescGet(nome),T=tipo==='ctf'?'ctf':'rgp';
  PP.nfpdf.pend[h]={bytes:by,name:file.name};await PP.nfpdf.guardar(h);
  p[T+'Arq']=h;p[T+'Nome']=file.name;if(T==='ctf')p.ctfSalvo=true;else p.rgpSalvo=true;
  var r=await lerValidadePdf(by,T),msg='';
  if(r){aplicarValidade(p,T,r);msg=' Validade lida do PDF: '+dt(r.iso)+(r.conf==='alta'?'.':' (confira a data).');}
  else msg=T==='rgp'?' (A carteira do RGP não traz data de validade.)':' Não consegui ler a validade no PDF: digite a data.';
  salvar();render();toast(tipo.toUpperCase()+' de '+nome+' guardado.'+msg);
}
async function baixarPesc(nome,tipo){
  var p=pescGet(nome),h=p[tipo+'Arq'];if(!h){toast('Ainda não há arquivo anexado.');return;}
  var by=PP.nfpdf?await PP.nfpdf.obter(h):null;
  if(!by){toast('Não achei o arquivo neste aparelho nem na nuvem. Anexe de novo.');return;}
  var nm=tipo.toUpperCase()+'_'+String(p.nome).replace(/[\/\\:*?"<>|\s]+/g,'-')+'.pdf';
  var u=URL.createObjectURL(new Blob([by],{type:'application/pdf'})),a=document.createElement('a');a.href=u;a.download=nm;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},4000);
}
function cArq(p,t){
  var n=esc(p.nome),arq=p[t+'Arq'],T=t.toUpperCase();
  var inp='<input type="file" accept="application/pdf,.pdf" data-pfile="'+t+'" data-pk="'+n+'" hidden>';
  if(arq)return '<span title="'+esc(p[t+'Nome']||'')+'">'+esc((p[t+'Nome']||T+'.pdf').replace(/^(.{22}).+(\.pdf)$/i,'$1…$2'))+'</span><div class="row" style="gap:6px;margin-top:4px"><button type="button" class="btn sm" data-act="baixarpesc" data-pk="'+n+'" data-pt="'+t+'">⬇ Baixar</button><button type="button" class="btn sm" data-act="escolherpesc">Trocar</button><button type="button" class="btn sm" data-act="relerpesc" data-pk="'+n+'" data-pt="'+t+'" title="Lê de novo a data de validade escrita no PDF">Reler validade</button>'+inp+'</div>';
  return '<button type="button" class="btn pri sm" data-act="escolherpesc">Anexar '+T+'</button>'+inp+((t==='ctf'?p.ctfSalvo:p.rgpSalvo)?' <span class="muted" style="font-size:12px">marcado como salvo (sem arquivo no app)</span>':'');
}
function viewPesc(){
  var L=pescLista(),nOk=0,nPerto=0,nRuim=0;
  L.forEach(function(p){var c=validade(p.ctf,'CTF');if(!p.ctfArq||c.k==='venc'||c.k==='sem')nRuim++;else if(c.k==='perto')nPerto++;else nOk++;});
  var h='<div class="card"><h2>Pescadores · CTF e RGP'+ia('pesc')+'</h2><p class="muted" style="margin-top:0">Anexe o PDF do CTF e do RGP de cada pescador uma vez só: o app guarda (neste aparelho e na nuvem), mostra a validade e deixa baixar na hora de enviar. Os fornecedores das suas NFs aparecem aqui sozinhos.</p>';
  h+='<div class="row" style="gap:12px;margin:8px 0 14px"><div class="card" style="margin:0;flex:1 1 160px"><div class="muted">CTF em dia</div><div style="font-size:26px;font-weight:700;color:var(--ok,#4cc58a)">'+nOk+'</div></div><div class="card" style="margin:0;flex:1 1 160px"><div class="muted">Vencem em até 30 dias</div><div style="font-size:26px;font-weight:700;color:var(--wa,#e0b34a)">'+nPerto+'</div></div><div class="card" style="margin:0;flex:1 1 160px"><div class="muted">Vencidos ou sem arquivo</div><div style="font-size:26px;font-weight:700;color:var(--er,#ef6b6b)">'+nRuim+'</div></div></div>';
  h+='<div class="row" style="align-items:flex-end;margin-bottom:8px"><div class="field" style="flex:1 1 240px"><label for="pescNovo">Adicionar pescador (que ainda não tem NF)</label><input type="text" id="pescNovo" placeholder="Nome do pescador"></div><button class="btn" data-act="addpesc">Adicionar</button><button class="btn" data-act="relertodos" title="Lê a data de validade escrita em todos os CTF/RGP já anexados">Reler validade de todos os PDFs</button></div>';
  h+='<div class="row" style="align-items:center;margin-bottom:10px"><button type="button" class="btn pri" data-act="lotectf">Anexar vários CTFs de uma vez</button><input type="file" id="pescLote" accept="application/pdf,.pdf" multiple hidden><span class="muted" style="font-size:12.5px">Escolha todos os PDFs: o app lê o nome e a validade de cada certificado e coloca no pescador certo.</span></div>'+(_loteMsg?'<div class="alert ok" style="white-space:pre-line;margin-bottom:10px">'+esc(_loteMsg)+'</div>':'');
  if(!L.length)return h+'<p class="muted">Nenhum pescador ainda. Cadastre as NFs de entrada ou adicione um pescador acima.</p></div>';
  h+='<div style="overflow-x:auto"><table class="mpt"><thead><tr><th>Pescador</th><th>CTF (arquivo)</th><th>CTF válido até</th><th>Situação do CTF</th><th>RGP (arquivo)</th><th>RGP válido até (se tiver)</th><th>Observação</th></tr></thead><tbody>';
  L.forEach(function(p){
    var c=validade(p.ctf,'CTF'),r=p.rgpVal?validade(p.rgpVal,'RGP'):null,n=esc(p.nome),sit;
    if(!p.ctfArq&&!p.ctf)sit='<span class="badge b-e">Sem CTF anexado</span>';
    else if(c.k==='ok')sit='<span class="badge b-ok">Em dia ('+c.dias+' dias)</span>'+(p.ctfArq?'':' <span class="badge b-w">sem arquivo</span>');
    else if(c.k==='venc')sit='<span class="badge b-e">'+esc(c.t)+' · solicitar outro</span>';
    else if(c.k==='perto')sit='<span class="badge b-w">'+esc(c.t)+' · pedir novo</span>';
    else sit='<span class="badge b-w">sem validade</span>';
    h+='<tr><td><b>'+n+'</b>'+(ativoPesc(p.nome)?'':' <span class="muted">· sem saldo</span>')+'</td>'
     +'<td>'+cArq(p,'ctf')+'</td>'
     +'<td><input type="date" data-pf="ctf" data-pk="'+n+'" value="'+esc(p.ctf||'')+'">'+(p.ctfLido&&p.ctf?' <span class="badge '+(p.ctfConf==='baixa'?'b-w':'b-ok')+'" style="opacity:.85">'+(p.ctfConf==='baixa'?'lida do PDF · confira':'lida do PDF')+'</span>':'')+'</td>'
     +'<td>'+sit+'</td>'
     +'<td>'+cArq(p,'rgp')+'</td>'
     +'<td><input type="date" data-pf="rgpVal" data-pk="'+n+'" value="'+esc(p.rgpVal||'')+'">'+(r&&r.k!=='ok'?' <span class="badge '+r.cls+'">'+esc(r.t)+'</span>':'')+'</td>'
     +'<td><input type="text" data-pf="obs" data-pk="'+n+'" value="'+esc(p.obs||'')+'" placeholder="opcional"></td></tr>';
  });
  return h+'</tbody></table></div><p class="muted" style="margin:10px 0 0">Se o app não conseguir ler a validade do PDF, você digita a data. Os arquivos ficam guardados no app e, com login, na nuvem.</p></div>';
}

/* ---------- PDF único das NFs (para o SEI) ---------- */
var _pdfCtx=null,_pdfUlt=null;
function nomePdf(pack){var n=String(pack||'').replace(/[\/\\:*?"<>|\s]+/g,'-').replace(/^-+|-+$/g,'');return 'NOTAS_DE_ENTRADA_UNIFICADAS'+(n?'_'+n:'')+'.pdf';}
function baixarUltimoPdf(){
  if(!_pdfUlt)return;
  var u=URL.createObjectURL(_pdfUlt.blob),a=document.createElement('a');a.href=u;a.download=_pdfUlt.nome;document.body.appendChild(a);a.click();a.remove();setTimeout(function(){URL.revokeObjectURL(u);},4000);
}
async function pdfUnico(pack,itens){
  if(!PP.nfpdf){toast('Recurso indisponível neste momento.');return;}
  if(!itens||!itens.length){toast('Este pedido ainda não tem NFs escolhidas.');return;}
  _pdfCtx={pack:pack,itens:itens};
  toast('Montando o PDF das notas…');
  var r;
  try{r=await PP.nfpdf.montar(S,itens);}catch(e){toast('Não consegui montar o PDF ('+(e&&e.message?e.message:'erro')+'). Recarregue a página e tente de novo.');return;}
  if(r.faltam.length){
    abrirModal('<h2>Faltam os PDFs de '+r.faltam.length+' nota(s)</h2><p class="muted">Para juntar as notas num arquivo só, o app precisa do PDF original de cada uma. Escolha de uma vez os PDFs dessas notas (pode ser vários). Isso é feito uma única vez: depois ficam guardados no app e na nuvem.</p>'
      +'<ul>'+r.faltam.map(function(n){return '<li>NF <b>'+esc(n.numero)+'</b> · '+esc(n.fornecedor)+'</li>';}).join('')+'</ul>'
      +'<div class="row" style="margin-top:10px"><label class="btn pri" style="cursor:pointer">Escolher os PDFs das notas<input type="file" id="pdfanexo" accept="application/pdf" multiple style="display:none"></label><button class="btn" data-act="fechar">Cancelar</button></div>');
    return;
  }
  _pdfUlt={blob:new Blob([r.pdf],{type:'application/pdf'}),nome:nomePdf(pack)};_pdfFeito=String(pack||'');paintFluxo();
  baixarUltimoPdf();
  var av='';
  if(r.semLinha.length)av+='<div class="alert w"><b>Não consegui achar a linha para grifar:</b><ul>'+r.semLinha.map(function(x){return '<li>'+nomeHTML(x.esp)+' na NF '+esc(x.nf.numero)+'</li>';}).join('')+'</ul>Confira o PDF e grife essas à mão.</div>';
  var nuv=PP.nfpdf.st.nuvem&&PP.nfpdf.st.nuvem!=='ok'?'<p class="muted">'+esc(PP.nfpdf.st.nuvem)+'</p>':'';
  abrirModal('<h2>PDF das notas pronto</h2><p><b>'+esc(_pdfUlt.nome)+'</b> foi baixado: '+r.nNFs+' nota(s), '+r.nPag+' página(s), '+r.nGrifos+' grifo(s) em amarelo (espécie + quantidade).</p>'+av+nuv
    +'<div class="row" style="margin-top:10px"><button class="btn pri" data-act="pdfbaixar">Baixar de novo</button><button class="btn" data-act="fechar">Fechar</button></div>');
}
async function anexarPdfs(files){
  toast('Lendo os PDFs…');
  var r;
  try{r=await lerArquivos(files);}catch(e){toast('Não consegui carregar o leitor de PDF. Recarregue a página e tente de novo.');return;}
  var n=0;
  r.nfs.forEach(function(x){
    if(!x.arq||!x.numero)return;
    S.nfs.forEach(function(o){if(norm(o.numero)===norm(x.numero)&&norm(o.fornecedor)===norm(x.fornecedor)){o.arq=x.arq;o.pags=x.pags;PP.nfpdf.guardar(x.arq);n++;}});
  });
  if(!n){toast('Esses PDFs não bateram com as notas cadastradas (número e fornecedor).');return;}
  salvar();
  if(_pdfCtx)pdfUnico(_pdfCtx.pack,_pdfCtx.itens);else{fecharModal();toast(n+' nota(s) com PDF guardado.');}
}
function copiarTexto(tx){
  var fim=function(){toast('Copiado.');};
  if(navigator.clipboard&&navigator.clipboard.writeText){navigator.clipboard.writeText(tx).then(fim,function(){copiarFallback(tx);});}
  else copiarFallback(tx);
}
function copiarFallback(tx){var ta=document.createElement('textarea');ta.value=tx;document.body.appendChild(ta);ta.select();try{document.execCommand('copy');toast('Copiado.');}catch(e){toast('Não consegui copiar. Selecione o texto e use Ctrl+C.');}ta.remove();}
/* ====================== EVENTOS (só dentro da aba / do modal) ====================== */
function meu(el){return !!(el&&el.closest&&el.closest('#vMapa,#mpModal,#mpTip'));}
document.addEventListener('click',function(ev){
  if(!meu(ev.target)){
    /* botões "Abrir Pescadores" etc. que aparecem em outras telas (Exportação, Hoje...) */
    var o=ev.target.closest&&ev.target.closest('.alert [data-tab], [data-mptab]');
    if(o){var tb=o.dataset.tab||o.dataset.mptab;if(tb){tab=tb;PP.go('mapa');window.scrollTo(0,0);}}
    return;
  }
  var t=ev.target.closest('[data-tab],[data-act],.info');if(!t)return;
  if(t.classList.contains('info')){ev.preventDefault();mostrarTip(t);return;}
  if(t.dataset.tab){tab=t.dataset.tab;render();window.scrollTo(0,0);return;}
  var a=t.dataset.act,i=parseInt(t.dataset.i,10),j=parseInt(t.dataset.j,10),id=t.dataset.id;
  var d=S.draft;
  if(a==='ler'){
    var ls=parseLinhas($('colar').value);
    if(!ls.length){toast('Não encontrei espécies com quantidade. Use uma por linha, como: Otocinclus hoppei 15.000');return;}
    ls.forEach(function(l){d.linhas.push({esp:l.esp,qtd:l.qtd,aloc:[]});});
    if(S.nfs.length)d.linhas.forEach(function(L,k){if(!L.aloc.length)sugerirLinha(k);});
    $('colar').value='';salvar();paintAll();toast(ls.length+' espécie(s) lidas.'+(S.nfs.length?' Confira as NFs sugeridas.':' Cadastre as NFs de entrada para conferir.'));
  }else if(a==='addlinha'){d.linhas.push({esp:'',qtd:0,aloc:[]});salvar();paintAll();}
  else if(a==='sugerirtudo'){if(!S.nfs.length){toast('Cadastre as NFs de entrada primeiro.');return;}var vv=validarDraft(S,d),nSug=0,nMan=0;d.linhas.forEach(function(L,k){var r=vv.linhas[k],okLn=L.aloc.length>0&&r&&!r.problemas.some(function(p){return p.nivel==='erro';});if(okLn){nMan++;return;}if(sugerirLinha(k))nSug++;});salvar();paintAll();toast(nSug+' espécie(s) preenchida(s).'+(nMan?' '+nMan+' já tinha(m) NF escolhida e foi(ram) mantida(s).':''));}
  else if(a==='sugerir'){if(!S.nfs.length){toast('Cadastre as NFs de entrada primeiro.');return;}var L1=d.linhas[i],r1=validarDraft(S,d).linhas[i];if(L1&&L1.aloc.length&&r1&&!r1.problemas.some(function(p){return p.nivel==='erro';})&&!confirm('Esta espécie já tem NF escolhida e sem problema. Substituir pela sugestão do app?'))return;if(sugerirLinha(i)){salvar();paintAll();}}
  else if(a==='usarnome'){var L0=d.linhas[i];L0.esp=t.dataset.nome;sugerirLinha(i);salvar();paintAll();}
  else if(a==='trocar'){d.linhas[i].edit=true;salvar();paintAll();}
  else if(a==='concluir'){d.linhas[i].edit=false;d.linhas[i].editNome=false;salvar();paintAll();}
  else if(a==='editnome'){d.linhas[i].editNome=true;d.linhas[i].edit=true;salvar();paintAll();}
  else if(a==='rmlinha'){d.linhas.splice(i,1);salvar();paintAll();}
  else if(a==='addaloc'){d.linhas[i].aloc.push({nfId:'',qtd:0});salvar();paintAlloc(i);paintStatus();}
  else if(a==='rmaloc'){d.linhas[i].aloc.splice(j,1);salvar();paintAlloc(i);paintStatus();}
  else if(a==='limpar'){if(confirm('Limpar o pedido em andamento?')){S.draft=novoDraft();salvar();render();}}
  else if(a==='protocolar'){
    var r=protocolar(S,d);
    if(!r.ok){toast(r.erro);paintStatus();return;}
    if(!confirm('Gravar o consumo das NFs para o pack '+r.proc.pack+(r.proc.sei?' (SEI '+r.proc.sei+')':'')+'?\n\nO saldo das NFs cai agora. O protocolo no SEI/MAPA você marca depois, em Processos.')){
      S.processos=S.processos.filter(function(p){return p.id!==r.proc.id;});return;
    }
    S.draft=novoDraft();_pdfFeito=null;salvar();tab='processos';render();
    toast('Consumo gravado. Saldo das NFs atualizado. Falta protocolar no SEI/MAPA (marque em Processos).');
  }
  else if(a==='grifosdraft'){var ev0=validarDraft(S,d);abrirModal(grifosHTML('Folha de grifos – Pack '+(d.pack||'(sem número)')+(d.sei?' · SEI '+d.sei:''),folhaGrifos(S,itensDoDraft(d),true),ev0.erros?'Atenção: ainda há '+ev0.erros+' espécie(s) com problema neste pedido. Esta folha está incompleta até você resolver.':''));}
  else if(a==='escolherpesc'){var fi=t.parentNode.querySelector('input[type=file]');if(fi)fi.click();}
  else if(a==='baixarpesc'){baixarPesc(t.dataset.pk,t.dataset.pt);}
  else if(a==='lotectf'){var fl=$('pescLote');if(fl)fl.click();}
  else if(a==='relerpesc'){relerPesc(t.dataset.pk,t.dataset.pt,false);}
  else if(a==='relertodos'){relerPesc('','',true);}
  else if(a==='addpesc'){var nm=($('pescNovo').value||'').trim();if(!nm){toast('Digite o nome do pescador.');return;}pescGet(nm);salvar();render();toast('Pescador adicionado.');}
  else if(a==='pdfdraft'){pdfUnico(d.pack,itensDoDraft(d));}
  else if(a==='pdfproc'){var pp0=S.processos.filter(function(x){return x.id===id;})[0];if(pp0)pdfUnico(pp0.pack,pp0.itens);}
  else if(a==='pdfbaixar'){baixarUltimoPdf();}
  else if(a==='grifosproc'){var pg=S.processos.filter(function(x){return x.id===id;})[0];abrirModal(grifosHTML('Folha de grifos – Pack '+pg.pack+(pg.sei?' · SEI '+pg.sei:''),folhaGrifos(S,pg.itens,false)));}
  else if(a==='resumoproc'){abrirModal(resumoHTML(S.processos.filter(function(x){return x.id===id;})[0]));}
  else if(a==='cartaproc'){cartaEstado={procId:id,apont:''};abrirModal(cartaHTML(S.processos.filter(function(x){return x.id===id;})[0]));}
  else if(a==='atualizarcarta'){cartaEstado.apont=$('cartaApont').value;S.meta.responsavel=$('cartaResp').value;salvar();var pc=S.processos.filter(function(x){return x.id===cartaEstado.procId;})[0];$('cartaTxt').value=cartaMAPA(S,pc,cartaEstado.apont,S.meta.responsavel);toast('Texto atualizado.');}
  else if(a==='copiarcarta'){copiarTexto($('cartaTxt').value);}
  else if(a==='copiarmodal'){copiarTexto($('modaltxt').textContent);}
  else if(a==='imprimir'){window.print();}
  else if(a==='fechar'){fecharModal();}
  else if(a==='salvarnf'){
    var itens=parseLinhas(formNF.texto);
    var r2=salvarNF(S,{id:formNF.id,numero:formNF.numero,fornecedor:formNF.fornecedor,data:formNF.data,itens:itens});
    if(!r2.ok){toast(r2.erro);return;}
    formNF={id:null,numero:'',fornecedor:'',data:hoje(),texto:''};salvar();render();toast('NF salva.');
  }
  else if(a==='salvarrev'){
    var ok=0,erros=[],resto=[],nm=0;
    rev.forEach(function(r){
      if(!r.incluir){if(r.ja&&r.marcados&&r.marcados.length)nm+=addMarcas(S,r.numero,r.fornecedor,r.marcados,parseLinhas(r.texto));resto.push(r);return;}
      var rr=salvarNF(S,{numero:r.numero,fornecedor:r.fornecedor,data:r.data,itens:parseLinhas(r.texto)});
      if(rr.ok){ok++;if(r.arq&&PP.nfpdf){rr.nf.arq=r.arq;rr.nf.pags=r.pags;PP.nfpdf.guardar(r.arq);}if(r.marcados&&r.marcados.length)nm+=addMarcas(S,r.numero,r.fornecedor,r.marcados,parseLinhas(r.texto));}else{erros.push('NF '+r.numero+': '+rr.erro);r.incluir=true;resto.push(r);}
    });
    rev=resto.filter(function(r){return erros.length?true:false;});
    if(!erros.length)rev=[];
    salvar();render();toast(ok+' NF(s) cadastrada(s).'+(nm?' '+nm+' marcação(ões) do PDF para vincular.':'')+(erros.length?' '+erros[0]:''));
  }
  else if(a==='snf'){filtroSN=id;render();}
  else if(a==='cancelrev'){rev=[];render();}
  else if(a==='mkvinc'||a==='mkign'||a==='mkmais'||a==='mkreabrir'){
    var m=null;S.marcas.forEach(function(x){if(x.id===id)m=x;});if(!m)return;
    if(a==='mkign'){m.ignorada=true;m.mais=false;salvar();render();toast('Marcação ignorada.');return;}
    if(a==='mkreabrir'){m.ignorada=false;salvar();render();return;}
    if(a==='mkmais'){m.mais=true;delete mv[m.id];salvar();render();return;}
    var nf=nfDaMarca(S,m),cands=candidatosMarca(S,m,expsApp()),v=mvDe(m,cands,nf),d;
    if(v.sel==='__outro')d={pack:v.pack,qtd:parseQtd(v.qtd)};
    else{var c=null;cands.forEach(function(x){if(x.num===v.sel)c=x;});d={pack:v.sel,qtd:parseQtd(v.qtd),sei:c?c.sei:'',destino:c?c.cliente:'',data:c?c.dataISO:''};}
    var sd0=nf?saldoNF(S,nf.id,m.esp):0;
    var rv=vincularMarca(S,m,d);
    if(!rv.ok){toast(rv.erro);return;}
    delete mv[m.id];salvar();render();
    toast('Vinculado ao pack '+d.pack+'. '+(rv.saldo<0?'Atenção: a nota ficou com saldo negativo ('+fmt(rv.saldo)+').':'Saldo da nota agora: '+fmt(rv.saldo)+'.'));
  }
  else if(a==='unificar'){
    var r5=rev[parseInt(t.dataset.r,10)],de=t.dataset.de,para=t.dataset.para;
    r5.texto=r5.texto.split('\n').map(function(l){return l.indexOf(de)===0?para+l.slice(de.length):l;}).join('\n');render();
  }
  else if(a==='editnf'){var nf=getNF(S,id);formNF={id:nf.id,numero:nf.numero,fornecedor:nf.fornecedor,data:nf.data,texto:nf.itens.map(function(x){return x.esp+' '+fmt(x.qtd);}).join('\n')};render();window.scrollTo(0,0);}
  else if(a==='cancelaredit'){formNF={id:null,numero:'',fornecedor:'',data:hoje(),texto:''};render();}
  else if(a==='delnf'){if(!confirm('Excluir esta NF?'))return;var r3=excluirNF(S,id);if(!r3.ok){toast(r3.erro);return;}salvar();render();}
  else if(a==='marcarprot'){marcarProt(id);}
  else if(a==='desmarcarprot'){var pd=S.processos.filter(function(x){return x.id===id;})[0];if(pd){pd.protocolado=false;pd.dataProt='';salvar();render();toast('Voltou para “falta protocolar”.');}}
  else if(a==='cancelproc'){if(!confirm('Cancelar este processo e liberar o saldo das NFs? Faça isso só depois que o MAPA confirmar o cancelamento.'))return;setStatusProc(S,id,'cancelado');salvar();render();toast('Saldo liberado.');}
  else if(a==='reativar'){var r4=setStatusProc(S,id,'ativo');if(!r4.ok){toast(r4.erro);return;}salvar();render();toast('Processo reativado.');}
  else if(a==='delproc'){if(!confirm('Excluir este processo? O saldo das NFs será recalculado.'))return;S.processos=S.processos.filter(function(p){return p.id!==id;});salvar();render();}
});
document.addEventListener('mouseover',function(ev){var e=ev.target.closest&&ev.target.closest('.info');if(e&&meu(e))mostrarTip(e);});
document.addEventListener('mouseout',function(ev){var e=ev.target.closest&&ev.target.closest('.info');if(e&&meu(e))esconderTip();});
document.addEventListener('focusin',function(ev){var e=ev.target.closest&&ev.target.closest('.info');if(e&&meu(e))mostrarTip(e);});
document.addEventListener('focusout',function(ev){var e=ev.target.closest&&ev.target.closest('.info');if(e&&meu(e))esconderTip();});
document.addEventListener('scroll',esconderTip,true);
document.addEventListener('keydown',function(ev){if(ev.key==='Escape'){esconderTip();var m=$('modal');if(m&&m.className==='on')fecharModal();}});
/* v26: soltar PDF em QUALQUER ponto da tela Notas de entrada (e nunca deixar o navegador abrir o PDF e sair do app) */
function temArquivos(ev){var t=ev.dataTransfer&&ev.dataTransfer.types;if(!t)return false;for(var i=0;i<t.length;i++)if(t[i]==='Files')return true;return false;}
function zonaDrop(ev){return tab==='nfs'&&ev.target.closest&&ev.target.closest('#vMapa');}
var _dragN=0;
function dropOver(on){var z=$('dropnf');if(z)z.classList.toggle('over',!!on);var v=$('vMapa');if(v)v.classList.toggle('dropping',!!on);}
function outraZona(ev){return ev.target.closest&&ev.target.closest('input,label,textarea,.drop,[id^=drop],[contenteditable],#mpModal');}
document.addEventListener('dragenter',function(ev){if(!temArquivos(ev))return;if(zonaDrop(ev)){ev.preventDefault();_dragN++;dropOver(true);}});
document.addEventListener('dragover',function(ev){if(!temArquivos(ev))return;if(zonaDrop(ev)){ev.preventDefault();ev.dataTransfer.dropEffect='copy';dropOver(true);}else if(!outraZona(ev))ev.preventDefault();});
document.addEventListener('dragleave',function(ev){if(!temArquivos(ev))return;if(zonaDrop(ev)){_dragN=Math.max(0,_dragN-1);if(!_dragN)dropOver(false);}});
document.addEventListener('drop',function(ev){
  if(!temArquivos(ev))return;
  if(!zonaDrop(ev)){if(!outraZona(ev))ev.preventDefault();return;}
  ev.preventDefault();_dragN=0;dropOver(false);
  var fs=Array.prototype.filter.call(ev.dataTransfer.files||[],function(f){return /\.pdf$/i.test(f.name)||f.type==='application/pdf';});
  if(fs.length){toast('Lendo '+fs.length+' PDF(s)…');processarNFs(fs);}else toast('Arraste arquivos PDF.');
});
document.addEventListener('input',function(ev){
  var e=ev.target;if(!meu(e))return;var d=S.draft;
  if(e.dataset.f){
    if(e.dataset.f==='pack')d.pack=e.value;else if(e.dataset.f==='sei')d.sei=e.value;else if(e.dataset.f==='destino')d.destino=e.value;
    salvar();return;
  }
  if(e.dataset.r!==undefined&&e.dataset.rk!=='incluir'){rev[parseInt(e.dataset.r,10)][e.dataset.rk]=e.value;return;}
  if(e.dataset.n){formNF[e.dataset.n]=e.value;return;}
  if(e.id==='busca'){filtroNF=e.value;$('nflist').innerHTML=listaNFs();return;}
  if(e.id==='buscaE'){filtroEsp=e.value;$('saldolist').innerHTML=listaSaldo();return;}
  if(e.id==='buscaSN'){buscaSN=e.value;$('snlist').innerHTML=tabelaSN();return;}
  if(e.dataset.mk&&(e.dataset.mf==='pack'||e.dataset.mf==='qtd')){var m2=mv[e.dataset.mk];if(m2){if(e.dataset.mf==='pack')m2.pack=e.value;else{m2.qtd=String(parseQtd(e.value));m2.qAuto=false;}}return;}
  if(e.dataset.l!==undefined){
    var i=parseInt(e.dataset.l,10),L=d.linhas[i],k=e.dataset.k;
    if(k==='esp'){L.esp=e.value;}
    else if(k==='qtd'){L.qtd=parseQtd(e.value);}
    else if(k==='aq'){L.aloc[parseInt(e.dataset.a,10)].qtd=parseQtd(e.value);}
    salvar();paintStatus();
  }
});
document.addEventListener('change',function(ev){
  var e=ev.target;if(!meu(e))return;var d=S.draft;
  if(e.dataset.f==='hist'){d.historico=e.checked;salvar();paintAll();return;}
  if(e.dataset.f==='modo'){S.meta.modo=e.value;salvar();return;}
  if(e.dataset.r!==undefined&&e.dataset.rk==='incluir'){rev[parseInt(e.dataset.r,10)].incluir=e.checked;return;}
  if(e.dataset.mk){
    var mm=null;S.marcas.forEach(function(x){if(x.id===e.dataset.mk)mm=x;});if(!mm)return;
    var vv0=mv[mm.id]||(mv[mm.id]={sel:'',pack:'',qtd:'',qAuto:true});
    if(e.dataset.mf==='sel'){vv0.sel=e.value;vv0.qAuto=true;render();}
    else if(e.dataset.mf==='pack'){vv0.pack=e.value;}
    else if(e.dataset.mf==='qtd'){vv0.qtd=String(parseQtd(e.value));vv0.qAuto=false;e.value=vv0.qtd==='0'?'':fmt(parseQtd(e.value));}
    return;
  }
  if(e.id==='sosaldo'){filtroSaldo=e.checked;$('nflist').innerHTML=listaNFs();return;}
  if(e.id==='pescLote'&&e.files&&e.files.length){var fs=Array.prototype.slice.call(e.files);e.value='';anexarCtfLote(fs);return;}
  if(e.dataset.pfile&&e.files&&e.files.length){var fz=e.files[0];var nz=e.dataset.pk,tz=e.dataset.pfile;e.value='';anexarPesc(nz,tz,fz);return;}
  if(e.dataset.pf){var pp1=pescGet(e.dataset.pk);pp1[e.dataset.pf]=e.type==='checkbox'?e.checked:e.value;if(e.dataset.pf==='ctf'){pp1.ctfLido=false;}if(e.dataset.pf==='rgpVal')pp1.rgpLido=false;salvar();if(e.dataset.pf==='ctf'||e.dataset.pf==='rgpVal')render();return;}
  if(e.id==='pdfanexo'&&e.files&&e.files.length){var fa=Array.prototype.slice.call(e.files);e.value='';anexarPdfs(fa);return;}
  if(e.id==='nfpdf'&&e.files&&e.files.length){var fs=Array.prototype.slice.call(e.files);e.value='';processarNFs(fs);return;}
  if(e.id==='packpdf'&&e.files&&e.files.length){var fp=Array.prototype.slice.call(e.files);e.value='';processarPack(fp);return;}
  if(e.dataset.l!==undefined){
    var i=parseInt(e.dataset.l,10),L=d.linhas[i],k=e.dataset.k;
    if(k==='nf'){L.aloc[parseInt(e.dataset.a,10)].nfId=e.value;salvar();paintAll();}
    else if(k==='esp'){salvar();paintAlloc(i);paintStatus();}
    return;
  }
  if(e.id==='imp'&&e.files&&e.files[0]){
    var rd=new FileReader();
    rd.onload=function(){
      var n=lerImport(rd.result);
      if(!n){toast('Arquivo de backup inválido. Use o .json baixado do app antigo (Conferência MAPA).');return;}
      if((S.nfs.length||S.processos.length)&&!confirm('Importar este backup? As NFs e processos que já estão aqui serão substituídos.'))return;
      n.draft=novoDraft();S=n;salvar();tab='nfs';render();toast('Backup importado: '+n.nfs.length+' NF(s) e '+n.processos.length+' processo(s).');
    };
    rd.readAsText(e.files[0]);
  }
});

/* ====================== CONFERÊNCIA DE NFs NA EXPORTAÇÃO ====================== */
function chavePack(p){var m=String(p||'').match(/(\d+)(?:\s*\/\s*(\d{2,4}))?/);if(!m)return norm(p);var a=m[2]?(m[2].length===2?'20'+m[2]:m[2]):'';return String(parseInt(m[1],10))+(a?'/'+a:'');}
function mesmoPack(a,b){var x=chavePack(a),y=chavePack(b);if(x===y)return true;var xn=x.split('/')[0],yn=y.split('/')[0];return xn===yn&&(x.indexOf('/')<0||y.indexOf('/')<0);}
function procDoPack(num){for(var i=0;i<S.processos.length;i++){var p=S.processos[i];if(p.status==='ativo'&&mesmoPack(p.pack,num))return p;}return null;}
function agruparItens(items){
  var out=[];
  (items||[]).forEach(function(it){
    var q=Math.round(+it.qtd||0);if(!(q>0))return;
    for(var k=0;k<out.length;k++){if(mesmaEsp(out[k].esp,it.esp)){out[k].qtd+=q;return;}}
    out.push({esp:nomeSci(it.esp)||String(it.esp||'').trim(),qtd:q});
  });
  return out;
}
/* monta o pedido da exportação como "draft": usa o que você ajustou na aba Verificar pedido (se for o mesmo pack) ou sugere as NFs */
function rascunhoDeExportacao(info){
  var itens=agruparItens(info.items);
  var adot=S.draft&&S.draft.pack&&mesmoPack(S.draft.pack,info.num)?S.draft:null;
  var d={pack:info.num,sei:(adot&&adot.sei)||((S.meta.expSei||{})[info.num])||'',destino:info.cliente||'',data:(info.dataISO||hoje()),historico:false,linhas:[]};
  itens.forEach(function(it){
    var L={esp:it.esp,qtd:it.qtd,aloc:[]},velha=null;
    if(adot)adot.linhas.forEach(function(x){if(!velha&&mesmaEsp(x.esp,it.esp)&&x.qtd===it.qtd&&x.aloc.length)velha=x;});
    if(velha){L.aloc=velha.aloc.map(function(a){return {nfId:a.nfId,qtd:a.qtd};});}
    else if(S.nfs.length){
      var usado={};d.linhas.forEach(function(o){if(!mesmaEsp(o.esp,it.esp))return;o.aloc.forEach(function(a){usado[a.nfId]=(usado[a.nfId]||0)+a.qtd;});});
      L.aloc=sugerirModo(S,it.esp,it.qtd,usado,S.meta.modo).aloc;
    }
    d.linhas.push(L);
  });
  return {d:d,adotado:!!adot};
}
function alertaLinhaTxt(sp,r){
  var out='';
  r.problemas.forEach(function(p){
    if(p.tipo==='sem_saldo'){
      var us=p.usos.map(function(u){return '<div class="u"><span>Pack '+esc(u.pack)+(u.sei?' · SEI '+esc(u.sei):'')+(u.historico?' (histórico)':'')+'</span><span>'+fmt(u.qtd)+'</span></div>';}).join('');
      out+='<div class="alert e"><b>'+esc(nomeSci(sp))+': você já usou a NF '+esc(p.nf)+' ('+esc(p.fornecedor)+')</b><div style="margin:4px 0">Entraram '+fmt(p.entrada)+' e restam '+fmt(Math.max(p.saldo,0))+'. Este pack precisa de '+fmt(p.precisa)+'. Já consumida em:</div>'+(us||'<div class="u"><span>nenhum processo</span></div>')+'</div>';
    }else if(p.tipo==='soma'){
      var f=p.qtd-p.soma;out+='<div class="alert e"><b>'+esc(nomeSci(sp))+':</b> alocado '+fmt(p.soma)+' de '+fmt(p.qtd)+(f>0?' — faltam '+fmt(f)+'. Cadastre a NF que falta em Notas de entrada.':' — passou '+fmt(-f)+'.')+'</div>';
    }else if(p.tipo==='sem_alocacao'){
      out+='<div class="alert '+(p.semNF?'w':'e')+'"><b>'+esc(nomeSci(sp))+':</b> '+(p.semNF?'nenhuma NF cadastrada tem saldo desta espécie.':'sem NF escolhida.')+'</div>';
    }else if(p.tipo==='parecida'){
      out+='<div class="alert w"><b>'+esc(nomeSci(sp))+':</b> nome parecido já cadastrado ('+p.nomes.map(function(n){return esc(nomeSci(n));}).join(', ')+'). É a mesma espécie? Confira em Notas de entrada.</div>';
    }else if(p.msg){out+='<div class="alert '+(p.nivel==='aviso'?'w':'e')+'">'+esc(p.msg)+'</div>';}
  });
  return out;
}
function nfsDaLinha(L){return L.aloc.map(function(a){var nf=getNF(S,a.nfId);return nf?('<span class="nfchip">NF '+esc(nf.numero)+' <span class="muted">'+esc(nf.fornecedor)+'</span> · '+fmt(a.qtd)+'</span>'):'';}).join(' ');}
function saldoDepoisTxt(L){return L.aloc.map(function(a){var nf=getNF(S,a.nfId);if(!nf)return '—';return fmt(saldoNF(S,nf.id,L.esp)-a.qtd);}).join(' · ');}
function estadoExportacao(info){
  var itens=agruparItens(info.items);
  if(!itens.length)return {tipo:'vazio'};
  var proc=procDoPack(info.num);
  if(proc){
    var difs=[];
    var porEsp=[];proc.itens.forEach(function(i){for(var k=0;k<porEsp.length;k++){if(mesmaEsp(porEsp[k].esp,i.esp)){porEsp[k].qtd+=i.qtd;return;}}porEsp.push({esp:i.esp,qtd:i.qtd});});
    itens.forEach(function(it){var m=null;porEsp.forEach(function(x){if(mesmaEsp(x.esp,it.esp))m=x;});if(!m)difs.push(nomeSci(it.esp)+': não consta no processo protocolado');else if(m.qtd!==it.qtd)difs.push(nomeSci(it.esp)+': pedido '+fmt(it.qtd)+' × protocolado '+fmt(m.qtd));});
    porEsp.forEach(function(x){if(!itens.some(function(it){return mesmaEsp(x.esp,it.esp);}))difs.push(nomeSci(x.esp)+': está no processo, mas não no pedido');});
    return {tipo:'protocolado',proc:proc,difs:difs};
  }
  var r=rascunhoDeExportacao(info),v=validarDraft(S,r.d);
  return {tipo:v.erros?'problema':'pronto',d:r.d,v:v,adotado:r.adotado};
}
function panelHTML(){
  var X=PP.exp;if(!X||!X.mapaInfo)return '';
  var info=X.mapaInfo(),est=estadoExportacao(info);
  var h='<section class="step mpPanel"><div class="row between" style="align-items:center"><h2>Conferência de NFs de entrada (MAPA) · exportação '+esc(info.num)+'</h2>';
  if(est.tipo==='vazio')return h+'</div><p class="note">Adicione as espécies do pedido acima para conferir se há NF de entrada com saldo.</p></section>';
  if(est.tipo==='protocolado'){
    var pend=aguardaProt(est.proc);
    h+=(pend?'<span class="badge b-w">Consumo gravado · falta protocolar no SEI/MAPA</span>':'<span class="badge b-ok">Consumo gravado · protocolado no MAPA</span>')+'</div>';
    h+='<p class="note" style="margin-top:6px">Pack '+esc(est.proc.pack)+(est.proc.sei?' · SEI '+esc(est.proc.sei):'')+' · o consumo das NFs já foi gravado'+(pend?'; quando protocolar no SEI/MAPA, clique em “Marcar como protocolado”.':(est.proc.dataProt?' · protocolado em '+dt(est.proc.dataProt)+'.':'.'))+'</p>';
    var rows=est.proc.itens.map(function(i){var nf=getNF(S,i.nfId);return '<tr><td>'+nomeHTML(i.esp)+'</td><td>'+(nf?'NF '+esc(nf.numero)+' · '+esc(nf.fornecedor):'NF removida')+'</td><td class="r">'+fmt(i.qtd)+'</td></tr>';}).join('');
    h+='<div style="overflow-x:auto"><table class="mpt"><thead><tr><th>Espécie</th><th>NF usada</th><th class="r">Qtd</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
    if(est.difs.length)h+='<div class="alert w"><b>O pedido mudou depois de protocolar:</b><div class="u"><span>'+est.difs.map(esc).join('</span></div><div class="u"><span>')+'</span></div><div style="margin-top:4px">Se o MAPA já recebeu o processo, confira com ele antes de embarcar.</div></div>';
    h+='<div class="row" style="margin-top:10px">'+(pend?'<button type="button" class="primary" data-mpx="marcarprot">Marcar como protocolado</button>':'')+'<button type="button" data-mpx="grifosproc">Folha de grifos</button><button type="button" data-mpx="pdfproc">PDF das NFs (SEI)</button><button type="button" data-mpx="abrirproc">Ver em Notas de entrada</button></div></section>';
    return h;
  }
  var d=est.d,v=est.v;
  var badge=!S.nfs.length?'<span class="badge b-w">Nenhuma NF cadastrada</span>':(v.erros?'<span class="badge b-e">'+v.erros+' espécie(s) com problema</span>':'<span class="badge b-ok">Todas cobertas — falta gravar o consumo</span>');
  h+=badge+'</div>';
  if(!S.nfs.length)h+='<p class="note">Cadastre as NFs de entrada (ou importe o backup do app antigo) na aba <b>Notas de entrada</b> para conferir este pedido.</p>';
  h+='<div style="overflow-x:auto"><table class="mpt"><thead><tr><th>Espécie</th><th class="r">Pedido</th><th>NFs usadas</th><th class="r">Saldo depois</th><th></th></tr></thead><tbody>';
  d.linhas.forEach(function(L,i){
    var ok=!v.linhas[i].problemas.some(function(p){return p.nivel==='erro';}),av=v.linhas[i].problemas.some(function(p){return p.nivel==='aviso';});
    h+='<tr><td>'+nomeHTML(L.esp)+'</td><td class="r"><b>'+fmt(L.qtd)+'</b></td><td>'+(nfsDaLinha(L)||'<span class="muted">—</span>')+'</td><td class="r">'+(ok?saldoDepoisTxt(L):'—')+'</td><td class="r">'+(ok?(av?'<span class="badge b-w">Aviso</span>':'<span class="badge b-ok">OK</span>'):'<span class="badge b-e">Problema</span>')+'</td></tr>';
  });
  h+='</tbody></table></div>';
  d.linhas.forEach(function(L,i){h+=alertaLinhaTxt(L.esp,v.linhas[i]);});
  h+=pescAvisosHTML(itensDoDraft(d));
  h+='<div class="row" style="margin-top:10px;align-items:flex-end"><div class="field" style="flex:0 1 240px"><label for="mpxSei">Processo SEI (opcional)</label><input type="text" id="mpxSei" value="'+esc(d.sei)+'" placeholder="21010.003135/2026-25"></div>'
    +'<button type="button" class="primary" data-mpx="prot"'+(v.erros||!S.nfs.length?' disabled':'')+'>Gravar consumo</button>'
    +'<button type="button" data-mpx="grifos"'+(!S.nfs.length?' disabled':'')+'>Folha de grifos</button>'
    +'<button type="button" data-mpx="pdf"'+(!S.nfs.length?' disabled':'')+'>PDF das NFs (SEI)</button>'
    +'<button type="button" data-mpx="abrir">Abrir em Notas de entrada</button></div>';
  h+='<p class="note">Nada é descontado das NFs até você clicar em <b>Gravar consumo</b>. Isso não é o protocolo: quando protocolar no SEI/MAPA, marque o pack como protocolado. O nº desta exportação ('+esc(info.num)+') vira o nº do pack.</p></section>';
  return h;
}
function mountPanel(el){ensure();if(el){carregarSePreciso();el.innerHTML=panelHTML();}}
var _carregado=false;
function carregarSePreciso(){if(!_carregado){carregar();_carregado=true;}}
document.addEventListener('click',function(ev){
  var b=ev.target.closest&&ev.target.closest('.mpPanel [data-mpx]');if(!b||b.disabled)return;
  carregar();
  var a=b.dataset.mpx,info=PP.exp.mapaInfo(),est=estadoExportacao(info);
  var panel=document.getElementById('xMapaPanel');
  function refazer(){if(panel)panel.innerHTML=panelHTML();if(PP.assist&&PP.assist.refresh)PP.assist.refresh();}
  if(a==='prot'){
    if(est.tipo!=='pronto'){toast('Resolva os problemas das espécies antes de gravar o consumo.');return;}
    var d=est.d,sei=document.getElementById('mpxSei');if(sei)d.sei=sei.value.trim();
    var r=protocolar(S,d);if(!r.ok){toast(r.erro);return;}
    if(!confirm('Gravar o consumo das NFs para o pack '+r.proc.pack+(r.proc.sei?' (SEI '+r.proc.sei+')':'')+'?\n\nO saldo das NFs cai agora. O protocolo no SEI/MAPA você marca depois, em Processos.')){S.processos=S.processos.filter(function(p){return p.id!==r.proc.id;});return;}
    if(S.draft&&mesmoPack(S.draft.pack,info.num))S.draft=novoDraft();
    salvar();refazer();toast('Consumo gravado para o pack '+r.proc.pack+'. Falta protocolar no SEI/MAPA.');
  }else if(a==='grifos'){
    if(est.tipo!=='pronto'&&est.tipo!=='problema')return;
    ensure();
    abrirModal(grifosHTML('Folha de grifos – Pack '+est.d.pack,folhaGrifos(S,itensDoDraft(est.d),true),est.v.erros?'Atenção: ainda há '+est.v.erros+' espécie(s) com problema neste pedido. Esta folha está incompleta até você resolver.':''));
  }else if(a==='pdf'&&est.d){ensure();pdfUnico(est.d.pack,itensDoDraft(est.d));
  }else if(a==='pdfproc'&&est.tipo==='protocolado'){ensure();pdfUnico(est.proc.pack,est.proc.itens);
  }else if(a==='grifosproc'&&est.tipo==='protocolado'){
    ensure();abrirModal(grifosHTML('Folha de grifos – Pack '+est.proc.pack+(est.proc.sei?' · SEI '+est.proc.sei:''),folhaGrifos(S,est.proc.itens,false)));
  }else if(a==='abrir'&&est.d){
    var sei2=document.getElementById('mpxSei');if(sei2)est.d.sei=sei2.value.trim();
    S.draft=est.d;S.draft.linhas.forEach(function(L){L.edit=false;L.editNome=false;});salvar();tab='verificar';PP.go('mapa');
  }else if(a==='marcarprot'&&est.proc){if(marcarProt(est.proc.id))refazer();
  }else if(a==='abrirproc'){tab='processos';PP.go('mapa');}
});
document.addEventListener('input',function(ev){
  if(ev.target&&ev.target.id==='mpxSei'){carregar();var info=PP.exp.mapaInfo();S.meta.expSei=S.meta.expSei||{};S.meta.expSei[info.num]=ev.target.value;salvar();}
});

/* ====================== PENDÊNCIAS (assistente e Hoje) ====================== */
function pendencias(){
  carregar();
  var X=PP.exp;if(!X||!X.mapaAll)return [];
  var hojeISO=hoje(),out=[];
  X.mapaAll().forEach(function(e){
    if(!e.dep||!e.items.length)return;
    var dia=String(e.dep).slice(0,10),dias=Math.round((Date.parse(dia+'T12:00:00')-Date.parse(hojeISO+'T12:00:00'))/864e5);
    if(dias>4||dias<-2)return;
    var est=estadoExportacao(e);
    if(est.tipo==='protocolado'||est.tipo==='vazio')return;
    out.push({id:e.id||'cur',num:e.num,cliente:e.cliente,dias:dias,dia:dia,sem:est.tipo==='problema',erros:est.v.erros,salva:e.salva});
  });
  out.sort(function(a,b){return a.dias-b.dias;});
  return out;
}

/* ====================== BUSCA ====================== */
function buscaItens(nrm){
  carregar();var out=[],ic=PP.icon('mapa');
  S.nfs.forEach(function(nf){
    out.push({g:'Notas de entrada',ic:ic,t:'NF '+nf.numero+' · '+nf.fornecedor,s:dt(nf.data)+' · '+nf.itens.length+' espécie(s)',q:nrm(['nf',nf.numero,nf.fornecedor].concat(nf.itens.map(function(i){return i.esp;})).join(' ')),go:function(){tab='nfs';filtroNF=nf.numero;PP.go('mapa');}});
  });
  S.processos.forEach(function(p){
    out.push({g:'Notas de entrada',ic:ic,t:'Pack '+p.pack+(p.sei?' · SEI '+p.sei:''),s:(p.destino?p.destino+' · ':'')+dt(p.data)+(p.status==='ativo'?'':' · cancelado'),q:nrm(['pack','processo',p.pack,p.sei,p.destino].join(' ')),go:function(){tab='processos';PP.go('mapa');}});
  });
  return out;
}

/* ====================== MONTAGEM ====================== */
function ensure(){
  var host=document.getElementById('vMapa');
  if(host&&!host.querySelector('#mpView')){
    host.innerHTML='<p class="muted mpintro">Controle de saldo das notas de entrada por espécie — confira o pedido, escolha as NFs, grave o consumo e, quando protocolar no SEI/MAPA, marque o pack como protocolado.</p><nav id="mpTabs" class="mptabs"></nav><div id="mpView"></div>';
  }
  if(!document.getElementById('mpModal')){
    var m=document.createElement('div');m.id='mpModal';m.setAttribute('role','dialog');m.setAttribute('aria-modal','true');document.body.appendChild(m);
    var t=document.createElement('div');t.id='mpTip';t.setAttribute('role','tooltip');document.body.appendChild(t);
  }
}
function renderPublic(reload){
  ensure();
  if(reload||!_carregado){carregar();_carregado=true;}
  if(document.getElementById('mpView'))render();
}
function pdfExportacao(){
  ensure();var X=PP.exp;if(!X||!X.mapaInfo)return;var info=X.mapaInfo(),est=estadoExportacao(info);
  if(est.tipo==='protocolado')pdfUnico(est.proc.pack,est.proc.itens);
  else if(est.d)pdfUnico(est.d.pack,itensDoDraft(est.d));
  else toast('Adicione as espécies do pedido para conferir as NFs.');
}
PP.mapa={
  pdfExportacao:pdfExportacao,ctfAvisos:ctfAvisos,parseValidade:parseValidade,lerValidadePdf:lerValidadePdf,
  abrirPescadores:function(){tab='pesc';PP.go('mapa');},
  render:renderPublic,
  mountPanel:mountPanel,invalidate:function(){_carregado=false;},
  searchItems:buscaItens,
  pendencias:pendencias,
  aProtocolar:function(){carregar();return S.processos.filter(aguardaProt).map(function(p){return {id:p.id,pack:p.pack,destino:p.destino,data:p.data,sei:p.sei};});},
  marcarProtocolado:function(id){carregar();return marcarProt(id);},
  abrirProcessos:function(){tab='processos';PP.go('mapa');},
  estado:function(){carregar();return S;},
  core:{addMarcas:addMarcas,candidatosMarca:candidatosMarca,vincularMarca:vincularMarca,marcaPendente:marcaPendente,vincValidos:vincValidos,lerPdfBuffer:lerPdfBuffer,carregarPdfJs:carregarPdfJs,norm:norm,parseQtd:parseQtd,mesmaEsp:mesmaEsp,nomeSci:nomeSci,saldoNF:saldoNF,entradaNF:entradaNF,resumoNF:resumoNF,painelEspecies:painelEspecies,validarDraft:validarDraft,protocolar:protocolar,sugerir:sugerir,sugerirAjuste:sugerirAjuste,folhaGrifos:folhaGrifos,novoEstado:novoEstado,lerImport:lerImport,conflitosEstado:conflitosEstado,chavePack:chavePack,mesmoPack:mesmoPack,rascunhoDeExportacao:rascunhoDeExportacao,estadoExportacao:estadoExportacao,parseLinhas:parseLinhas,lerPdfBuffer:lerPdfBuffer,agruparLinhas:agruparLinhas,parsePaginaNF:parsePaginaNF,espDeTexto:espDeTexto,itensDoDraft:itensDoDraft,getNF:getNF,generosDe:function(S){return nomesConhecidos(S).map(function(n){return n.split(' ')[0];});}}
};
})();
