/* Prestige Pedidos — cópias automáticas (últimos 7 dias), guardadas neste aparelho (IndexedDB, comprimidas).
   Uma cópia por dia, feita na PRIMEIRA vez que o app abre no dia: ela guarda como tudo estava ANTES do
   trabalho daquele dia. Serve para desfazer um estrago sem depender de você ter baixado o backup. */
(function () {
  'use strict';
  const PP = window.PP, $ = PP.$, esc = PP.esc, F = PP.Features;
  const DIAS = 7, MAX_ANTES = 3;
  const ST = { lista: [], msg: '', erro: '' };

  /* ---------- armazenamento ---------- */
  function idb() { return new Promise((res, rej) => { const r = indexedDB.open('pp-bk', 1); r.onupgradeneeded = () => r.result.createObjectStore('b'); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); }); }
  async function op(mode, fn) { const db = await idb(); return new Promise((res, rej) => { const t = db.transaction('b', mode), rq = fn(t.objectStore('b')); t.oncomplete = () => res(rq && rq.result); t.onerror = () => rej(t.error); t.onabort = () => rej(t.error); }); }
  const get = k => op('readonly', s => s.get(k));
  const put = (k, v) => op('readwrite', s => s.put(v, k));
  const del = k => op('readwrite', s => s.delete(k));
  const keys = () => op('readonly', s => s.getAllKeys());
  const todos = () => op('readonly', s => s.getAll());

  /* ---------- compressão (cabe muito mais cópia no mesmo espaço) ---------- */
  async function comprimir(obj) {
    const s = JSON.stringify(obj);
    if (!window.CompressionStream) return { z: 0, d: s, tam: s.length };
    try {
      const ab = await new Response(new Blob([s]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
      return { z: 1, d: new Uint8Array(ab), tam: ab.byteLength };
    } catch (_) { return { z: 0, d: s, tam: s.length }; }
  }
  async function abrir(v) {
    if (!v.z) return JSON.parse(v.d);
    const ab = await new Response(new Blob([v.d]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
    return JSON.parse(new TextDecoder().decode(ab));
  }

  /* ---------- criar e limpar ---------- */
  const resumo = d => ({ pedidos: (d.hist || []).length, clientes: (d.clientes || []).length, embarques: (d.embarques || []).length, nfs: ((d.mapa || {}).nfs || []).length, exp: (d.exphist || []).length });
  const temAlgo = d => d && ((d.hist || []).length || (d.clientes || []).length || (d.embarques || []).length || ((d.mapa || {}).nfs || []).length);

  async function criar(tipo) {
    const d = PP.snapshot();
    if (!temAlgo(d)) return null;                       // app ainda vazio: não adianta guardar
    const v = await comprimir(d);
    v.ts = Date.now(); v.info = resumo(d); v.tipo = tipo || 'dia';
    const k = tipo === 'antes' ? 'antes-' + v.ts : F.todayISO();
    await put(k, v); await limpar();
    return k;
  }
  async function limpar() {
    const ks = (await keys()).map(String);
    const dias = ks.filter(k => /^\d{4}-\d{2}-\d{2}$/.test(k)).sort();
    const antes = ks.filter(k => k.startsWith('antes-')).sort();
    for (const k of dias.slice(0, Math.max(0, dias.length - DIAS))) await del(k);
    for (const k of antes.slice(0, Math.max(0, antes.length - MAX_ANTES))) await del(k);
  }

  /* ---------- tela (Configurações > Dados e nuvem) ---------- */
  const kb = n => (n >= 1048576 ? (n / 1048576).toFixed(1).replace('.', ',') + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB');
  const DIASEM = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
  function quando(k, ts) {
    if (String(k).startsWith('antes-')) return 'Antes de você voltar no tempo · ' + new Date(ts).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    const hoje = F.todayISO(), n = F.daysBetween(k, hoje), [y, m, d] = String(k).split('-').map(Number);
    const dia = DIASEM[new Date(y, m - 1, d).getDay()], dt = String(k).slice(8) + '/' + String(k).slice(5, 7);
    return (n === 0 ? 'Hoje' : n === 1 ? 'Ontem' : dia.charAt(0).toUpperCase() + dia.slice(1)) + ' · ' + dt + (n === 0 ? ' (como estava quando você abriu o app hoje)' : '');
  }
  async function carregar() {
    try {
      const ks = (await keys()).map(String), vs = await todos();
      const L = ks.map((k, i) => ({ k, v: vs[i] })).filter(x => x.v && x.v.ts), dia = x => !String(x.k).startsWith('antes-');
      // as cópias dos dias primeiro (da mais nova para a mais velha); as de "antes de voltar" ficam no fim
      ST.lista = L.filter(dia).sort((a, b) => String(b.k).localeCompare(String(a.k))).concat(L.filter(x => !dia(x)).sort((a, b) => b.v.ts - a.v.ts));
      ST.erro = '';
    } catch (e) { ST.lista = []; ST.erro = 'Não consegui ler as cópias neste navegador.'; }
    render();
  }
  let render = function () {
    const el = $('bkAuto'); if (!el) return;
    if (ST.erro) { el.innerHTML = `<p class="note">${esc(ST.erro)}</p>`; return; }
    if (!ST.lista.length) { el.innerHTML = '<p class="note">Ainda não há nenhuma cópia. A primeira é feita sozinha assim que você usar o app.</p>'; return; }
    el.innerHTML = `<div class="tablewrap"><table><thead><tr><th>Cópia de</th><th class="n">Pedidos</th><th class="n">Clientes</th><th class="n">NFs</th><th class="n">Tamanho</th><th></th></tr></thead><tbody>
      ${ST.lista.map(x => `<tr><td><b>${esc(quando(x.k, x.v.ts))}</b></td><td class="n">${(x.v.info || {}).pedidos || 0}</td><td class="n">${(x.v.info || {}).clientes || 0}</td><td class="n">${(x.v.info || {}).nfs || 0}</td><td class="n">${kb(x.v.tam || 0)}</td>
        <td style="white-space:nowrap"><button type="button" class="primary" data-bka="voltar" data-k="${esc(x.k)}">Voltar para esta cópia</button> <button type="button" data-bka="baixar" data-k="${esc(x.k)}">Baixar</button></td></tr>`).join('')}
      </tbody></table></div>${ST.msg ? `<div class="alert ok" style="margin-top:10px">${esc(ST.msg)}</div>` : ''}`;
  }

  async function voltar(k) {
    const x = ST.lista.find(y => y.k === k); if (!x) return;
    const info = x.v.info || {};
    if (!confirm(`Voltar os dados para a cópia de ${quando(k, x.v.ts)}?\n\nDepois de voltar, o app fica com ${info.pedidos || 0} pedido(s) e ${info.clientes || 0} cliente(s), como estava naquele momento. Tudo o que foi feito depois disso sai.\n\nAntes de trocar, o app guarda uma cópia de AGORA, então dá para voltar atrás.`)) return;
    try {
      await criar('antes');
      PP.aplicarBackup(await abrir(x.v));
      ST.msg = `Pronto: os dados voltaram para a cópia de ${quando(k, x.v.ts)}. Se foi engano, use a cópia "Antes de você voltar no tempo" lá em cima.`;
      await carregar();
      PP.toast('Dados restaurados.', 'ok');
    } catch (e) { PP.toast('Não consegui restaurar: ' + ((e && e.message) || e), 'bad'); }
  }
  async function baixar(k) {
    const x = ST.lista.find(y => y.k === k); if (!x) return;
    try { PP.saveBlob(`prestige-pedidos-copia-${String(k).replace(/[^\w-]/g, '')}.json`, new Blob([JSON.stringify(await abrir(x.v))], { type: 'application/json' })); }
    catch (e) { PP.toast('Não consegui baixar esta cópia.', 'bad'); }
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('[data-bka]'); if (!b || !$('bkAuto') || !$('bkAuto').contains(b)) return;
    ev.preventDefault(); if (b.dataset.bka === 'voltar') voltar(b.dataset.k); else baixar(b.dataset.k);
  });

  /* ---------- a cópia do dia, logo depois que o app abre ---------- */
  async function tick() {
    try { if (!(await get(F.todayISO()))) await criar('dia'); } catch (_) { /* sem espaço ou sem IndexedDB: segue a vida */ }
    await carregar(); try { PP.renderBanners(); } catch (_) { /* ok */ }
  }
  const agenda = () => (window.requestIdleCallback ? requestIdleCallback(tick, { timeout: 8000 }) : setTimeout(tick, 4000));
  if (document.readyState === 'complete') agenda(); else window.addEventListener('load', agenda);
  // app aberto o dia inteiro (ou virando a noite): confere de hora em hora se já existe a cópia do dia
  setInterval(() => { if (!document.hidden) tick(); }, 36e5);
  document.addEventListener('visibilitychange', () => { if (!document.hidden) tick(); });

  /* ---------- v29.12: backup em arquivo com um clique (pasta escolhida uma vez, ex.: Google Drive/OneDrive) ---------- */
  const store = PP.store;
  const suportaPasta = () => typeof window.showDirectoryPicker === 'function';
  const temHoje = () => ST.lista.some(x => x.k === F.todayISO());
  async function pastaAtual() { try { return (await get('dir')) || null; } catch (_) { return null; } }
  async function escolherPasta() {
    if (!suportaPasta()) { PP.toast('Este navegador não deixa escolher pasta. O backup será baixado normalmente.'); return null; }
    try {
      const h = await window.showDirectoryPicker({ id: 'pp-backup', mode: 'readwrite' });
      await put('dir', h); store.set('bkPastaNome', h.name); await telaPasta(); PP.toast('Pasta escolhida: ' + h.name, 'ok'); return h;
    } catch (e) { if (!e || e.name !== 'AbortError') PP.toast('Não consegui usar essa pasta. Escolha outra.'); return null; }
  }
  async function esquecerPasta() { try { await del('dir'); } catch (_) { /* ok */ } store.set('bkPastaNome', ''); await telaPasta(); }
  async function gravarNaPasta(h) {
    let p = await h.queryPermission({ mode: 'readwrite' });
    if (p !== 'granted') p = await h.requestPermission({ mode: 'readwrite' });
    if (p !== 'granted') { const e = new Error('sem permissão'); e.name = 'Permissao'; throw e; }
    const nome = `prestige-pedidos-backup-${F.todayISO()}.json`, fh = await h.getFileHandle(nome, { create: true }), w = await fh.createWritable();
    await w.write(JSON.stringify(PP.snapshot())); await w.close(); return nome;
  }
  /* um clique: grava na pasta escolhida; sem pasta (ou se falhar), baixa o arquivo como sempre */
  async function backupAgora() {
    const h = await pastaAtual();
    if (h) {
      try {
        const nome = await gravarNaPasta(h);
        store.set('lastBackup', Date.now()); store.set('lastBackupOnde', 'pasta'); PP.bkLabel(); PP.renderBanners(); telaPasta();
        PP.toast(`Backup salvo na pasta "${h.name}" (${nome}).`, 'ok'); return { ok: true, onde: 'pasta', nome };
      } catch (e) {
        PP.toast(e && e.name === 'Permissao' ? 'Sem permissão para a pasta. O backup foi baixado; escolha a pasta de novo.' : 'Não consegui gravar na pasta. O backup foi baixado.');
      }
    }
    document.getElementById('bkExport').click(); store.set('lastBackupOnde', 'download'); telaPasta();
    return { ok: true, onde: 'download' };
  }
  async function telaPasta() {
    const el = $('bkPasta'); if (!el) return;
    const h = await pastaAtual(), l = store.get('lastBackup', 0);
    const onde = store.get('lastBackupOnde', ''), ult = l ? `Último backup em arquivo: ${new Date(l).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}${onde === 'pasta' ? ' (na pasta)' : onde === 'download' ? ' (baixado)' : ''}.` : 'Nenhum backup em arquivo ainda.';
    const auto = temHoje() ? 'A cópia automática de hoje já existe, mas ela fica só neste navegador.' : 'A cópia automática de hoje ainda não foi feita.';
    if (!suportaPasta()) { el.innerHTML = `<div class="row"><button type="button" class="primary" id="bkAgora">Fazer backup agora</button></div><p class="note">${esc(ult)} ${esc(auto)} Este navegador só baixa o arquivo. No Chrome ou Edge do computador dá para salvar direto numa pasta.</p>`; return; }
    el.innerHTML = `<div class="row"><button type="button" class="primary" id="bkAgora">Fazer backup agora</button>${h ? '<button type="button" id="bkTroca">Trocar pasta</button><button type="button" id="bkSem">Parar de usar a pasta</button>' : '<button type="button" id="bkEscolhe">Escolher pasta de backup</button>'}</div>
      <p class="note">${h ? `Pasta de backup: <b>${esc(h.name)}</b>. O botão grava o arquivo ali, sem janela de download.` : 'Escolha uma pasta uma vez (de preferência dentro do Google Drive ou OneDrive). Depois, um clique grava o arquivo lá.'} ${esc(ult)} ${esc(auto)}</p>`;
  }
  document.addEventListener('click', ev => {
    const b = ev.target.closest('#bkPasta button'); if (!b) return;
    if (b.id === 'bkAgora') backupAgora(); else if (b.id === 'bkEscolhe' || b.id === 'bkTroca') escolherPasta(); else if (b.id === 'bkSem') esquecerPasta();
  });
  const _render = render; render = function () { _render(); telaPasta(); }; // eslint-disable-line no-func-assign
  setTimeout(telaPasta, 1500);

  PP.autobk = { criar, carregar, lista: () => ST.lista, voltar, abrir, get, backupAgora, escolherPasta, esquecerPasta, temHoje, suportaPasta, telaPasta };
})();
