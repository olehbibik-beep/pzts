// Minimal bounded MVT reader: only polygon geometry from the building layer.
function readMapBuildingTile(buffer){
    const bytes=new Uint8Array(buffer);if(bytes.length>8000000)throw Error('Vector tile too large');
    let position=0;
    function uint(){let value=0,multiplier=1;for(let i=0;i<10;i++){if(position>=bytes.length)throw Error('Truncated vector tile');const b=bytes[position++];value+=(b&127)*multiplier;if(!(b&128))return value;multiplier*=128;}throw Error('Invalid vector integer');}
    function message(){const length=uint(),start=position,end=start+length;if(!Number.isSafeInteger(end)||end>bytes.length)throw Error('Invalid vector length');position=end;return[start,end];}
    function skip(wire){if(wire===0)uint();else if(wire===1)position+=8;else if(wire===2)message();else if(wire===5)position+=4;else throw Error('Unsupported vector field');if(position>bytes.length)throw Error('Truncated vector field');}
    const layerRanges=[];while(position<bytes.length){const tag=uint();if(tag===26)layerRanges.push(message());else skip(tag%8);}
    const result=[];
    for(const[start,end]of layerRanges){
        position=start;let name='',extent=4096;const features=[];
        while(position<end){const tag=uint();if(tag===10){const[a,b]=message();name=new TextDecoder().decode(bytes.subarray(a,b));}else if(tag===18)features.push(message());else if(tag===40)extent=uint();else skip(tag%8);}
        if(name!=='building'||extent<1||extent>65536)continue;
        for(const[a,b]of features.slice(0,10000)){
            position=a;let type=0,id=null,geometry=null;while(position<b){const tag=uint();if(tag===8)id=uint();else if(tag===24)type=uint();else if(tag===34)geometry=message();else skip(tag%8);}
            if(type!==3||!geometry)continue;
            position=geometry[0];let x=0,y=0,ring=[],rings=[],points=0;
            while(position<geometry[1]){const instruction=uint(),command=instruction%8,count=Math.floor(instruction/8);if(count<1||count>30000||points+count>30000)throw Error('Invalid vector geometry');
                if(command===1||command===2){for(let n=0;n<count;n++){const dx=uint(),dy=uint();x+=dx%2?-(dx+1)/2:dx/2;y+=dy%2?-(dy+1)/2:dy/2;if(command===1&&ring.length){ring=[];}ring.push([x,y]);points++;}}
                else if(command===7){if(ring.length>=3)rings.push(ring);ring=[];}else throw Error('Invalid polygon command');
            }
            if(rings.length)result.push({id,extent,rings});
        }
    }return result;
}
