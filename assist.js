/* Assistente (cardinal neon): pendências do dia + checklist por embarque. Roda no próprio app, sem internet e sem custo. */
(function () {
  'use strict';
  const PP = window.PP, S = PP.S, store = PP.store, F = PP.Features, esc = PP.esc, $ = PP.$, fmt = PP.fmt;
  const dBR = iso => (iso ? String(iso).split('-').reverse().join('/') : '');
  const dd = (a, b) => Math.round((Date.parse(b + 'T12:00:00') - Date.parse(a + 'T12:00:00')) / 864e5);
  const HOURS4 = 4 * 3600e3;

  /* ---------- o personagem ---------- */
  const DEFS = `<svg width="0" height="0" style="position:absolute" aria-hidden="true" focusable="false"><defs>
<clipPath id="cd-bc"><path d="M30 100C34 88 60 80 100 82C128 84 146 94 152 100C146 108 128 118 100 120C60 122 34 112 30 100Z"/></clipPath>
<linearGradient id="cd-back" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2f3d38"/><stop offset=".45" stop-color="#8fa3a6"/><stop offset="1" stop-color="#cfd9db"/></linearGradient>
<linearGradient id="cd-red" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#ff5a4f"/><stop offset=".55" stop-color="#e0262e"/><stop offset="1" stop-color="#a60f1d"/></linearGradient>
<linearGradient id="cd-neon" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#9ffcff"/><stop offset=".5" stop-color="#2fd0ff"/><stop offset="1" stop-color="#3a6bff"/></linearGradient>
<linearGradient id="cd-fin" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#ff7b72" stop-opacity=".7"/><stop offset="1" stop-color="#ff7b72" stop-opacity=".15"/></linearGradient>
<radialGradient id="cd-eye" cx=".4" cy=".35" r=".8"><stop offset="0" stop-color="#f6fbfc"/><stop offset="1" stop-color="#8fa6ad"/></radialGradient>
<filter id="cd-gl" x="-20%" y="-200%" width="140%" height="500%"><feGaussianBlur stdDeviation="3.2"/></filter>
<symbol id="cardi" viewBox="0 0 200 200">
 <path d="M150 100C160 88 174 76 186 68C182 86 180 94 178 100C180 106 182 114 186 132C174 124 160 112 150 100Z" fill="url(#cd-fin)"/><g stroke="#ffb0a8" stroke-opacity=".5" stroke-width="1" fill="none"><path d="M152 100L184 72M152 100L180 100M152 100L184 128"/></g>
 <path d="M92 82C96 68 108 62 116 68C112 74 110 80 108 84Z" fill="url(#cd-fin)"/><path d="M104 118C108 132 122 138 132 130C126 126 124 122 122 116Z" fill="url(#cd-fin)"/><path d="M126 86C130 80 138 79 142 86Z" fill="#c9d6d8" opacity=".55"/>
 <path d="M72 108C66 118 62 122 56 124C66 124 76 118 82 112Z" fill="#cfe3e8" opacity=".45"/>
 <g clip-path="url(#cd-bc)"><rect x="20" y="76" width="150" height="54" fill="url(#cd-back)"/><rect x="20" y="103" width="150" height="30" fill="url(#cd-red)"/><rect x="20" y="98" width="150" height="8" fill="#ff5a4f" opacity=".45" filter="url(#cd-gl)"/>
  <path d="M42 98C80 91 118 93 152 100" stroke="#2fd0ff" stroke-width="9" fill="none" stroke-linecap="round" filter="url(#cd-gl)" opacity=".9"/><path d="M42 98C80 91 118 93 152 100" stroke="url(#cd-neon)" stroke-width="6.5" fill="none" stroke-linecap="round"/><path d="M46 96.5C82 90 118 91.5 150 98" stroke="#fff" stroke-opacity=".7" stroke-width="1.6" fill="none" stroke-linecap="round"/>
  <path d="M40 84C70 78 112 80 146 92" stroke="#fff" stroke-opacity=".28" stroke-width="3" fill="none" stroke-linecap="round"/><path d="M44 116C80 124 118 118 146 106" stroke="#fff" stroke-opacity=".18" stroke-width="2.5" fill="none"/></g>
 <path d="M30 100C34 88 60 80 100 82C128 84 146 94 152 100C146 108 128 118 100 120C60 122 34 112 30 100Z" fill="none" stroke="#fff" stroke-opacity=".12"/>
 <path d="M64 86C60 96 60 106 64 116" stroke="#0b1316" stroke-opacity=".35" stroke-width="1.6" fill="none"/>
 <circle cx="49" cy="97" r="8.6" fill="url(#cd-eye)"/><circle cx="49" cy="97" r="6" fill="#4fd3e6" opacity=".55"/><circle cx="49.5" cy="97.3" r="4.3" fill="#071114"/><circle cx="51.2" cy="95.4" r="1.5" fill="#fff"/><path d="M31 101q3 2 6 1" stroke="#5a2a2a" stroke-width="1.4" fill="none" stroke-linecap="round"/>
</symbol></defs></svg>`;
  const fish = (cls) => `<svg class="${cls || ''}" viewBox="20 48 176 104" aria-hidden="true"><use href="#cardi" x="0" y="0" width="200" height="200"/></svg>`;
  document.body.insertAdjacentHTML('afterbegin', DEFS);

  /* ---------- dados ---------- */
  const tk = () => { const t = store.get('tarefas', null) || {}; t.emb = t.emb || {}; t.lin = t.lin || {}; return t; };
  const saveTk = t => store.set('tarefas', t);
  const ast = () => Object.assign({ snooze: {}, mute: false }, store.get('assist', null) || {});
  const saveAst = a => store.set('assist', a);
  const fretes = () => store.get('fretes', { cfg: { taxa: 90 }, rec: {} }) || { cfg: { taxa: 90 }, rec: {} };
  const FC = () => PP.frete && PP.frete.FC;
  const prazo = () => S.cfg.prazoPag || 7;
  const lt = (T, e, l) => T.lin[e.id + '|' + l.id] || {};
  const nomes = (arr, n) => arr.slice(0, n || 3).map(l => l.cliente).join(', ') + (arr.length > (n || 3) ? ` e mais ${arr.length - (n || 3)}` : '');

  /* ---------- pendências ---------- */
  function items() {
    const hoje = F.todayISO(), T = tk(), D = fretes(), A = ast(), now = Date.now(), out = [];
    const push = o => { if ((A.snooze[o.key] || 0) > now) return; out.push(o); };
    (S.embarques || []).slice().sort((a, b) => a.saida.localeCompare(b.saida)).forEach(e => {
      const dias = dd(hoje, e.saida), lin = (e.linhas || []).filter(l => l.cliente);
      if (!lin.length || dias > 3 || dias < -21) return;
      const data = dBR(e.saida), rec = l => D.rec[e.id + '|' + l.id] || {};
      if (dias <= 2 && dias >= -1 && !(T.emb[e.id] && T.emb[e.id].reserva)) push({ key: 'res:' + e.id, icon: PP.icon('exp'), kind: 'warn', title: 'A reserva ao despachante já foi solicitada?', sub: `Embarque de ${data} · ${lin.length} cliente(s)`, actions: [{ id: 'ok', label: 'Já solicitei', primary: true }, { id: 'go', label: 'Ver' }, { id: 'later', label: 'Depois' }] });
      if (dias <= 1) { const f = lin.filter(l => !lt(T, e, l).boleto); if (f.length) push({ key: 'bol:' + e.id, icon: PP.icon('dollar'), kind: 'warn', title: f.length === lin.length ? `Os boletos do embarque de ${data} já foram gerados?` : `Faltam ${f.length} boleto(s) do embarque de ${data}`, sub: nomes(f), actions: [{ id: 'ok', label: 'Sim, todos', primary: true }, { id: 'go', label: 'Ver' }, { id: 'later', label: 'Depois' }] }); }
      if (dias <= -1) {
        const c = lin.filter(l => !rec(l).cte && !lt(T, e, l).cte); if (c.length) push({ key: 'cte:' + e.id, icon: PP.icon('clock'), kind: 'warn', title: `CT-e pendente do embarque de ${data}`, sub: nomes(c), actions: [{ id: 'cobrar', label: 'Copiar cobrança', primary: true }, { id: 'frete', label: 'Anexar CTEs' }, { id: 'later', label: 'Depois' }] });
        const av = lin.filter(l => { const r = rec(l); return +r.frete > 0 && r.hora && !r.avisado && !lt(T, e, l).aviso; }); if (av.length) push({ key: 'avi:' + e.id, icon: PP.icon('mail'), kind: 'warn', title: `Aviso de chegada não enviado (${data})`, sub: nomes(av), actions: [{ id: 'ok', label: 'Enviei', primary: true }, { id: 'frete', label: 'Ver Frete' }, { id: 'later', label: 'Depois' }] });
      }
      if (dias <= -1) lin.forEach(l => { const r = rec(l), t = FC() ? FC().totalOf(r, D.cfg) : 0; if (t > 0 && !r.pago) push({ key: 'fr:' + e.id + '|' + l.id, icon: PP.icon('alert'), kind: 'bad', title: l.cliente, sub: `Frete R$ ${fmt(t)} em aberto · embarque de ${data}`, actions: [{ id: 'baixa', label: 'Dar baixa', primary: true }, { id: 'frete', label: 'Ver' }, { id: 'later', label: 'Depois' }] }); });
    });
    if (PP.extra && PP.extra.mortPend) PP.extra.mortPend().forEach(({ em, its }) => push({ key: 'mor:' + em.id, icon: PP.icon('alert'), kind: 'warn', title: `Teve mortalidade no embarque de ${dBR(em.saida)}?`, sub: nomes(its.map(h => ({ cliente: h.cliente.nome })), 4), actions: [{ id: 'go', label: 'Registrar mortalidade', primary: true }, { id: 'ok', label: 'Nenhum teve' }] }));
    (S.hist || []).filter(F.active).forEach(e => { const s = F.situacao(e, hoje, prazo()); if (s.key === 'atrasado' && s.saldo > 0) push({ key: 'ped:' + e.id, icon: PP.icon('alert'), kind: 'bad', title: `Pedido de ${e.cliente.nome} atrasado`, sub: `R$ ${fmt(s.saldo)} · ${s.dias} dias desde ${dBR(e.dataISO)}`, actions: [{ id: 'go', label: 'Ver', primary: true }, { id: 'later', label: 'Depois' }] }); });
    const last = store.get('lastBackup', 0), has = (S.hist || []).length || (S.clientes || []).length;
    if (has && Date.now() - last > 7 * 864e5) push({ key: 'bk', icon: PP.icon('cloud'), kind: 'warn', title: 'Backup do app', sub: last ? `Último há ${Math.floor((Date.now() - last) / 864e5)} dias` : 'Você ainda não baixou nenhum backup', actions: [{ id: 'bk', label: 'Baixar agora', primary: true }, { id: 'later', label: 'Depois' }] });
    if (PP.kanban) PP.kanban.dueTasks().forEach(t => { const atr = t.prazo < hoje; push({ key: 'kb:' + t.id, icon: PP.icon('tarefas'), kind: atr ? 'bad' : 'warn', title: (atr ? 'Tarefa atrasada: ' : 'Tarefa para hoje: ') + t.titulo, sub: `${t.cat || ''} · ${PP.kanban.dueInfo(t).txt}`, actions: [{ id: 'ok', label: 'Feita', primary: true }, { id: 'go', label: 'Ver' }, { id: 'later', label: 'Depois' }] }); });
    if (PP.mapa) PP.mapa.pendencias().forEach(p => { const q = p.dias < 0 ? `saiu há ${-p.dias} dia(s)` : p.dias === 0 ? 'sai hoje' : p.dias === 1 ? 'sai amanhã' : `sai em ${p.dias} dias`; push({ key: 'mp:' + p.id, icon: PP.icon('mapa'), kind: p.sem || p.dias <= 1 ? 'bad' : 'warn', title: p.sem ? `Exportação ${p.num}: faltam NFs com saldo` : `Exportação ${p.num}: consumo das NFs ainda não gravado`, sub: `${p.cliente || 'Exportação'} · ${q} · ${p.sem ? p.erros + ' espécie(s) com problema' : 'confira e grave o consumo das NFs'}`, actions: [{ id: 'go', label: 'Ver', primary: true }, { id: 'later', label: 'Depois' }] }); });
    if (PP.mapa && PP.mapa.aProtocolar) PP.mapa.aProtocolar().forEach(p => push({ key: 'mpp:' + p.id, icon: PP.icon('mapa'), kind: 'warn', title: `Pack ${p.pack}: consumo gravado, falta protocolar no SEI/MAPA`, sub: `${p.destino ? p.destino + ' · ' : ''}${p.sei ? 'SEI ' + p.sei + ' · ' : ''}marque quando protocolar`, actions: [{ id: 'ok', label: 'Já protocolei', primary: true }, { id: 'go', label: 'Ver' }, { id: 'later', label: 'Depois' }] }));
    if (PP.mapa && PP.mapa.ctfAvisos) PP.mapa.ctfAvisos().forEach(c => push({ key: 'ct:' + c.id, icon: PP.icon('mapa'), kind: c.venc ? 'bad' : 'warn', title: c.venc ? `CTF vencido: ${c.nome}` : `CTF vencendo: ${c.nome}`, sub: c.venc ? `venceu há ${-c.dias} dia(s)` : `vence em ${c.dias} dia(s)`, actions: [{ id: 'go', label: 'Ver pescadores', primary: true }, { id: 'later', label: 'Depois' }] }));
    const pr = { res: 0, bol: 1, cte: 2, avi: 3, fr: 4, kb: 4.5, ped: 5, mp: 5.5, mpp: 5.6, ct: 5.7, bk: 6 };
    return out.sort((a, b) => pr[a.key.split(':')[0]] - pr[b.key.split(':')[0]]);
  }
  function openCount(what) {
    if (what !== 'frete') return 0; const D = fretes(), hoje = F.todayISO(); let n = 0;
    (S.embarques || []).forEach(e => { if (dd(hoje, e.saida) > -1) return; (e.linhas || []).forEach(l => { const r = D.rec[e.id + '|' + l.id] || {}, t = FC() ? FC().totalOf(r, D.cfg) : 0; if (t > 0 && !r.pago) n++; }); });
    return n;
  }

  /* ---------- ações ---------- */
  const rerender = () => { if (S.view === 'hoje') PP.hoje.render(); else if (S.view === 'embarque') PP.extra.render('embarque'); else if (S.view === 'frete') PP.frete.render(); else if (S.view === 'tarefas') PP.kanban.render(); refresh(); };
  function gotoEmb(id) { PP.extra.ST.emb.sel = id; PP.go('embarque'); setTimeout(() => { const el = $('tkSec'); if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 60); }
  function gotoFrete(id) { PP.go('frete'); const s = $('frEmb'); if (s && id) { s.value = id; s.dispatchEvent(new Event('change', { bubbles: true })); } }
  async function copyTxt(t) { try { await navigator.clipboard.writeText(t); return true; } catch (_) { return false; } }
  async function act(key, id) {
    const [kind, rest] = [key.split(':')[0], key.slice(key.indexOf(':') + 1)], T = tk(), A = ast();
    if (id === 'later') { A.snooze[key] = Date.now() + HOURS4; saveAst(A); PP.toast('Combinado, te lembro mais tarde.'); return rerender(); }
    if (kind === 'res') { if (id === 'ok') { T.emb[rest] = Object.assign(T.emb[rest] || {}, { reserva: Date.now() }); saveTk(T); PP.toast('Reserva marcada como solicitada ✓', 'ok'); return rerender(); } if (id === 'go') return gotoEmb(rest); }
    if (kind === 'bol') { const e = S.embarques.find(x => x.id === rest); if (id === 'ok' && e) { (e.linhas || []).forEach(l => { if (l.cliente) T.lin[e.id + '|' + l.id] = Object.assign(T.lin[e.id + '|' + l.id] || {}, { boleto: Date.now() }); }); saveTk(T); PP.toast('Boletos marcados como gerados ✓', 'ok'); return rerender(); } if (id === 'go') return gotoEmb(rest); }
    if (kind === 'cte') { const e = S.embarques.find(x => x.id === rest); if (id === 'frete') return gotoFrete(rest); if (id === 'cobrar' && e) { const D = fretes(), f = (e.linhas || []).filter(l => l.cliente && !(D.rec[e.id + '|' + l.id] || {}).cte && !lt(T, e, l).cte); const ok = await copyTxt(`Bom dia! Poderia enviar os CT-e do embarque de ${dBR(e.saida)}? Faltam:\n` + f.map(l => `- ${l.cliente}${l.awb ? ' (AWB ' + l.awb + ')' : ''}`).join('\n') + '\nObrigado!'); PP.toast(ok ? 'Mensagem de cobrança copiada ✓' : 'Não consegui copiar automaticamente.', ok ? 'ok' : 'bad'); A.snooze[key] = Date.now() + HOURS4; saveAst(A); return rerender(); } }
    if (kind === 'avi') { const e = S.embarques.find(x => x.id === rest); if (id === 'frete') return gotoFrete(rest); if (id === 'ok' && e) { (e.linhas || []).forEach(l => { if (l.cliente) T.lin[e.id + '|' + l.id] = Object.assign(T.lin[e.id + '|' + l.id] || {}, { aviso: Date.now() }); }); saveTk(T); PP.toast('Avisos marcados como enviados ✓', 'ok'); return rerender(); } }
    if (kind === 'fr') { const [eid, lid] = rest.split('|'); if (id === 'frete') return gotoFrete(eid); if (id === 'baixa') { const D = fretes(), k = eid + '|' + lid; D.rec[k] = Object.assign(D.rec[k] || {}, { pago: true, pagoEm: F.todayISO() }); store.set('fretes', D); if (PP.frete) PP.frete.reload(); PP.toast('Frete baixado como pago ✓', 'ok'); return rerender(); } }
    if (kind === 'mor') { if (id === 'go') { PP.go('hist'); const el = $('hMort'); if (el) el.scrollIntoView({ block: 'start', behavior: 'smooth' }); return; } if (id === 'ok') { const em = (S.embarques || []).find(x => x.id === rest); if (em) { (em.linhas || []).forEach(l => { const h = S.hist.find(z => z.id === l.pedidoId); if (h && !h.mort) { h.mortOk = Date.now(); h.upd = Date.now(); } }); PP.saveHist(); PP.toast('Ok, sem mortalidade nesse embarque ✓', 'ok'); return rerender(); } } }
    if (kind === 'ped' && id === 'go') { const X = PP.extra.ST; X.hist.q = ''; X.hist.st = ''; X.hist.open = rest; PP.go('hist'); const el = $('hdet'); if (el) el.scrollIntoView({ block: 'start' }); return; }
    if (kind === 'mp') { if (id === 'go') { const x = PP.mapa.pendencias().find(z => z.id === rest); if (x && x.salva && PP.exp.openEntry) { PP.exp.openEntry(rest); return; } PP.go('exp'); return; } }
    if (kind === 'mpp') { if (id === 'go') { PP.mapa.abrirProcessos(); return; } if (id === 'ok') { PP.mapa.marcarProtocolado(rest); return rerender(); } }
    if (kind === 'ct' && id === 'go') { PP.mapa.abrirPescadores(); return; }
    if (kind === 'kb') { if (id === 'ok') { PP.kanban.complete(rest); return rerender(); } if (id === 'go') { PP.kanban.ST.flash = rest; PP.go('tarefas'); return; } }
    if (kind === 'bk' && id === 'bk') { $('bkExport').click(); PP.toast('Backup baixado ✓', 'ok'); return setTimeout(rerender, 200); }
  }
  document.addEventListener('click', e => { const b = e.target.closest('[data-as]'); if (!b) return; const key = b.dataset.as.slice(0, b.dataset.as.lastIndexOf('|')), id = b.dataset.as.slice(b.dataset.as.lastIndexOf('|') + 1); act(key, id); });

  /* ---------- widget ---------- */
  const w = $('assist') || (() => { const d = document.createElement('div'); d.id = 'assist'; d.className = 'assist'; d.innerHTML = `<button type="button" class="afish" id="asFish" aria-label="Abrir o assistente" aria-expanded="false" title="Assistente">${fish('')}<span class="abadge" id="asBadge"></span></button><div class="atx"><b>Assistente</b><small id="asSub">Tudo em dia</small></div><button type="button" class="amute" id="asMute" title="Silenciar o assistente" aria-label="Silenciar o assistente">🔔</button><div class="abub" id="asBub" hidden role="dialog" aria-label="Assistente"></div>`; return d; })();
  let idx = 0, bubOpen = false;
  function place() { const mob = window.matchMedia('(max-width:900px)').matches; if (mob) { w.classList.add('floating'); if (w.parentNode !== document.body) document.body.appendChild(w); } else { w.classList.remove('floating'); const slot = $('assistSlot'); if (slot && w.parentNode !== slot) slot.appendChild(w); } }
  function drawBub() {
    const L = items(), b = $('asBub'); if (!bubOpen) { b.hidden = true; return; } b.hidden = false; if (idx >= L.length) idx = Math.max(0, L.length - 1);
    if (!L.length) { b.innerHTML = '<div class="q">Tudo em dia ✓</div><div class="sb">Nada pendente agora. Se precisar, é só clicar em mim.</div>'; return; }
    const a = L[idx];
    b.innerHTML = `<div class="q">${esc(a.title)}</div><div class="sb">${esc(a.sub || '')}</div><div class="ac">${a.actions.map(x => `<button type="button" class="${x.primary ? 'primary' : ''}" data-as="${esc(a.key)}|${x.id}">${esc(x.label)}</button>`).join('')}</div><div class="nv"><span>${idx + 1} de ${L.length}</span><span><button type="button" data-an="-1" aria-label="Anterior">‹</button><button type="button" data-an="1" aria-label="Próxima">›</button></span></div>`;
  }
  function refresh() {
    const on = store.get('asOn', true) !== false; w.style.display = on ? '' : 'none';
    const A = ast(), L = items(), n = L.length;
    w.classList.toggle('mute', !!A.mute); w.classList.toggle('pend', n > 0 && !A.mute);
    $('asBadge').textContent = n && !A.mute ? String(n) : ''; $('asSub').textContent = A.mute ? 'Silenciado' : n ? `${n} pendência${n > 1 ? 's' : ''}` : 'Tudo em dia';
    $('asMute').textContent = A.mute ? '🔕' : '🔔'; $('asMute').title = A.mute ? 'Ativar o assistente' : 'Silenciar o assistente';
    const f = document.querySelector('#nav [data-view="frete"]'); if (f) { let bd = f.querySelector('.bdg'); const c = openCount('frete'); if (c) { if (!bd) { bd = document.createElement('b'); bd.className = 'bdg'; f.appendChild(bd); } bd.textContent = c; } else if (bd) bd.remove(); }
    drawBub();
  }
  w.addEventListener('click', e => {
    if (e.target.closest('#asFish')) { bubOpen = !bubOpen; $('asFish').setAttribute('aria-expanded', String(bubOpen)); drawBub(); return; }
    if (e.target.closest('#asMute')) { const A = ast(); A.mute = !A.mute; saveAst(A); if (A.mute) bubOpen = false; PP.toast(A.mute ? 'Assistente silenciado.' : 'Assistente ativado.'); refresh(); return; }
    const nv = e.target.closest('[data-an]'); if (nv) { const L = items(); idx = (idx + (+nv.dataset.an) + L.length) % Math.max(1, L.length); drawBub(); }
  });
  document.addEventListener('click', e => { if (bubOpen && !w.contains(e.target) && !e.target.closest('[data-as]')) { bubOpen = false; $('asFish').setAttribute('aria-expanded', 'false'); drawBub(); } });
  window.matchMedia('(max-width:900px)').addEventListener('change', place);
  place(); refresh();
  if (store.get('asAuto', true) !== false && !ast().mute && items().length && !sessionStorage.getItem('pp.asShown')) { try { sessionStorage.setItem('pp.asShown', '1'); } catch (_) { /* ok */ } setTimeout(() => { bubOpen = true; $('asFish').setAttribute('aria-expanded', 'true'); drawBub(); }, 1400); }

  /* ---------- checklist na Programação de voos ---------- */
  function embHTML(e) {
    const T = tk(), D = fretes(), lin = (e.linhas || []).filter(l => l.cliente), hoje = F.todayISO(), dias = dd(hoje, e.saida);
    const res = T.emb[e.id] && T.emb[e.id].reserva;
    const cell = (ok, label, attrs, late) => `<button type="button" class="tkb ${ok ? 'on' : ''} ${late && !ok ? 'late' : ''}" ${attrs} aria-pressed="${!!ok}">${ok ? '✓ ' : ''}${label}</button>`;
    const rows = lin.map(l => {
      const t = lt(T, e, l), r = D.rec[e.id + '|' + l.id] || {}, tot = FC() ? FC().totalOf(r, D.cfg) : 0, k = e.id + '|' + l.id;
      const cte = !!r.cte || !!t.cte, av = !!r.avisado || !!t.aviso;
      return `<div class="tkr"><b>${esc(l.cliente)}</b>
        ${cell(!!t.boleto, 'Boleto', `data-tk="boleto|${k}"`, dias <= 0)}
        ${r.cte ? '<span class="tkb on auto" title="Lido do CT-e na aba Frete">✓ CT-e</span>' : cell(cte, 'CT-e', `data-tk="cte|${k}"`, dias <= -1)}
        ${r.avisado ? '<span class="tkb on auto" title="Mensagem copiada na aba Frete">✓ Aviso</span>' : cell(av, 'Aviso', `data-tk="aviso|${k}"`, false)}
        ${tot > 0 ? (r.pago ? '<span class="tkb on auto">✓ Pago</span>' : `<span class="tkb ${dias <= -1 ? 'late' : ''} auto">R$ ${fmt(tot)}</span>`) : '<span class="tkb auto">frete —</span>'}</div>`;
    }).join('');
    return `<section class="step" id="tkSec"><div class="row between"><h2>Etapas do embarque</h2><span class="note">O assistente usa estas marcas para te lembrar do que falta. CT-e, aviso e frete se preenchem sozinhos pela aba Frete.</span></div>
      <div class="row" style="align-items:center;gap:10px"><b>Reserva ao despachante</b>${cell(!!res, 'Solicitada', `data-tk="reserva|${e.id}"`, dias <= 2)}</div>
      ${lin.length ? `<div class="tkg"><div class="tkr h"><span>Cliente</span><span>Boleto</span><span>CT-e</span><span>Aviso</span><span>Frete</span></div>${rows}</div>` : '<p class="empty">Adicione clientes ao embarque para ver as etapas.</p>'}</section>`;
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('[data-tk]'); if (!b) return; const [what, a, c] = b.dataset.tk.split('|'), T = tk();
    if (what === 'reserva') { const o = T.emb[a] = T.emb[a] || {}; o.reserva = o.reserva ? 0 : Date.now(); } else { const k = a + '|' + c, o = T.lin[k] = T.lin[k] || {}; o[what] = o[what] ? 0 : Date.now(); }
    saveTk(T); if (S.view === 'embarque') PP.extra.render('embarque'); refresh();
  });
  PP.assist = { items, refresh, embHTML, openCount, fish, act };
})();
