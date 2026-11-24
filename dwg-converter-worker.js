// SPDX-License-Identifier: GPL-3.0-or-later
// Standalone DWG-to-DXF converter. LibreDWG source and build instructions:
// https://github.com/mlightcad/libredwg-web/tree/master/bindings/javascript
// Pinned upstream package: @mlightcad/libredwg-web@0.9.3 (GPL-3.0).
self.onmessage=async({data})=>{
 try{
  if(!(data?.buffer instanceof ArrayBuffer)||data.buffer.byteLength>64*1024*1024)throw Error('Invalid DWG input.');
  const url='https://cdn.jsdelivr.net/npm/@mlightcad/libredwg-web@0.9.3/wasm/';
  const [{default:createModule},response]=await Promise.all([import(url+'libredwg-web.js'),fetch(url+'libredwg-web.wasm')]);
  if(!response.ok)throw Error('DWG converter could not load.');
  const module=await createModule({wasmBinary:new Uint8Array(await response.arrayBuffer()),print:()=>{},printErr:()=>{}});
  module.FS.writeFile('/input.dwg',new Uint8Array(data.buffer));
  try{const code=module.dwg_write_dxf('/input.dwg','/output.dxf');if(code>=128||code<0)throw Error('DWG conversion failed ('+code+').');const bytes=module.FS.readFile('/output.dxf').slice();const text=new TextDecoder().decode(bytes);if(!/\bSECTION\b/.test(text)||!/\bEOF\s*$/.test(text))throw Error('DWG did not produce a valid DXF drawing.');self.postMessage({warning:code||null,buffer:bytes.buffer},[bytes.buffer]);}
  finally{for(const file of ['/input.dwg','/output.dxf'])try{module.FS.unlink(file);}catch{}}
 }catch(error){self.postMessage({error:String(error.message||error).slice(0,300)});}
};
