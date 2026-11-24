// Assemble independent editors under the main domain; never copy backend or local QA data.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.resolve(__dirname,'..'),destination=path.join(root,'goom-site');
const runtimeExtensions=new Set(['.html','.js','.css','.png','.jpg','.jpeg','.webp','.svg','.ico','.mp4','.woff','.woff2']);
const preserveMedia=process.argv.includes('--code-only');
const hash=bytes=>crypto.createHash('sha1').update(Buffer.from(`blob ${bytes.length}\0`)).update(bytes).digest('hex');
for(const [product,source]of [['pzts',root],['eps',path.join(root,'EPS')],['cctv',path.join(root,'.qa-cctv-feature-20261118')],['sk',path.join(root,'SK')]]){
  const target=path.join(destination,product);fs.mkdirSync(target,{recursive:true});
  for(const entry of fs.readdirSync(source,{withFileTypes:true}))if(entry.isFile()&&!entry.name.startsWith('.')&&entry.name!=='introsite.mp4'&&runtimeExtensions.has(path.extname(entry.name))&&(!preserveMedia||['eps','sk'].includes(product)||['.html','.js','.css'].includes(path.extname(entry.name))))fs.copyFileSync(path.join(source,entry.name),path.join(target,entry.name));
  for(const name of ['NP.png','DWG-CONVERTER.md','LICENSE_LIBREDWG.txt'])fs.copyFileSync(path.join(source,name),path.join(target,name));
  fs.cpSync(path.join(source,'vendor'),path.join(target,'vendor'),{recursive:true});
  if(['eps','sk'].includes(product)){fs.cpSync(path.join(source,'assets'),path.join(target,'assets'),{recursive:true});fs.copyFileSync(path.join(source,'README-RU.md'),path.join(target,'README-RU.md'));fs.copyFileSync(path.join(source,'.nojekyll'),path.join(target,'.nojekyll'));}
  for(const name of ['index.html','bootstrap.js']){const file=path.join(target,name);let text=fs.readFileSync(file,'utf8');text=text.replace(/20261118-(?:a4-hybrid-60|cctv-a4-hybrid-68)/g,product==='pzts'?'20261118-goom-paths-61':'20261118-cctv-goom-paths-69');text=text.replaceAll('https://pzts.five.surf/admin.html','https://goom.cz/pzts/admin.html');if(name==='index.html')text=text.replace('</head>',`<link rel="canonical" href="https://goom.cz/${product}/">\n</head>`);fs.writeFileSync(file,text);}
  for(const name of ['firebase-auth.js','i18n.js']){const file=path.join(target,name);fs.writeFileSync(file,fs.readFileSync(file,'utf8').replaceAll('https://pzts.five.surf/','https://goom.cz/pzts/'));}
  if(product==='pzts')fs.writeFileSync(path.join(target,'cctv.html'),'<!doctype html><meta charset="utf-8"><meta http-equiv="refresh" content="0;url=../cctv/"><title>GooM CCTV</title><a href="../cctv/">CCTV</a>\n');
}
const manifest=[];function visit(folder){for(const entry of fs.readdirSync(folder,{withFileTypes:true})){const file=path.join(folder,entry.name);if(entry.isDirectory())visit(file);else{const bytes=fs.readFileSync(file);manifest.push({path:path.relative(destination,file).replaceAll('\\','/'),sha:hash(bytes),size:bytes.length,text:['.html','.css','.js','.mjs','.json','.md','.txt','.xml'].includes(path.extname(file))||['.nojekyll','CNAME','LICENSE','LICENSE_FOXIT','LICENSE_LIBERATION','LICENSE_JBIG2','LICENSE_OPENJPEG','LICENSE_PDFJS_JBIG2','LICENSE_PDFJS_OPENJPEG','LICENSE_PDFJS_QCMS','LICENSE_QCMS'].includes(entry.name)});}}}visit(destination);
fs.writeFileSync(path.join(root,'.qa-goom-migration-files.json'),JSON.stringify(manifest,null,2));console.log(JSON.stringify({files:manifest.length,unique: new Set(manifest.map(f=>f.sha)).size,bytes:manifest.reduce((n,f)=>n+f.size,0)}));
