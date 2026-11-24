// One file entry point for picker and drag/drop; parsing finishes before project mutation.
(() => {
 const words=(cs,en,de,ru,pl)=>window.goomUI(cs,en,de,ru,pl);
 window.convertGoomDwg=async file=>{
  if(file.size>64*1024*1024)throw Error(words('DWG je příliš velký (max. 64 MB).','DWG is too large (max. 64 MB).','DWG ist zu groß (max. 64 MB).','DWG слишком большой (до 64 МБ).','DWG jest za duży (maks. 64 MB).'));
  const buffer=await file.arrayBuffer();
  return new Promise((resolve,reject)=>{let worker;const finish=(error,bytes)=>{clearTimeout(timer);worker?.terminate();if(error)reject(error);else {const head=new TextDecoder('windows-1252').decode(new Uint8Array(bytes).subarray(0,65536)),version=Number(head.match(/\$ACADVER\s+1\s+AC(\d+)/)?.[1]||1021),page=head.match(/\$DWGCODEPAGE\s+3\s+ANSI_(\d+)/)?.[1]||'1252',encoding=version>=1021?'utf-8':({'932':'shift_jis','936':'gbk','949':'euc-kr','950':'big5'}[page]||'windows-'+page);try{resolve(new TextDecoder(encoding).decode(bytes));}catch{resolve(new TextDecoder('windows-1252').decode(bytes));}}};const timer=setTimeout(()=>finish(Error(words('Převod DWG vypršel.','DWG conversion timed out.','DWG-Konvertierung dauerte zu lange.','Превышено время открытия DWG.','Przekroczono czas konwersji DWG.'))),90000);
   try{worker=new Worker(new URL('dwg-converter-worker.js?v=20261124-workspace-9',document.baseURI),{type:'module'});worker.onmessage=({data})=>finish(data.error?Error(data.error):null,data.buffer);worker.onerror=()=>finish(Error(words('Převodník DWG nelze načíst. Zkuste to znovu.','Could not load DWG converter. Please retry.','DWG-Konverter konnte nicht geladen werden.','Не удалось загрузить конвертер DWG. Повторите попытку.','Nie można wczytać konwertera DWG. Spróbuj ponownie.')));worker.postMessage({buffer},[buffer]);}catch(error){finish(error);}
  });
 };
 window.openGoomFile=async file=>{
  const user=await window.ensureFirebaseSession?.();if(!user||!user.emailVerified||window.isGoomReadOnly?.())return false;
  let extension=file.name.split('.').pop().toLowerCase();
  if(extension==='xcx'){
   const head=await file.slice(0,2048).text();extension=/^AC10\d\d/.test(head)?'dwg':/\bSECTION\b/.test(head)?'dxf':/^\s*[\[{]/.test(head)?'tech':'';
   if(!extension){await showAppAlert(words('Neznámý formát XCX. Použijte export DXF z CAD.','Unknown XCX format. Export DXF from your CAD application.','Unbekanntes XCX-Format. Bitte aus CAD als DXF exportieren.','Формат XCX не распознан. Экспортируйте чертёж из CAD в DXF.','Nieznany format XCX. Wyeksportuj rysunek z CAD do DXF.'));return false;}
   file=new File([file],file.name.replace(/\.xcx$/i,'.'+extension),{type:file.type});
  }
  if(['tech','bips','cctv'].includes(extension))return importFileContent(file);
  if(['pdf','dxf','dwg','png','jpg','jpeg','webp','bmp','gif','svg'].includes(extension))return window.importGoomDrawing(file);
  await showAppAlert(words('Tento formát není podporován.','This file format is not supported.','Dieses Dateiformat wird nicht unterstützt.','Этот формат файла не поддерживается.','Ten format pliku nie jest obsługiwany.'));return false;
 };
 const overlay=document.createElement('div');overlay.id='fileDropOverlay';overlay.hidden=true;document.body.append(overlay);let depth=0;
 const isFiles=e=>[...e.dataTransfer?.types||[]].includes('Files');const hide=()=>{depth=0;overlay.hidden=true;};
 document.addEventListener('dragenter',e=>{if(!isFiles(e))return;e.preventDefault();depth++;overlay.textContent=words('Pusťte soubor sem','Drop a file here','Datei hier ablegen','Перетащите файл сюда','Upuść plik tutaj');overlay.hidden=false;});
 document.addEventListener('dragover',e=>{if(!isFiles(e))return;e.preventDefault();e.dataTransfer.dropEffect='copy';});
 document.addEventListener('dragleave',e=>{if(!isFiles(e))return;if(--depth<=0)hide();});
 document.addEventListener('drop',async e=>{if(!isFiles(e))return;e.preventDefault();hide();const files=[...e.dataTransfer.files];if(files.length!==1){await showAppAlert(words('Otevřete jeden soubor najednou.','Open one file at a time.','Bitte eine Datei auf einmal öffnen.','Открывайте по одному файлу.','Otwieraj po jednym pliku.'));return;}try{await window.openGoomFile(files[0]);}catch(error){await showAppAlert(error.message);}});
 window.addEventListener('blur',hide);
})();
