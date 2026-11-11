t='/home/claude/prestige-pedidos/test/'
parts=[open(t+f).read() for f in ['_xa.js','_prev_patched.js','_xc.js','_xd.js','_xe.js']]
x=parts[0]+'\n  /* ---- pré-visualização ---- */\n'+parts[1]+'\n'+parts[2]+parts[3]+parts[4]
x=x.replace("if (S.view === 'rot') renderRot()","if (PPx.S.view === 'rot') renderRot()")
x=x.replace("window.PP.exp = { render,","""function reload() { CFG = Object.assign({ last: 17, ano: new Date().getFullYear(), cons: {}, ordem: [], used: SEED_USED.slice() }, store.get('expcfg', {})); HIST = store.get('exphist', []); }
  window.PP.exp = { render, reload, histHTML,""").replace("  document.addEventListener('DOMContentLoaded', () => {});\n","")
x=x.replace('histHTML, state','histHTML, openEntry, destLabel: k => (DEST[k] || {}).label, state')
open('/home/claude/prestige-pedidos/exportui.js','w').write(x)
