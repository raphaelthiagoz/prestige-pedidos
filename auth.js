/* Login (Supabase Auth, e-mail + senha). Ao abrir o link o app pede o login; depois disso tudo é salvo na nuvem e
   aparece igual em qualquer aparelho. O endereço do servidor fica embutido (cloudcfg.js). */
(function () {
  'use strict';
  const PP = window.PP, store = PP.store, $ = PP.$, esc = PP.esc;
  const cfg = () => (PP.cloudCfg ? PP.cloudCfg() : null);
  const now = () => Date.now();
  const rd = st => { try { const v = st.getItem('pp.authsess'); return v ? JSON.parse(v) : null; } catch (_) { return null; } };
  const sess = () => rd(localStorage) || rd(sessionStorage);           // "manter conectado" = localStorage; senão só até fechar a aba
  const remember = () => !!rd(localStorage) || !rd(sessionStorage);
  const clearSess = () => { try { localStorage.removeItem('pp.authsess'); sessionStorage.removeItem('pp.authsess'); } catch (_) { /* ok */ } };
  const save = (j, email, keep) => {
    const old = sess(), s = { access_token: j.access_token, refresh_token: j.refresh_token, expires_at: now() + (+j.expires_in || 3600) * 1000, email: email || (j.user && j.user.email) || (old || {}).email || '' };
    const k = keep === undefined ? remember() : keep;
    try { (k ? localStorage : sessionStorage).setItem('pp.authsess', JSON.stringify(s)); (k ? sessionStorage : localStorage).removeItem('pp.authsess'); } catch (_) { /* ok */ }
    return s;
  };
  async function call(c, grant, body) {
    const r = await fetch(c.url.replace(/\/+$/, '') + '/auth/v1/token?grant_type=' + grant, { method: 'POST', headers: { apikey: c.key, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    let j = null; try { j = await r.json(); } catch (_) { /* sem corpo */ }
    if (!r.ok) { const e = new Error(r.status === 400 || r.status === 401 || r.status === 422 ? 'E-mail ou senha incorretos.' : 'O servidor respondeu ' + r.status + '.'); e.code = 'AUTH'; e.status = r.status; throw e; }
    return j;
  }
  async function login(email, pw, keep) { const c = cfg(); if (!c) throw new Error('A nuvem não está disponível.'); const s = save(await call(c, 'password', { email, password: pw }), email, keep); store.set('sync', Object.assign({}, store.get('sync', {}), { email: s.email })); return s; }
  async function refresh() { const c = cfg(), s = sess(); if (!c || !s || !s.refresh_token) throw Object.assign(new Error('Entre na sua conta.'), { code: 'AUTH' }); return save(await call(c, 'refresh_token', { refresh_token: s.refresh_token })); }
  let pending = null;
  async function token() {
    const s = sess();
    if (s && s.access_token && s.expires_at - 60000 > now()) return s.access_token;
    if (!s || !s.refresh_token) { show(); throw Object.assign(new Error('Entre na sua conta para sincronizar.'), { code: 'AUTH' }); }
    if (!pending) pending = refresh().finally(() => { pending = null; });
    try { return (await pending).access_token; }
    catch (e) { if (e.code === 'AUTH') { clearSess(); show(); throw e; } throw e; }
  }
  const temLocal = () => { try { return !!(PP.S.hist.length || PP.S.clientes.length || (store.get('exphist', null) || []).length || store.get('mapa', null)); } catch (_) { return false; } };

  /* ---------- tela de login ---------- */
  function show(msg) {
    const c = cfg(); if (!c) return; const L = $('login'), s = sess();
    if (!L.hidden && L.dataset.ready) { if (msg && $('lgErr')) $('lgErr').textContent = msg; return; }
    L.dataset.ready = '1';
    L.innerHTML = `<form class="lbox" id="lgForm" autocomplete="on"><img class="lglogo" src="logo-login.png" alt="Prestige Aquarium">
      <div><h1>Sistema de Pedidos</h1><p class="muted">Prestige Aquarium Ltda · entre para continuar</p></div>
      <div class="field"><label for="lgEmail">E-mail</label><input id="lgEmail" type="email" autocomplete="username" required value="${esc((s && s.email) || c.email || '')}"></div>
      <div class="field"><label for="lgPass">Senha</label><input id="lgPass" type="password" autocomplete="current-password" required></div>
      <label class="lgchk"><input type="checkbox" id="lgKeep" checked> Manter conectado neste aparelho</label>
      <div id="lgErr" role="alert">${esc(msg || '')}</div>
      <button class="primary" type="submit" id="lgGo">Entrar</button>
      ${temLocal() ? '<button type="button" id="lgOff" class="lgoff">Entrar sem conexão (dados deste aparelho)</button>' : ''}
      <div class="lgft"><span class="lgdot"></span> Seus dados ficam iguais em todos os seus aparelhos</div>
    </form>`;
    L.hidden = false; setTimeout(() => { const el = $($('lgEmail').value ? 'lgPass' : 'lgEmail'); if (el) el.focus(); }, 30);
  }
  function hide() { const L = $('login'); L.hidden = true; L.innerHTML = ''; delete L.dataset.ready; }
  document.addEventListener('submit', async e => {
    if (e.target.id !== 'lgForm') return; e.preventDefault();
    const err = $('lgErr'), btn = $('lgGo'); err.textContent = ''; btn.disabled = true; btn.textContent = 'Entrando…';
    try { await login($('lgEmail').value.trim(), $('lgPass').value, $('lgKeep').checked); hide(); info(); if (PP.extra) PP.extra.syncNow(true); }
    catch (ex) { err.textContent = ex.code === 'AUTH' ? ex.message : (/failed|network|fetch/i.test(String(ex.message)) ? 'Sem conexão com o servidor. Confira a internet.' : String(ex.message || ex)); btn.disabled = false; btn.textContent = 'Entrar'; if ($('lgPass')) $('lgPass').select(); }
  });

  /* ---------- sair da conta ---------- */
  let avisoSair = false;
  const sair = () => { clearSess(); avisoSair = false; PP.cloud.state = 'off'; info(); show(); };
  document.addEventListener('click', async e => {
    const id = e.target.id;
    if (id === 'lgOff') hide();
    else if (id === 'cloudNow') { if (PP.extra) PP.extra.syncNow(true); }
    else if (id === 'cloudOut') { if (PP.cloud.pend > 0) { avisoSair = true; info(); } else sair(); }
    else if (id === 'cloudSendOut') { if (PP.extra) await PP.extra.syncNow(true); if (PP.cloud.pend > 0) { info(); PP.toast('Ainda não consegui enviar. Confira a internet.', 'bad'); } else sair(); }
    else if (id === 'cloudOutNow') sair();
    else if (id === 'cloudCancel') { avisoSair = false; info(); }
  });

  /* ---------- rodapé do menu e cartão em Configurações ---------- */
  const hora = c => { const t = c && c.last ? new Date(c.last) : null; return t ? t.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }) : ''; };
  function info() {
    const c = cfg(), el = $('syncInfo'), fm = $('footMsg'), card = $('cloudCard'), st = PP.cloud || { state: 'off', pend: 0 }, s = sess();
    if (fm) fm.textContent = c ? 'Seus dados ficam neste aparelho e também na nuvem (Supabase), protegidos pelo seu login.' : 'Os dados dos clientes e pedidos ficam só neste navegador. Nada é enviado para servidor.';
    const h = hora(c), n = st.pend || 0;
    let chip;
    if (!c) chip = 'Dados só neste navegador';
    else if (!s) chip = '☁ Não conectado';
    else if (st.state === 'sync') chip = '☁ Atualizando…';
    else if (st.state === 'pend' && st.msg) chip = '☁ ' + st.msg;
    else if (st.state === 'pend' || n > 0) chip = '☁ ' + (n || 1) + ' alteraç' + ((n || 1) === 1 ? 'ão' : 'ões') + ' não enviada' + ((n || 1) === 1 ? '' : 's');
    else if (st.state === 'err') chip = '☁ Sem sincronizar';
    else chip = '☁ ' + (s.email || 'conectado') + (h ? ' · ' + h : '');
    if (el) el.textContent = chip;
    if (!card) return;
    if (!c) { card.innerHTML = '<p class="note">A nuvem não está disponível neste navegador.</p>'; return; }
    let k = 'ok', tit = 'Sincronizado' + (h ? ' às ' + h : ''), sub = s ? s.email : '', btn = '<button id="cloudNow" type="button">⟳ Sincronizar agora</button>';
    if (!s) { k = 'pend'; tit = 'Não conectado'; sub = 'Entre com seu e-mail e senha.'; btn = ''; }
    else if (st.state === 'sync') { k = 'sync'; tit = 'Sincronizando…'; btn = '<button type="button" disabled>⟳ Sincronizar agora</button>'; }
    else if (st.state === 'pend' || st.state === 'err' || n > 0) { k = 'pend'; tit = n > 0 ? n + ' alteraç' + (n === 1 ? 'ão não enviada' : 'ões não enviadas') : 'Sem sincronizar'; sub = st.msg || 'Sem internet ou nuvem fora do ar'; btn = '<button id="cloudNow" type="button">⟳ Tentar agora</button>'; }
    const lab = { ok: 'Sincronizado', sync: 'Enviando', pend: 'Pendente' }[k];
    card.innerHTML = `<div class="cloudcard ${k}"><div class="cl">Nuvem · ${lab}</div><div class="ct"><span class="cdot"></span>${esc(tit)}</div><div class="cs">${esc(sub)}</div><div class="row">${btn}${s ? '<button id="cloudOut" type="button">Sair desta conta</button>' : ''}</div></div>`
      + (avisoSair ? '<div class="cloudwarn"><b>Antes de sair:</b> você tem alterações que ainda não foram enviadas para a nuvem.<div class="row"><button id="cloudSendOut" type="button" class="primary">Enviar e sair</button><button id="cloudOutNow" type="button">Sair mesmo assim</button><button id="cloudCancel" type="button">Cancelar</button></div></div>' : '');
  }
  { const _set = store.set; store.set = function (k) { const r = _set.apply(this, arguments); if (k === 'sync') info(); return r; }; }
  setInterval(info, 20000); info();

  /* ---------- ao abrir ---------- */
  async function boot() {
    if (!cfg()) return; const s = sess();
    if (!s) { show(); return; }
    if (s.expires_at - 60000 > now()) return;
    try { await refresh(); info(); } catch (e) { if (e.code === 'AUTH') { clearSess(); show('Sua sessão expirou. Entre de novo.'); } /* sem internet: deixa entrar com os dados locais */ }
  }
  PP.auth = { token, login, show, hide, info, hasSession: () => !!sess() };
  boot();
  PP.go(PP.S.view || 'hoje'); // últimos scripts carregados: desenha a tela inicial
})();
