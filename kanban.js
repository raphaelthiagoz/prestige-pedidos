/* Tarefas (kanban do aquário): A fazer · Em andamento · Aguardando · Feito. Dados em store 'kanban' (vai no backup e na nuvem). */
(function () {
  'use strict';
  const PP = window.PP, store = PP.store, $ = PP.$, esc = PP.esc, F = PP.Features;
  const COLS = [['todo', 'A fazer'], ['doing', 'Em andamento'], ['wait', 'Aguardando'], ['done', 'Feito']];
  const CATS = ['Pedidos', 'Exportação', 'Frete', 'Financeiro', 'Compras'];
  const PRIO = { a: 'Alta', m: 'Média', b: 'Baixa' };
  const REC = { '': 'Não repetir', d: 'Todo dia', s: 'Toda semana', m: 'Todo mês' };
  const ST = { cat: '', col: 'todo', allDone: false, modal: null, flash: '' };
  const uid = () => 'k' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const dBRy = iso => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : ''; };
  const dBR = iso => { const p = String(iso || '').split('-'); return p.length === 3 ? p[2] + '/' + p[1] : ''; };
  const dd = (a, b) => Math.round((Date.parse(b + 'T12:00:00Z') - Date.parse(a + 'T12:00:00Z')) / 864e5);

  function load() { const d = store.get('kanban', null); return d && Array.isArray(d.tasks) ? d : { tasks: [] }; }
  function save(d) { store.set('kanban', d); }

  /* próxima data de uma tarefa que se repete: sempre uma data futura (depois de hoje) */
  function nextDue(t) {
    const hoje = F.todayISO(); let cur = t.prazo || hoje, guard = 0;
    const step = iso => { if (t.rec === 'd') return F.addDays(iso, 1); if (t.rec === 's') return F.addDays(iso, 7); const [y, m, d] = iso.split('-').map(Number), dt = new Date(Date.UTC(y, m, 1)); const last = new Date(Date.UTC(y, m + 1, 0)).getUTCDate(); dt.setUTCDate(Math.min(d, last)); return dt.toISOString().slice(0, 10); };
    do { cur = step(cur); guard++; } while (cur <= hoje && guard < 800);
    return cur;
  }

  function moveTo(id, status) {
    const d = load(), t = d.tasks.find(x => x.id === id); if (!t || t.status === status) return false;
    t.status = status;
    if (status === 'done') {
      t.doneAt = Date.now();
      if (t.rec && !t.spawned) { t.spawned = true; d.tasks.push({ id: uid(), titulo: t.titulo, cat: t.cat, prio: t.prio, prazo: nextDue(t), status: 'todo', obs: t.obs || '', rec: t.rec, ts: Date.now() }); PP.toast && PP.toast('Feita ✓ A próxima já está em A fazer (' + dBR(d.tasks[d.tasks.length - 1].prazo) + ').', 'ok'); }
      else PP.toast && PP.toast('Tarefa concluída ✓', 'ok');
    } else { t.doneAt = null; }
    save(d); return true;
  }
  const complete = id => { const r = moveTo(id, 'done'); refreshAll(); return r; };

  function dueInfo(t) {
    if (!t.prazo) return { txt: 'sem prazo', cls: '' };
    const n = dd(F.todayISO(), t.prazo);
    if (t.status === 'done') return { txt: dBR(t.prazo), cls: '' };
    if (n < 0) return { txt: 'venceu há ' + (-n) + (n === -1 ? ' dia' : ' dias') + ' · ' + dBRy(t.prazo), cls: 'late' };
    if (n === 0) return { txt: 'hoje', cls: 'today' };
    if (n === 1) return { txt: 'amanhã', cls: '' };
    const wd = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(t.prazo + 'T12:00:00').getDay()];
    return { txt: (n < 7 ? wd + ' ' : '') + dBR(t.prazo), cls: '' };
  }
  const prioRank = { a: 0, m: 1, b: 2 };
  const sortTasks = list => list.slice().sort((a, b) => (a.prazo || '9999').localeCompare(b.prazo || '9999') || (prioRank[a.prio] - prioRank[b.prio]) || (a.ts || 0) - (b.ts || 0));

  function cardHTML(t, ci) {
    const di = dueInfo(t);
    return `<div class="kc ${t.status === 'done' ? 'done' : ''} ${ST.flash === t.id ? 'flash' : ''}" draggable="true" data-kid="${t.id}" tabindex="0">
      <div class="t">${esc(t.titulo)}</div>
      <div class="m"><span class="pr ${t.prio || 'm'}" title="Prioridade ${PRIO[t.prio] || ''}"></span><span class="tag cat">${esc(t.cat || '—')}</span><span class="tag ${di.cls}">${di.txt}</span>${t.rec ? `<span class="tag" title="${REC[t.rec]}">↻</span>` : ''}</div>
      ${t.obs ? `<div class="o">${esc(t.obs).slice(0, 90)}${t.obs.length > 90 ? '…' : ''}</div>` : ''}
      <div class="mv"><button type="button" data-kmv="${t.id}|-1" aria-label="Mover para a coluna anterior" ${ci === 0 ? 'disabled' : ''}>‹</button><button type="button" data-kmv="${t.id}|1" aria-label="Mover para a próxima coluna" ${ci === 3 ? 'disabled' : ''}>›</button></div>
    </div>`;
  }

  function render() {
    const box = $('vTarefas'); if (!box) return;
    const d = load(), all = d.tasks, hoje = F.todayISO();
    const vis = all.filter(t => !ST.cat || t.cat === ST.cat);
    const doneAll = sortTasks(vis.filter(t => t.status === 'done')).reverse();
    const limit = Date.now() - 14 * 864e5;
    const doneVis = ST.allDone ? doneAll : doneAll.filter(t => (t.doneAt || 0) >= limit).slice(0, 30);
    const colTasks = k => k === 'done' ? doneVis : sortTasks(vis.filter(t => t.status === k));
    const cnt = c => all.filter(t => t.status !== 'done' && (!c || t.cat === c)).length;
    const chips = ['', ...CATS].map(c => `<button type="button" class="chip2 ${ST.cat === c ? 'on' : ''}" data-kcat="${esc(c)}">${c || 'Todas'}${cnt(c) ? ` <small>${cnt(c)}</small>` : ''}</button>`).join('');
    const late = all.filter(t => t.status !== 'done' && t.prazo && t.prazo < hoje).length;
    const tabs = COLS.map(([k, n]) => `<button type="button" class="${ST.col === k ? 'on' : ''}" data-kcol="${k}">${n} <small>${k === 'done' ? doneVis.length : colTasks(k).length}</small></button>`).join('');
    const board = COLS.map(([k, n], ci) => {
      const ts = colTasks(k);
      return `<section class="kcol ${ST.col === k ? 'on' : ''}" data-kdrop="${k}"><h4><span>${n}</span><b>${ts.length}</b></h4>${ts.map(t => cardHTML(t, ci)).join('') || '<p class="kempty">Nada aqui.</p>'}
        ${k === 'done' ? (doneAll.length > doneVis.length || ST.allDone ? `<button type="button" class="kadd" data-kall="1">${ST.allDone ? 'Mostrar só as últimas 2 semanas' : `Mostrar todas (${doneAll.length})`}</button>` : '') : `<button type="button" class="kadd" data-knew="${k}">+ Adicionar</button>`}</section>`;
    }).join('');
    box.innerHTML = `<div class="kbt"><div class="chips">${chips}</div><button type="button" class="primary" data-knew="todo">+ Nova tarefa</button></div>
      ${late ? `<div class="banner warn kbl">${late} tarefa(s) com prazo vencido.</div>` : ''}
      <div class="kbtabs">${tabs}</div><div class="kb">${board}</div>
      <p class="note">Arraste os cartões entre as colunas (no celular, use as setas ‹ ›). Tarefas que vencem hoje também aparecem na tela Hoje e o cardinal lembra de você.</p>`;
    ST.flash = '';
  }

  /* ---------- janela de criar/editar ---------- */
  function openModal(id, status, pre) {
    const d = load(), t = id ? d.tasks.find(x => x.id === id) : null; ST.modal = id || 'new';
    const v = t || { titulo: '', cat: ST.cat || CATS[0], prio: 'm', prazo: '', status: status || 'todo', obs: '', rec: '' };
    if (!t && pre) Object.assign(v, { titulo: pre.titulo || '', cat: pre.cat || v.cat, prio: pre.prio || v.prio, prazo: pre.prazo || '', rec: pre.rec || '' });
    let m = $('kbModal'); if (!m) { m = document.createElement('div'); m.id = 'kbModal'; document.body.appendChild(m); }
    const opt = (o, sel) => Object.entries(o).map(([k, n]) => `<option value="${k}" ${k === sel ? 'selected' : ''}>${n}</option>`).join('');
    m.innerHTML = `<div class="kbback" data-kclose="1"></div><form class="kbbox" id="kbForm" role="dialog" aria-modal="true" aria-label="${t ? 'Editar tarefa' : 'Nova tarefa'}">
      <h3>${t ? 'Editar tarefa' : 'Nova tarefa'}</h3>
      ${!t && pre && pre.heard ? `<p class="kvheard">Você disse: <i>“${esc(pre.heard)}”</i><br><small>Confira os campos abaixo e salve. Ajuste o que o app entendeu errado.</small></p>` : ''}
      <div class="field"><label for="kmT">O que precisa ser feito?</label><input id="kmT" required maxlength="140" autocomplete="off" value="${esc(v.titulo)}" placeholder="Ex.: Solicitar reserva ao despachante"></div>
      <div class="grid2"><div class="field"><label for="kmC">Categoria</label><select id="kmC">${CATS.map(c => `<option ${c === v.cat ? 'selected' : ''}>${c}</option>`).join('')}</select></div>
        <div class="field"><label for="kmP">Prioridade</label><select id="kmP">${opt(PRIO, v.prio)}</select></div>
        <div class="field"><label for="kmD">Prazo</label><input id="kmD" type="date" value="${esc(v.prazo || '')}"></div>
        <div class="field"><label for="kmS">Coluna</label><select id="kmS">${opt(Object.fromEntries(COLS), v.status)}</select></div></div>
      <div class="field"><label for="kmR">Repetir</label><select id="kmR">${opt(REC, v.rec || '')}</select><small class="muted">Ao marcar como feita, a próxima já aparece em A fazer com a data seguinte.</small></div>
      <div class="field"><label for="kmO">Observações</label><textarea id="kmO" rows="3" maxlength="600">${esc(v.obs || '')}</textarea></div>
      <div class="row kbact"><button type="submit" class="primary">Salvar</button><button type="button" data-kclose="1">Cancelar</button>${t ? '<button type="button" class="danger" data-kdel="1">Excluir</button>' : ''}</div></form>`;
    m.hidden = false; setTimeout(() => { const i = $('kmT'); if (i) { i.focus(); i.select(); } }, 20);
  }
  function closeModal() { const m = $('kbModal'); if (m) { m.hidden = true; m.innerHTML = ''; } ST.modal = null; }

  function submitForm() {
    const titulo = $('kmT').value.trim(); if (!titulo) { $('kmT').focus(); return; }
    const d = load(), f = { titulo, cat: $('kmC').value, prio: $('kmP').value, prazo: $('kmD').value, obs: $('kmO').value.trim(), rec: $('kmR').value }, status = $('kmS').value;
    let t = ST.modal && ST.modal !== 'new' ? d.tasks.find(x => x.id === ST.modal) : null;
    if (t) { Object.assign(t, f); if (t.rec !== f.rec) t.spawned = false; save(d); if (t.status !== status) moveTo(t.id, status); ST.flash = t.id; }
    else { t = Object.assign({ id: uid(), ts: Date.now(), status: 'todo' }, f); d.tasks.push(t); save(d); if (status !== 'todo') moveTo(t.id, status); ST.flash = t.id; }
    closeModal(); refreshAll(); PP.toast && PP.toast('Tarefa salva ✓', 'ok');
  }
  function refreshAll() { if (PP.S.view === 'tarefas') render(); if (PP.assist) PP.assist.refresh(); if (PP.S.view === 'hoje' && PP.hoje) PP.hoje.render(); }

  /* ---------- eventos ---------- */
  document.addEventListener('click', e => {
    const T = e.target; if (!T.closest) return;
    const v = $('vTarefas'), inV = v && v.contains(T);
    if (T.closest('[data-kclose]')) { closeModal(); return; }
    if (T.closest('[data-kdel]')) { if (ST.modal && ST.modal !== 'new' && confirm('Excluir esta tarefa?')) { const d = load(); d.tasks = d.tasks.filter(x => x.id !== ST.modal); save(d); closeModal(); refreshAll(); PP.toast && PP.toast('Tarefa excluída.'); } return; }
    if (!inV) return;
    let b;
    if ((b = T.closest('[data-kcat]'))) { ST.cat = b.dataset.kcat; render(); return; }
    if ((b = T.closest('[data-kcol]'))) { ST.col = b.dataset.kcol; render(); return; }
    if ((b = T.closest('[data-knew]'))) { openModal(null, b.dataset.knew); return; }
    if (T.closest('[data-kall]')) { ST.allDone = !ST.allDone; render(); return; }
    if ((b = T.closest('[data-kmv]'))) { const [id, dir] = b.dataset.kmv.split('|'), t = load().tasks.find(x => x.id === id); if (t) { const i = COLS.findIndex(c => c[0] === t.status), n = COLS[Math.max(0, Math.min(3, i + +dir))][0]; moveTo(id, n); ST.col = n; ST.flash = id; refreshAll(); } return; }
    if ((b = T.closest('[data-kid]'))) openModal(b.dataset.kid);
  });
  document.addEventListener('submit', e => { if (e.target.id === 'kbForm') { e.preventDefault(); submitForm(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && ST.modal) { closeModal(); e.stopPropagation(); } });
  document.addEventListener('dragstart', e => { const c = e.target.closest && e.target.closest('[data-kid]'); if (!c) return; e.dataTransfer.setData('text/plain', c.dataset.kid); e.dataTransfer.effectAllowed = 'move'; c.classList.add('drag'); });
  document.addEventListener('dragend', e => { const c = e.target.closest && e.target.closest('[data-kid]'); if (c) c.classList.remove('drag'); document.querySelectorAll('.kcol.over').forEach(x => x.classList.remove('over')); });
  document.addEventListener('dragover', e => { const c = e.target.closest && e.target.closest('[data-kdrop]'); if (!c) return; e.preventDefault(); document.querySelectorAll('.kcol.over').forEach(x => { if (x !== c) x.classList.remove('over'); }); c.classList.add('over'); });
  document.addEventListener('drop', e => { const c = e.target.closest && e.target.closest('[data-kdrop]'); if (!c) return; e.preventDefault(); const id = e.dataTransfer.getData('text/plain'); if (id && moveTo(id, c.dataset.kdrop)) { ST.flash = id; refreshAll(); } else render(); });

  /* ---------- usado pela tela Hoje, cardinal e busca ---------- */
  const dueTasks = () => { const hoje = F.todayISO(); return load().tasks.filter(t => t.status !== 'done' && t.prazo && t.prazo <= hoje); };
  function searchItems(norm) {
    return load().tasks.filter(t => t.status !== 'done').map(t => ({ g: 'Tarefas', ic: PP.icon('tarefas'), t: t.titulo, s: `${t.cat || ''} · ${dueInfo(t).txt}`, q: norm([t.titulo, t.cat, 'tarefa'].join(' ')), go: () => { ST.flash = t.id; ST.col = t.status; PP.go('tarefas'); } }));
  }

  /* ---------- tarefa por voz (botão flutuante) ---------- */
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const V = { rec: null, on: false };
  const WD = { domingo: 0, segunda: 1, terca: 2, quarta: 3, quinta: 4, sexta: 5, sabado: 6 };
  const MES = { janeiro: 0, fevereiro: 1, marco: 2, abril: 3, maio: 4, junho: 5, julho: 6, agosto: 7, setembro: 8, outubro: 9, novembro: 10, dezembro: 11 };
  const NUM = { um: 1, uma: 1, dois: 2, duas: 2, tres: 3, quatro: 4, cinco: 5, seis: 6, sete: 7, oito: 8, nove: 9, dez: 10 };
  const KW = {
    'Frete': /\b(frete|cte|ct-e|ct e|transportadora|latam|gol|azul|coleta|rodoviario)\b/g,
    'Exportação': /\b(exportacao|exportacoes|exportar|mapa|sei|nota de entrada|notas de entrada|packing|invoice|despachante|voo|aeroporto|awb|embarque|atestado|czi|certificado|grifo|grifar|reserva)\b/g,
    'Financeiro': /\b(boleto|boletos|pagar|pagamento|financeiro|cobrar|cobranca|receber|pix|imposto|conta)\b/g,
    'Pedidos': /\b(pedido|pedidos|cliente|clientes|orcamento|romaneio|separar|etiqueta|etiquetas)\b/g,
    'Compras': /\b(comprar|compra|compras|repor|reposicao|estoque|fornecedor|racao|cotacao)\b/g,
  };
  /* entende uma frase falada: "amanhã ligar pro despachante, frete, urgente" */
  function parseVoice(raw) {
    let O = String(raw || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    const nz = x => x.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
    let N = nz(O); const out = { titulo: '', cat: '', prio: '', prazo: '', rec: '', heard: raw };
    const cut = re => { const m = re.exec(N); if (!m) return null; O = O.slice(0, m.index) + ' ' + O.slice(m.index + m[0].length); N = N.slice(0, m.index) + ' ' + N.slice(m.index + m[0].length); return m; };
    const hoje = F.todayISO(), dow0 = new Date(hoje + 'T12:00:00').getDay();
    const nextWd = w => { let k = (w - dow0 + 7) % 7; if (k === 0) k = 7; return F.addDays(hoje, k); };
    const pad2 = n => String(n).padStart(2, '0'), isoD = x => `${x.getFullYear()}-${pad2(x.getMonth() + 1)}-${pad2(x.getDate())}`;
    const dayOfMonth = (d, mes) => { const b = new Date(hoje + 'T12:00:00'), y = b.getFullYear(), m = mes != null ? mes : b.getMonth(); const mk = (yy, mm) => { const x = new Date(yy, mm, d, 12); return x.getDate() === d ? x : null; }; let x = mk(y, m); if (!x || isoD(x) < hoje) { if (mes != null) x = mk(y + 1, m); else { x = mk(y, m + 1) || mk(y, m + 2); } } return x ? isoD(x) : ''; };
    // frases de abertura
    cut(/^\s*(por favor[, ]*)?(criar|crie|adicionar|adicione|anotar|anote|nova|novo)?\s*(uma\s+)?(tarefa|lembrete)\s*(de|para|:)?\s*/);
    cut(/^\s*(me\s+)?(lembrar|lembra|lembre)(\s+de|\s+que)?\s*/); cut(/^\s*(preciso de|preciso|tenho que|tem que|nao esquecer de|nao esquecer)\s*/);
    // repetição
    let m;
    if ((m = cut(/\b(todo dia|todos os dias|diariamente)\s*(\d{1,2})?\b/))) { if (m[2]) { out.rec = 'm'; out.prazo = dayOfMonth(+m[2]); } else out.rec = 'd'; }
    else if ((m = cut(/\b(toda|todas as)\s+(segunda|terca|quarta|quinta|sexta|sabado|domingo)s?(?:-feira| feira)?\b/))) { out.rec = 's'; out.prazo = nextWd(WD[m[2]]); }
    else if (cut(/\b(toda semana|semanalmente)\b/)) out.rec = 's';
    else if (cut(/\b(todo mes|mensalmente)\b/)) out.rec = 'm';
    // prazo
    const pre = '(?:\\b(?:para|pra|ate|na|no|em|de)\\s+)?';
    if (!out.prazo) {
      if (cut(new RegExp(pre + '\\bdepois de amanha\\b'))) out.prazo = F.addDays(hoje, 2);
      else if (cut(new RegExp(pre + '\\bamanha\\b'))) out.prazo = F.addDays(hoje, 1);
      else if (cut(new RegExp(pre + '\\bhoje\\b'))) out.prazo = hoje;
      else if (cut(new RegExp(pre + '\\b(semana que vem|proxima semana)\\b'))) out.prazo = F.addDays(hoje, 7);
      else if ((m = cut(new RegExp(pre + '\\b(?:daqui a|em)\\s+(\\d+|um|uma|dois|duas|tres|quatro|cinco|seis|sete|oito|nove|dez)\\s+(dias?|semanas?)\\b')))) { const n = NUM[m[1]] || +m[1]; out.prazo = F.addDays(hoje, n * (/sem/.test(m[2]) ? 7 : 1)); }
      else if ((m = cut(new RegExp(pre + '\\b(segunda|terca|quarta|quinta|sexta)(?:-feira| feira)?\\b|' + pre + '\\b(sabado|domingo)\\b')))) out.prazo = nextWd(WD[m[1] || m[2]]);
      else if ((m = cut(new RegExp(pre + '\\bdia\\s+(\\d{1,2})(?:\\s+de\\s+(janeiro|fevereiro|marco|abril|maio|junho|julho|agosto|setembro|outubro|novembro|dezembro))?\\b')))) out.prazo = dayOfMonth(+m[1], m[2] ? MES[m[2]] : null);
      else if ((m = cut(/\b(?:para|pra|ate|no dia)?\s*\b(\d{1,2})\/(\d{1,2})\b/))) { const y = new Date().getFullYear(); const dt = `${y}-${String(+m[2]).padStart(2, '0')}-${String(+m[1]).padStart(2, '0')}`; out.prazo = dt < hoje ? `${y + 1}${dt.slice(4)}` : dt; }
    }
    // prioridade
    if (cut(/\b(prioridade baixa|baixa prioridade|sem pressa|sem urgencia|quando der)\b/)) out.prio = 'b';
    else if (cut(/\bprioridade media\b/)) out.prio = 'm';
    else if (cut(/\b(urgentissimo|urgentissima|urgente|prioridade alta|alta prioridade|muito importante|importante)\b/)) out.prio = 'a';
    // categoria
    const cm = cut(/\bcategoria\s+(pedidos?|exportacao|frete|financeiro|compras?)\b/);
    if (cm) out.cat = { pedido: 'Pedidos', pedidos: 'Pedidos', exportacao: 'Exportação', frete: 'Frete', financeiro: 'Financeiro', compra: 'Compras', compras: 'Compras' }[cm[1]];
    else { let best = 0; Object.entries(KW).forEach(([c, re]) => { const n = (N.match(re) || []).length; if (n > best) { best = n; out.cat = c; } }); }
    // título
    let t = O.replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g, '').replace(/\s+,/g, ',').replace(/,\s*,/g, ',').replace(/\s+/g, ' ').replace(/^(de|que|pra|para)\s+/i, '').replace(/^[\s,.;:\-–]+|[\s,.;:\-–]+$/g, '');
    t = t.replace(/[,;]\s*(frete|exporta[cç][aã]o|financeiro|pedidos?|compras?)\s*$/i, '');
    if (!t) t = String(raw || '').trim();
    out.titulo = (t.charAt(0).toUpperCase() + t.slice(1)).slice(0, 140);
    return out;
  }
  const MIC = '<svg viewBox="0 0 24 24" width="24" height="24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0M12 18v3"/></svg>';
  function ensureMic() {
    if ($('kbMic')) return;
    const b = document.createElement('button'); b.id = 'kbMic'; b.type = 'button'; b.title = 'Falar uma tarefa'; b.setAttribute('aria-label', 'Criar tarefa por voz'); b.innerHTML = MIC; document.body.appendChild(b);
  }
  const vSay = (t, cls) => { const e = $('kvS'); if (e) { e.textContent = t; e.className = 'kvs ' + (cls || ''); } };
  function voiceOpen(autoListen) {
    let p = $('kbVoice'); if (!p) { p = document.createElement('div'); p.id = 'kbVoice'; document.body.appendChild(p); }
    p.hidden = false; $('kbMic').classList.add('open');
    p.innerHTML = `<div class="kvh"><b>Falar uma tarefa</b><button type="button" data-kvx="close" aria-label="Fechar">✕</button></div>
      <p class="kvs" id="kvS" role="status"></p>
      <input id="kvT" autocomplete="off" placeholder="Ex.: amanhã ligar pro despachante, frete, urgente" aria-label="Frase da tarefa">
      <div class="kvb"><button type="button" class="primary" data-kvx="go">Criar tarefa</button><button type="button" data-kvx="mic">${MIC} Falar de novo</button></div>
      <small class="muted">Diga o prazo (hoje, amanhã, sexta, dia 15), a categoria e “urgente”. Você confere tudo antes de salvar.</small>`;
    if (autoListen !== false) voiceListen();
  }
  function voiceClose() { stopRec(); const p = $('kbVoice'); if (p) p.hidden = true; const m = $('kbMic'); if (m) m.classList.remove('open', 'rec'); }
  function stopRec() { if (V.rec) { try { V.rec.onend = null; V.rec.abort(); } catch (_) { /* ok */ } V.rec = null; } V.on = false; const m = $('kbMic'); if (m) m.classList.remove('rec'); }
  function voiceListen() {
    stopRec();
    if (!SR) { vSay('Este navegador não tem reconhecimento de voz. Digite abaixo — no celular, use o microfone do teclado.', 'warn'); const i = $('kvT'); if (i) i.focus(); return; }
    const r = new SR(); V.rec = r; r.lang = 'pt-BR'; r.interimResults = true; r.continuous = false; r.maxAlternatives = 1;
    let txt = '', fin = false;
    r.onstart = () => { V.on = true; $('kbMic').classList.add('rec'); vSay('Ouvindo… pode falar.', 'on'); };
    r.onresult = e => { txt = Array.from(e.results).map(x => x[0].transcript).join(' ').trim(); fin = e.results[e.results.length - 1].isFinal; const i = $('kvT'); if (i) i.value = txt; };
    r.onerror = e => { const er = e.error; vSay(er === 'not-allowed' || er === 'service-not-allowed' ? 'Microfone bloqueado. Toque no cadeado ao lado do endereço e libere o microfone.' : er === 'no-speech' ? 'Não ouvi nada. Toque em “Falar de novo”.' : er === 'network' ? 'Sem internet: a voz precisa de conexão. Você pode digitar abaixo.' : er === 'audio-capture' ? 'Não encontrei o microfone.' : er === 'aborted' ? '' : 'Não consegui ouvir (' + er + '). Digite abaixo.', 'warn'); };
    r.onend = () => { V.on = false; V.rec = null; const m = $('kbMic'); if (m) m.classList.remove('rec'); if (txt) { vSay('Entendi. Conferindo…'); setTimeout(voiceSubmit, 300); } };
    try { r.start(); } catch (_) { vSay('Não consegui iniciar o microfone. Digite abaixo.', 'warn'); }
  }
  function voiceSubmit() {
    const i = $('kvT'), txt = i ? i.value.trim() : ''; if (!txt) { vSay('Fale ou digite a tarefa primeiro.', 'warn'); if (i) i.focus(); return; }
    const pr = parseVoice(txt); voiceClose(); openModal(null, 'todo', pr);
  }
  document.addEventListener('click', e => {
    if (e.target.closest('#kbMic')) { const p = $('kbVoice'); if (p && !p.hidden) voiceClose(); else voiceOpen(); return; }
    const b = e.target.closest('[data-kvx]'); if (!b) return;
    const a = b.dataset.kvx; if (a === 'close') voiceClose(); else if (a === 'mic') voiceListen(); else if (a === 'go') voiceSubmit();
  });
  document.addEventListener('keydown', e => { if (e.target && e.target.id === 'kvT' && e.key === 'Enter') { e.preventDefault(); voiceSubmit(); } else if (e.key === 'Escape') { const p = $('kbVoice'); if (p && !p.hidden && !ST.modal) voiceClose(); } });
  ensureMic();
  PP.kanban = { render, load, save, moveTo, complete, dueTasks, searchItems, dueInfo, openModal, ST, parseVoice };
})();
