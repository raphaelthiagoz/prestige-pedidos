const {JSZip,TPL}=require('./exp_common');const XD=require('../exportdocs.js');const mk=XD.make({JSZip,TPL});
(async()=>{for(const k of process.argv.slice(2)){console.log('=====',k);(await mk._dump(k)).forEach(l=>console.log(l));}})();
