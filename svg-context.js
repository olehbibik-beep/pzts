// Canvas-compatible recorder for our own symbols, cable paths and text. No foreignObject or page screenshots.
class SVGPlanContext {
    constructor(width,height) {
        this.canvas={width,height};this.elements=[];this.path='';this.stack=[];this.matrix=new DOMMatrix();
        this.fillStyle='#000';this.strokeStyle='#000';this.lineWidth=1;this.lineCap='butt';this.lineJoin='miter';
        this.globalAlpha=1;this.font='10px sans-serif';this.textAlign='start';this.textBaseline='alphabetic';this.dash=[];
        this.measureContext=document.createElement('canvas').getContext('2d');
    }
    escape(value){return String(value).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));}
    transformAttribute(){const m=this.matrix;return `transform="matrix(${[m.a,m.b,m.c,m.d,m.e,m.f].join(' ')})" opacity="${this.globalAlpha}"`;}
    save(){const props=['fillStyle','strokeStyle','lineWidth','lineCap','lineJoin','globalAlpha','font','textAlign','textBaseline','shadowBlur','shadowColor'];const state={matrix:DOMMatrix.fromMatrix(this.matrix),dash:[...this.dash]};for(const p of props)state[p]=this[p];this.stack.push(state);}
    restore(){const state=this.stack.pop();if(state)Object.assign(this,state);}
    translate(x,y){this.matrix=this.matrix.translate(x,y);}
    scale(x,y){this.matrix=this.matrix.scale(x,y);}
    rotate(angle){this.matrix=this.matrix.rotate(angle*180/Math.PI);}
    setTransform(a,b,c,d,e,f){this.matrix=new DOMMatrix([a,b,c,d,e,f]);}
    setLineDash(dash){this.dash=[...dash];}
    beginPath(){this.path='';this.last=null;}
    moveTo(x,y){this.path+=`M${x} ${y}`;this.last={x,y};}
    lineTo(x,y){this.path+=`${this.last?'L':'M'}${x} ${y}`;this.last={x,y};}
    closePath(){this.path+='Z';}
    quadraticCurveTo(a,b,x,y){this.path+=`Q${a} ${b} ${x} ${y}`;this.last={x,y};}
    bezierCurveTo(a,b,c,d,x,y){this.path+=`C${a} ${b} ${c} ${d} ${x} ${y}`;this.last={x,y};}
    arc(x,y,r,start,end,ccw=false){
        const tau=Math.PI*2,raw=end-start;
        let span=ccw?-((start-end)%tau+tau)%tau:((end-start)%tau+tau)%tau;
        if(Math.abs(raw)>=tau-1e-8)span=ccw?-tau:tau;
        const sx=x+r*Math.cos(start),sy=y+r*Math.sin(start);
        if(this.last)this.lineTo(sx,sy);else this.moveTo(sx,sy);
        const count=Math.max(1,Math.ceil(Math.abs(span)/Math.PI));
        for(let i=1;i<=count;i++){const a=start+span*i/count;const ex=x+r*Math.cos(a),ey=y+r*Math.sin(a);this.path+=`A${r} ${r} 0 0 ${ccw?0:1} ${ex} ${ey}`;this.last={x:ex,y:ey};}
    }
    roundRect(x,y,w,h,r){r=Math.min(Number(r)||0,w/2,h/2);this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath();}
    emitPath(d,fill,stroke){this.elements.push(`<path d="${this.escape(d)}" ${this.transformAttribute()} fill="${fill?this.escape(this.fillStyle):'none'}" stroke="${stroke?this.escape(this.strokeStyle):'none'}" stroke-width="${this.lineWidth}" stroke-linecap="${this.lineCap}" stroke-linejoin="${this.lineJoin}"${this.dash.length?` stroke-dasharray="${this.dash.join(' ')}"`:''}/>`);}
    fill(){this.emitPath(this.path,true,false);}
    stroke(){this.emitPath(this.path,false,true);}
    strokePath(d){this.emitPath(d,false,true);}
    fillRect(x,y,w,h){this.elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${this.transformAttribute()} fill="${this.escape(this.fillStyle)}"/>`);}
    strokeRect(x,y,w,h){this.elements.push(`<rect x="${x}" y="${y}" width="${w}" height="${h}" ${this.transformAttribute()} fill="none" stroke="${this.escape(this.strokeStyle)}" stroke-width="${this.lineWidth}"/>`);}
    measureText(text){this.measureContext.font=this.font;return this.measureContext.measureText(text);}
    fillText(text,x,y){const anchor={center:'middle',right:'end',end:'end'}[this.textAlign]||'start';const baseline={middle:'central',top:'text-before-edge',bottom:'text-after-edge'}[this.textBaseline]||'alphabetic';this.elements.push(`<text x="${x}" y="${y}" ${this.transformAttribute()} fill="${this.escape(this.fillStyle)}" style="font:${this.escape(this.font)}" text-anchor="${anchor}" dominant-baseline="${baseline}">${this.escape(text)}</text>`);}
    drawImage(image,...args){
        const src=image instanceof HTMLCanvasElement?image.toDataURL('image/png'):image.src;
        if(args.length===8){const [sx,sy,sw,sh,x,y,w,h]=args;this.elements.push(`<g ${this.transformAttribute()}><svg x="${x}" y="${y}" width="${w}" height="${h}" viewBox="${sx} ${sy} ${sw} ${sh}" preserveAspectRatio="none" overflow="hidden"><image width="${image.naturalWidth||image.width}" height="${image.naturalHeight||image.height}" href="${this.escape(src)}"/></svg></g>`);}
        else{const [x,y,w=image.width,h=image.height]=args;this.elements.push(`<image x="${x}" y="${y}" width="${w}" height="${h}" ${this.transformAttribute()} href="${this.escape(src)}"/>`);}
    }
    toSVG(){return `<svg xmlns="http://www.w3.org/2000/svg" width="${this.canvas.width}" height="${this.canvas.height}" viewBox="0 0 ${this.canvas.width} ${this.canvas.height}">${this.elements.join('')}</svg>`;}
}
