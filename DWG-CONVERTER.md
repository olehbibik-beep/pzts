# DWG import

The standalone `dwg-converter-worker.js` is GPL-3.0-or-later. It converts DWG bytes to DXF bytes locally and does not upload drawings. The editor loads pinned @mlightcad/libredwg-web@0.9.3 from jsDelivr when a DWG is opened.

Upstream license: [GPL-3.0](LICENSE_LIBREDWG.txt).
Exact corresponding source, including Emscripten build instructions: https://github.com/mlightcad/libredwg-web/tree/c8d0bc8f4c0dfac6fcde9f8347867ed1c35ffad0
Source archive: https://github.com/mlightcad/libredwg-web/archive/c8d0bc8f4c0dfac6fcde9f8347867ed1c35ffad0.tar.gz
Build instructions: bindings/javascript/README.md and bindings/javascript/script/build-wasm.mjs in that archive.

No project-wide license change is made by this notice. Keep the converter source and upstream license/source notices when redistributing it.

Import supports the 2D entities understood by the existing DXF reader. External references, proprietary objects, embedded images and 3D solids may be omitted; unsupported entity types are reported. Original DWG is never overwritten.
