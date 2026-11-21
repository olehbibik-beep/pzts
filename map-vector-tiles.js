// Bounded MVT decoder for mapped buildings, roads, vegetation and water.
function readMapVectorTile(buffer){
 const bytes=new Uint8Array(buffer);if(bytes.length>8000000)throw Error('Vector tile too large');let p=0,total=0;
 function uint(){let n=0,m=1;for(let i=0;i<10;i++){if(p>=bytes.length)throw Error('Truncated tile');const b=bytes[p++];n+=(b&127)*m;if(!(b&128))return n;m*=128;}throw Error('Invalid integer');}
 function msg(){const n=uint(),a=p,b=a+n;if(!Number.isSafeInteger(b)||b>bytes.length)throw Error('Invalid length');p=b;return[a,b];}
 function skip(w){if(w===0)uint();else if(w===1)p+=8;else if(w===2)msg();else if(w===5)p+=4;else throw Error('Invalid field');if(p>bytes.length)throw Error('Truncated field');}
 const str=([a,b])=>new TextDecoder().decode(bytes.subarray(a,b)),layers=[],out=[];
 while(p<bytes.length){const t=uint();if(t===26)layers.push(msg());else skip(t%8);}if(layers.length>100)throw Error('Too many layers');
 for(const[a,b]of layers){p=a;let name='',extent=4096;const features=[],keys=[],values=[];
  while(p<b){const t=uint();if(t===10)name=str(msg());else if(t===18)features.push(msg());else if(t===26)keys.push(str(msg()));else if(t===34){const[v,e]=msg(),next=p;p=v;let value='';while(p<e){const t=uint();if(t===10)value=str(msg());else skip(t%8);}values.push(value);p=next;}else if(t===40)extent=uint();else skip(t%8);if(p>b)throw Error('Invalid layer');}
  if(!['building','transportation','landcover','landuse','park','water'].includes(name)||extent<1||extent>65536)continue;
  for(const[c,d]of features.slice(0,10000)){p=c;let id=null,type=0,geometry=null,tags=[];
   while(p<d){const t=uint();if(t===8)id=uint();else if(t===24)type=uint();else if(t===34)geometry=msg();else if(t===18){const[v,e]=msg();p=v;while(p<e)tags.push(uint());if(p!==e)throw Error('Invalid tags');}else skip(t%8);if(p>d)throw Error('Invalid feature');}
   if(!geometry||![2,3].includes(type))continue;const props={};for(let i=0;i<tags.length;i+=2)if(['class','subclass'].includes(keys[tags[i]]))props[keys[tags[i]]]=String(values[tags[i+1]]||'').slice(0,40);
   p=geometry[0];let x=0,y=0,part=[],parts=[],points=0;
   while(p<geometry[1]){const cmd=uint(),op=cmd%8,n=Math.floor(cmd/8);if(n<1||n>30000||points+n>30000||total+n>150000)throw Error('Geometry limit');
    if(op===1||op===2){for(let k=0;k<n;k++){const dx=uint(),dy=uint();x+=dx%2?-(dx+1)/2:dx/2;y+=dy%2?-(dy+1)/2:dy/2;if(op===1&&part.length){if(type===2&&part.length>1)parts.push(part);part=[];}part.push([x,y]);points++;total++;}}
    else if(op===7&&type===3&&n===1){if(part.length>=3)parts.push(part);part=[];}else throw Error('Geometry command');if(p>geometry[1])throw Error('Invalid geometry');
   }if(type===2&&part.length>1)parts.push(part);if(parts.length)out.push({id,layer:name,type,extent,class:props.class||name,subclass:props.subclass||'',parts});
  }
 }return out;
}
function readMapBuildingTile(buffer){return readMapVectorTile(buffer).filter(f=>f.layer==='building'&&f.type===3).map(f=>({id:f.id,extent:f.extent,rings:f.parts}));}
