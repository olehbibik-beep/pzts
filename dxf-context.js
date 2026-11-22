// Editable, millimetre-based DXF output. Raster backgrounds are deliberately excluded.
class DXFPlanContext extends SVGPlanContext {
    constructor(width,height){super(width,height);this.records=[];this.vertices=0;this.omittedRasters=0;this.beginPath();}
    beginPath(){this.shapes=[];this.current=null;this.last=null;}
    moveTo(x,y){this.current={points:[{x,y}],closed:false,emitted:new Map()};this.shapes.push(this.current);this.last={x,y};}
    lineTo(x,y){if(!this.current)this.moveTo(x,y);else{this.current.points.push({x,y});this.current.circle=null;this.last={x,y};}}
    closePath(){if(this.current){this.current.closed=true;this.last=this.current.points[0];}}
    transformScale(){const m=this.matrix;return Math.max(Math.hypot(m.a,m.b),Math.hypot(m.c,m.d),.00001);}
    quadraticCurveTo(ax,ay,x,y){
        const p=this.last||{x:ax,y:ay};if(!this.current)this.moveTo(p.x,p.y);
        const steps=Math.min(1024,Math.max(8,Math.ceil((Math.hypot(ax-p.x,ay-p.y)+Math.hypot(x-ax,y-ay))*this.transformScale()/.25)));
        for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;this.lineTo(u*u*p.x+2*u*t*ax+t*t*x,u*u*p.y+2*u*t*ay+t*t*y);}
    }
    bezierCurveTo(ax,ay,bx,by,x,y){
        const p=this.last||{x:ax,y:ay};if(!this.current)this.moveTo(p.x,p.y);
        const steps=Math.min(1024,Math.max(10,Math.ceil((Math.hypot(ax-p.x,ay-p.y)+Math.hypot(bx-ax,by-ay)+Math.hypot(x-bx,y-by))*this.transformScale()/.25)));
        for(let i=1;i<=steps;i++){const t=i/steps,u=1-t;this.lineTo(u*u*u*p.x+3*u*u*t*ax+3*u*t*t*bx+t*t*t*x,u*u*u*p.y+3*u*u*t*ay+3*u*t*t*by+t*t*t*y);}
    }
    ellipse(x,y,rx,ry,rotation,start,end,ccw=false){
        const tau=Math.PI*2,raw=end-start;let span=ccw?-((start-end)%tau+tau)%tau:((end-start)%tau+tau)%tau;
        if(Math.abs(raw)>=tau-1e-8)span=ccw?-tau:tau;
        const first=!this.current,cos=Math.cos(rotation),sin=Math.sin(rotation);
        const point=a=>({x:x+cos*rx*Math.cos(a)-sin*ry*Math.sin(a),y:y+sin*rx*Math.cos(a)+cos*ry*Math.sin(a)});
        const a=point(start);if(first)this.moveTo(a.x,a.y);else this.lineTo(a.x,a.y);
        const steps=Math.min(2048,Math.max(8,Math.ceil(Math.abs(span)*Math.max(rx,ry)*this.transformScale()/.25)));
        for(let i=1;i<=steps;i++){const p=point(start+span*i/steps);this.lineTo(p.x,p.y);}
        if(first&&Math.abs(Math.abs(span)-tau)<1e-8){this.current.closed=true;if(Math.abs(rx-ry)<1e-8)this.current.circle={x,y,r:rx};}
    }
    color(style){
        const ctx=this.measureContext;ctx.fillStyle='#000000';ctx.fillStyle=style;const value=ctx.fillStyle;
        let r=0,g=0,b=0,alpha=1;
        if(value.startsWith('#')){const hex=value.slice(1);r=parseInt(hex.slice(0,2),16);g=parseInt(hex.slice(2,4),16);b=parseInt(hex.slice(4,6),16);}
        else{const parts=value.match(/[\d.]+/g)||[];[r,g,b]=parts.slice(0,3).map(Number);if(parts.length>3)alpha=Number(parts[3]);}
        return{value:(r<<16)|(g<<8)|b,neutral:Math.max(r,g,b)-Math.min(r,g,b)<12,alpha:alpha*this.globalAlpha};
    }
    point(x,y){const p=this.matrix.transformPoint({x,y});return{x:p.x,y:this.canvas.height-p.y};}
    record(shape,stroke){
        const color=this.color(stroke?this.strokeStyle:this.fillStyle);if(color.alpha<=.001||shape.points.length<2)return;
        const key=this.matrix.toString(),previous=shape.emitted.get(key),m=this.matrix;
        if(previous!==undefined){if(stroke){this.records[previous].color=color;this.records[previous].lineWidth=this.lineWidth*this.transformScale();}return;}
        const points=shape.points.map(p=>this.point(p.x,p.y));if(shape.closed&&Math.hypot(points[0].x-points.at(-1).x,points[0].y-points.at(-1).y)<.000001)points.pop();
        let circle=null;const sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d);
        if(shape.circle&&Math.abs(sx-sy)<.000001&&Math.abs(m.a*m.c+m.b*m.d)<.000001)circle={...this.point(shape.circle.x,shape.circle.y),r:shape.circle.r*sx};
        this.vertices+=points.length;if(this.vertices>250000||this.records.length>50000)throw new Error(typeof tr==='function'?tr('Výstup je příliš velký.'):'DXF output is too large.');
        shape.emitted.set(key,this.records.length);this.records.push({type:circle?'CIRCLE':'LWPOLYLINE',points,closed:shape.closed,circle,color,lineWidth:this.lineWidth*this.transformScale(),layer:color.alpha<.7?'GOOM_COVERAGE':'GOOM_GEOMETRY'});
    }
    fill(){for(const shape of this.shapes)this.record(shape,false);}
    stroke(){for(const shape of this.shapes)this.record(shape,true);}
    rectangle(x,y,w,h,stroke){const shape={points:[{x,y},{x:x+w,y},{x:x+w,y:y+h},{x,y:y+h}],closed:true,emitted:new Map()};this.record(shape,stroke);}
    fillRect(x,y,w,h){if(x===0&&y===0&&w===this.canvas.width&&h===this.canvas.height)return;this.rectangle(x,y,w,h,false);}
    strokeRect(x,y,w,h){this.rectangle(x,y,w,h,true);}
    strokePath(d){
        // Imported DXF and our renderer emit absolute SVG subpaths. Split them before sampling so no artificial links appear between them.
        for(const part of d.match(/M[^M]*/g)||[]){
            const shape={points:[],closed:/Z\s*$/i.test(part),emitted:new Map()};
            if(/^[MLZ\d\s.,eE+\-]+$/.test(part)){
                for(const match of part.matchAll(/[ML]([^MLZ]+)/g)){const n=(match[1].match(/[-+]?(?:\d*\.)?\d+(?:e[-+]?\d+)?/gi)||[]).map(Number);for(let i=0;i+1<n.length;i+=2)shape.points.push({x:n[i],y:n[i+1]});}
            }else{
                const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',part);const length=path.getTotalLength();
                const count=Math.min(12000,Math.max(2,Math.ceil(length*this.transformScale()/.2)));
                for(let i=0;i<=count;i++){const p=path.getPointAtLength(length*i/count);shape.points.push({x:p.x,y:p.y});}
            }
            this.record(shape,true);
        }
    }
    fillText(text,x,y){
        const m=this.matrix,sx=Math.hypot(m.a,m.b),sy=Math.hypot(m.c,m.d),size=Number(this.font.match(/([\d.]+)px/)?.[1])||10;
        const color=this.color(this.fillStyle);if(color.alpha<=.001)return;
        this.records.push({type:'TEXT',text:String(text).replace(/[\u0000-\u001f\u007f]/g,' ').slice(0,2000),point:this.point(x,y),height:Math.max(.05,size*sy*.75),widthFactor:Math.min(10,Math.max(.1,sx/(sy||1))),angle:(360-Math.atan2(m.b,m.a)*180/Math.PI)%360,
            horizontal:{center:1,right:2,end:2}[this.textAlign]||0,vertical:{middle:2,top:3,bottom:1}[this.textBaseline]||0,color,layer:'GOOM_TEXT'});
    }
    drawImage(){this.omittedRasters++;}
    toDXF(){
        const data=[],pair=(code,value)=>{if(typeof value==='number'){if(!Number.isFinite(value))throw new Error('Invalid DXF coordinate');value=Number(value.toFixed(6));}data.push(String(code),String(value));};
        pair(0,'SECTION');pair(2,'HEADER');pair(9,'$ACADVER');pair(1,'AC1021');pair(9,'$INSUNITS');pair(70,4);pair(9,'$MEASUREMENT');pair(70,1);
        pair(9,'$EXTMIN');pair(10,0);pair(20,0);pair(30,0);pair(9,'$EXTMAX');pair(10,this.canvas.width);pair(20,this.canvas.height);pair(30,0);pair(0,'ENDSEC');
        pair(0,'SECTION');pair(2,'TABLES');pair(0,'TABLE');pair(2,'LTYPE');pair(70,1);pair(0,'LTYPE');pair(2,'CONTINUOUS');pair(70,0);pair(3,'Solid line');pair(72,65);pair(73,0);pair(40,0);pair(0,'ENDTAB');
        pair(0,'TABLE');pair(2,'LAYER');pair(70,4);for(const name of ['0','GOOM_GEOMETRY','GOOM_TEXT','GOOM_COVERAGE']){pair(0,'LAYER');pair(2,name);pair(70,0);pair(62,7);pair(6,'CONTINUOUS');}pair(0,'ENDTAB');
        pair(0,'TABLE');pair(2,'STYLE');pair(70,1);pair(0,'STYLE');pair(2,'STANDARD');pair(70,0);pair(40,0);pair(41,1);pair(50,0);pair(71,0);pair(42,2.5);pair(3,'arial.ttf');pair(4,'');pair(0,'ENDTAB');pair(0,'ENDSEC');
        pair(0,'SECTION');pair(2,'BLOCKS');pair(0,'ENDSEC');pair(0,'SECTION');pair(2,'ENTITIES');
        let handle=256;
        for(const record of this.records){
            pair(0,record.type);pair(5,(handle++).toString(16).toUpperCase());pair(100,'AcDbEntity');pair(8,record.layer);pair(62,7);if(!record.color.neutral)pair(420,record.color.value);
            if(record.type==='TEXT'){
                pair(100,'AcDbText');pair(10,record.point.x);pair(20,record.point.y);pair(30,0);pair(40,record.height);pair(1,record.text);pair(50,record.angle);pair(41,record.widthFactor);pair(7,'STANDARD');pair(72,record.horizontal);pair(11,record.point.x);pair(21,record.point.y);pair(31,0);pair(100,'AcDbText');pair(73,record.vertical);
            }else if(record.type==='CIRCLE'){
                pair(100,'AcDbCircle');pair(10,record.circle.x);pair(20,record.circle.y);pair(30,0);pair(40,record.circle.r);
            }else{
                pair(370,Math.min(100,Math.max(5,Math.round(record.lineWidth*100))));pair(100,'AcDbPolyline');pair(90,record.points.length);pair(70,record.closed?1:0);
                for(const point of record.points){pair(10,point.x);pair(20,point.y);}
            }
        }
        pair(0,'ENDSEC');pair(0,'EOF');return data.join('\r\n')+'\r\n';
    }
}
function makePlanDXF(floor,options=planOutputOptions(floor)){
    const layout=planOutputLayout(floor,options),target=new DXFPlanContext(layout.widthMM,layout.heightMM);
    drawPlanOutput(target,floor,layout);
    if(!window.hasProAccess?.()){target.save();target.setTransform(1,0,0,1,0,0);target.font='4px sans-serif';target.fillStyle='#666666';target.textAlign='right';target.textBaseline='bottom';target.fillText('GooM · Free',layout.widthMM-8,layout.heightMM-4);target.restore();}
    return{dxf:target.toDXF(),layout,omittedRasters:target.omittedRasters};
}
