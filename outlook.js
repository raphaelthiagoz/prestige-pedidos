/* Prestige Pedidos — Outlook (v29.19): busca o e-mail do despachante na sua caixa (SÓ LEITURA, permissão Mail.Read)
   e entrega para a aba Frete os CT-es (PDF) anexados e a tabela (texto ou imagem com os horários em vermelho).
   Login pela biblioteca oficial da Microsoft (vendor/msal-browser.min.js, carregada só quando usada). Nada é enviado
   para servidor nosso: o app fala direto com a Microsoft, e o acesso fica guardado neste navegador. */
(function () {
  const store = PP.store, esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const DEF = { clientId: '', remetentes: 'exp.emissao@dmarcos.com.br', dias: 10 };
  const cfg = () => Object.assign({}, DEF, store.get('outlook', {}));
  const SCOPES = ['Mail.Read'];
  const ST = { msg: '', lista: null, usado: null, ocupado: false, cfgAberta: false };
  let pca = null, conta = null;

  const carregaMsal = () => window.msal ? Promise.resolve() : new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'vendor/msal-browser.min.js'; s.onload = ok; s.onerror = () => no(new Error('Não consegui carregar o login da Microsoft (sem internet?).')); document.head.appendChild(s); });
  async function app() {
    if (pca) return pca; const c = cfg(); if (!c.clientId) throw new Error('Falta o "ID do aplicativo" da Microsoft. Abra "Configurar Outlook" aqui embaixo.');
    await carregaMsal();
    pca = new msal.PublicClientApplication({ auth: { clientId: c.clientId.trim(), authority: 'https://login.microsoftonline.com/common', redirectUri: location.origin + '/outlook-volta.html', navigateToLoginRequestUrl: false }, cache: { cacheLocation: 'localStorage' } });
    await pca.initialize();
    const r = await pca.handleRedirectPromise().catch(() => null); if (r && r.account) conta = r.account;
    conta = conta || pca.getAllAccounts()[0] || null; return pca;
  }
  async function token() {
    if (O.tokenFake) return O.tokenFake; // testes
    const a = await app();
    if (conta) { try { return (await a.acquireTokenSilent({ scopes: SCOPES, account: conta })).accessToken; } catch (_) { /* pede login de novo */ } }
    try { const r = await a.loginPopup({ scopes: SCOPES, prompt: 'select_account' }); conta = r.account; return r.accessToken; }
    catch (e) {
      const cod = String((e && (e.errorCode || e.message)) || '');
      if (/popup|block|empty_window/i.test(cod)) { sessionStorage.setItem('pp.outlookVolta', '1'); await a.loginRedirect({ scopes: SCOPES, prompt: 'select_account' }); return null; }
      if (/user_cancelled/i.test(cod)) throw new Error('Login cancelado.');
      if (/consent|admin/i.test(cod)) throw new Error('A Microsoft pediu autorização do administrador da conta para o app ler e-mails. Peça para ele liberar o aplicativo (passo a passo no LEIA-ME).');
      throw e;
    }
  }
  async function graph(path, tk) {
    const r = await fetch('https://graph.microsoft.com/v1.0' + path, { headers: { Authorization: 'Bearer ' + tk } });
    if (r.status === 401) { conta = null; throw new Error('O acesso ao Outlook expirou. Clique de novo para entrar.'); }
    if (!r.ok) throw new Error('O Outlook respondeu erro ' + r.status + '.');
    return r.json();
  }
  const remetentes = () => cfg().remetentes.toLowerCase().split(/[\s,;]+/).filter(x => x.includes('@'));
  async function listar(tk) {
    const desde = new Date(Date.now() - (+cfg().dias || 10) * 864e5).toISOString().slice(0, 19) + 'Z';
    const q = `/me/messages?$filter=${encodeURIComponent('receivedDateTime ge ' + desde)}&$orderby=${encodeURIComponent('receivedDateTime desc')}&$top=60&$select=id,subject,receivedDateTime,hasAttachments,from`;
    const j = await graph(q, tk), rem = remetentes();
    return (j.value || []).filter(m => rem.includes(String(((m.from || {}).emailAddress || {}).address || '').toLowerCase()));
  }
  const b64File = (b64, nome, tipo) => { const s = atob(b64), u = new Uint8Array(s.length); for (let i = 0; i < s.length; i++) u[i] = s.charCodeAt(i); return new File([u], nome, { type: tipo }); };
  // corpo HTML -> texto com TAB entre células (o leitor de e-mail colado já entende esse formato)
  function corpoTexto(html) {
    try { const d = new DOMParser().parseFromString(String(html || ''), 'text/html'); d.querySelectorAll('tr').forEach(tr => { tr.textContent = Array.from(tr.children).map(td => td.textContent.replace(/\s+/g, ' ').trim()).join('\t') + '\n'; }); return d.body ? d.body.innerText || d.body.textContent || '' : ''; }
    catch (_) { return String(html || '').replace(/<[^>]+>/g, ' '); }
  }
  async function importar(m, tk) {
    const F = PP.frete; if (!F || !F.importCtes) throw new Error('A aba Frete não está pronta.');
    const [full, at] = await Promise.all([graph(`/me/messages/${encodeURIComponent(m.id)}?$select=subject,receivedDateTime,body`, tk), m.hasAttachments ? graph(`/me/messages/${encodeURIComponent(m.id)}/attachments`, tk) : { value: [] }]);
    const arq = (at.value || []).filter(a => a.contentBytes && /fileAttachment/i.test(a['@odata.type'] || 'fileAttachment'));
    const pdfs = arq.filter(a => /pdf/i.test(a.contentType || '') || /\.pdf$/i.test(a.name || '')).map(a => b64File(a.contentBytes, a.name || 'cte.pdf', 'application/pdf'));
    const imgs = arq.filter(a => /^image\//i.test(a.contentType || '') && (a.size || a.contentBytes.length * 0.75) > 8000).sort((x, y) => (y.size || y.contentBytes.length) - (x.size || x.contentBytes.length));
    if (pdfs.length) await F.importCtes(pdfs);
    const txt = corpoTexto(full.body && full.body.contentType === 'html' ? full.body.content : (full.body || {}).content);
    let tabela = 'nenhuma';
    if (/\d{3}-\d{8}/.test(txt) && /\b\d{1,2}:\d{2}\b/.test(txt)) { F.importMail(txt); tabela = 'texto do e-mail'; }
    else if (imgs.length) { await F.importPrint(b64File(imgs[0].contentBytes, imgs[0].name || 'tabela.png', imgs[0].contentType)); tabela = 'imagem'; }
    ST.usado = m.id;
    const quando = new Date(m.receivedDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
    ST.msg = `E-mail usado: "${m.subject || '(sem assunto)'}" de ${quando}. ${pdfs.length} CT-e(s) em PDF lido(s)` + (tabela === 'nenhuma' ? '; não achei a tabela de horários (nem em texto nem em imagem) neste e-mail.' : `; horários lidos da ${tabela}.`);
  }
  async function buscar(id) {
    if (ST.ocupado) return; ST.ocupado = true; ST.msg = 'Buscando no Outlook…'; F5();
    try {
      const tk = await token(); if (!tk) return; // foi para a tela de login da Microsoft; volta sozinho
      const L = await listar(tk); ST.lista = L;
      if (!L.length) { ST.msg = `Nenhum e-mail de ${remetentes().join(', ')} nos últimos ${cfg().dias} dias.`; return; }
      await importar(id ? (L.find(x => x.id === id) || L[0]) : L[0], tk);
    } catch (e) { ST.msg = (e && e.message) || String(e); }
    finally { ST.ocupado = false; F5(); }
  }
  const F5 = () => { if (PP.frete && document.getElementById('vFrete') && S().view === 'frete') PP.frete.render(); };
  const S = () => PP.S || {};

  function html() {
    const c = cfg(), L = ST.lista || [];
    const outros = L.length > 1 ? `<details class="olout"><summary>Usar outro e-mail (${L.length} do despachante)</summary><div class="ollist">${L.map(m => `<button type="button" data-ol="usar" data-id="${esc(m.id)}" aria-pressed="${m.id === ST.usado}">${esc(new Date(m.receivedDateTime).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }))} · ${esc(m.subject || '(sem assunto)')}${m.hasAttachments ? ' · com anexos' : ''}</button>`).join('')}</div></details>` : '';
    return `<div class="olbox" id="olBox"><div class="row" style="align-items:center"><button type="button" class="primary" data-ol="buscar" ${ST.ocupado ? 'disabled' : ''}>Buscar e-mail do despachante (Outlook)</button>
      <button type="button" data-ol="cfg" aria-expanded="${ST.cfgAberta}">${c.clientId ? 'Outlook: configurar' : 'Configurar Outlook'}</button>${conta ? `<span class="note">conectado: ${esc(conta.username || '')}</span>` : ''}</div>
      ${ST.msg ? `<p class="note" id="olMsg" role="status">${esc(ST.msg)}</p>` : ''}${outros}
      ${ST.cfgAberta ? `<div class="olcfg"><p class="note">Só leitura: o app lê os e-mails do despachante para pegar os CT-es e os horários. Não envia, não apaga, não mexe em nada. O "ID do aplicativo" você cria uma vez no portal da Microsoft (passo a passo no LEIA-ME, seção v29.19).</p>
        <div class="row"><div class="field grow"><label for="olId">ID do aplicativo (Application / client ID)</label><input id="olId" data-olc="clientId" value="${esc(c.clientId)}" placeholder="ex.: 1a2b3c4d-…" autocomplete="off"></div>
        <div class="field grow"><label for="olRem">E-mail(s) do despachante</label><input id="olRem" data-olc="remetentes" value="${esc(c.remetentes)}"></div>
        <div class="field" style="flex:0 0 120px"><label for="olDias">Procurar nos últimos (dias)</label><input id="olDias" type="number" min="1" max="60" data-olc="dias" value="${esc(c.dias)}"></div></div>
        ${conta ? '<div class="row"><button type="button" data-ol="sair">Desconectar o Outlook deste navegador</button></div>' : ''}</div>` : ''}</div>`;
  }

  document.addEventListener('click', async ev => {
    const b = ev.target.closest('[data-ol]'); if (!b) return; ev.preventDefault(); const a = b.dataset.ol;
    if (a === 'buscar') return buscar();
    if (a === 'usar') return buscar(b.dataset.id);
    if (a === 'cfg') { ST.cfgAberta = !ST.cfgAberta; F5(); return; }
    if (a === 'sair') {
      if (!confirm('Desconectar o Outlook deste navegador?\n\nNenhum e-mail é apagado. Para buscar de novo, é só clicar em "Buscar e-mail do despachante" e entrar.')) return;
      try { const p = await app(); if (conta && p.clearCache) await p.clearCache({ account: conta }); } catch (_) { /* ok */ }
      conta = null; ST.lista = null; ST.msg = 'Outlook desconectado deste navegador.'; F5();
    }
  });
  document.addEventListener('change', ev => {
    const t = ev.target; if (!t.dataset || !t.dataset.olc) return;
    const c = store.get('outlook', {}); c[t.dataset.olc] = t.dataset.olc === 'dias' ? Math.max(1, Math.min(60, +t.value || 10)) : t.value.trim();
    store.set('outlook', c); if (t.dataset.olc === 'clientId') { pca = null; conta = null; } ST.msg = 'Configuração do Outlook salva.'; F5();
  });
  // voltou da tela de login da Microsoft (quando a janelinha foi bloqueada): termina o login e já busca
  if (sessionStorage.getItem('pp.outlookVolta')) {
    sessionStorage.removeItem('pp.outlookVolta');
    setTimeout(async () => { try { await app(); if (conta) { if (PP.go) PP.go('frete'); buscar(); } } catch (e) { ST.msg = e.message; F5(); } }, 600);
  }
  const O = { html, buscar, cfg, tokenFake: null, _st: ST };
  PP.outlook = O;
})();
