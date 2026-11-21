function number(value){const bytes=[];do{const part=value%128;value=Math.floor(value/128);bytes.push(part+(value?128:0));}while(value);return bytes;}
function field(tag,bytes){return [...number(tag),...number(bytes.length),...bytes];}
function tile(x,y,z=14){
 const sine=Math.sin(50.087*Math.PI/180),n=2**z,cx=Math.round(((14.421+180)/360*n-x)*4096),cy=Math.round(((.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*n-y)*4096),zig=n=>n<0?-n*2-1:n*2;
 const polygon=(x,y,w,h)=>[9,zig(x),zig(y),26,zig(w),0,0,zig(h),zig(-w),0,15].flatMap(number);
 function layer(name,type,geometry,kind,id){const feature=[8,...number(id),...field(18,[0,0]),24,type,...field(34,geometry)];return field(26,[...field(10,[...Buffer.from(name)]),...field(18,feature),...field(26,[...Buffer.from('class')]),...field(34,field(10,[...Buffer.from(kind)])),40,...number(4096),120,2]);}
 return Buffer.from([...layer('building',3,polygon(cx-20,cy-20,40,40),'house',123),...layer('transportation',2,[9,zig(cx-160),zig(cy+70),10,zig(320),0].flatMap(number),'secondary',124),...layer('landcover',3,polygon(cx-180,cy-150,110,180),'wood',125),...layer('water',3,polygon(cx+100,cy-120,40,90),'lake',126)]);
}module.exports={tile};
