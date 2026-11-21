function number(value){const bytes=[];do{const part=value%128;value=Math.floor(value/128);bytes.push(part+(value?128:0));}while(value);return bytes;}
function field(tag,bytes){return [...number(tag),...number(bytes.length),...bytes];}
function tile(x,y,z=14){
    const sine=Math.sin(50.087*Math.PI/180),n=2**z,cx=Math.round(((14.421+180)/360*n-x)*4096),cy=Math.round(((.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*n-y)*4096),zig=n=>n<0?-n*2-1:n*2;
    const geometry=[9,zig(cx-20),zig(cy-20),26,80,0,0,80,79,0,15].flatMap(number);
    const feature=[8,123,24,3,...field(34,geometry)],layer=[...field(10,[...Buffer.from('building')]),...field(18,feature),40,...number(4096),120,2];
    return Buffer.from(field(26,layer));
}
module.exports={tile};
