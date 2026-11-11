const {fs,JSZip,TPL,OUT,mkOrder}=require('./exp_common');const XD=require('../exportdocs.js');const mk=XD.make({JSZip,TPL});
(async()=>{const o=mkOrder();fs.writeFileSync(OUT+'/PACKING_018.docx',await mk.packingDocx(o));console.log('ok');})().catch(e=>{console.error(e);process.exit(1)});
