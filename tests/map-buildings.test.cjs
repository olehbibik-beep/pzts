const{test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs');
const scope=vm.createContext({URL,fetch,AbortSignal});vm.runInContext(fs.readFileSync('map-buildings.js','utf8'),scope);
test('building projection clips footprints and preserves straight closed polygons',()=>{
    const z=19,size=256*2**z,lat=50.087,lon=14.421,sine=Math.sin(lat*Math.PI/180),center={x:(lon+180)/360*size,y:(.5-Math.log((1+sine)/(1-sine))/(4*Math.PI))*size};
    scope.view={zoom:z,center,width:1684,height:1191};scope.data={elements:[{type:'way',geometry:[{lat:50.0868,lon:14.4208},{lat:50.0868,lon:14.4212},{lat:50.0871,lon:14.4212},{lat:50.0871,lon:14.4208},{lat:50.0868,lon:14.4208}]},{type:'way',geometry:[{lat:50.1,lon:14.42},{lat:50.1,lon:14.43},{lat:50.11,lon:14.43},{lat:50.1,lon:14.42}]}]};
    const result=vm.runInContext('projectMapBuildings(data,view)',scope);assert.equal(result.rings.length,1);assert.equal(result.rings[0].length,4);assert.ok(result.rings[0].every(p=>p[0]>=0&&p[0]<=1684&&p[1]>=0&&p[1]<=1191));
    const clipped=vm.runInContext('clipMapBuilding([[-5,3],[5,3],[5,8],[-5,8]],6,6)',scope);assert.equal(clipped.length,4);assert.ok(clipped.every(p=>p[0]>=0&&p[0]<=6&&p[1]>=0&&p[1]<=6));
});
test('saved outlines reject malformed and excessive coordinates',()=>{
    assert.equal(vm.runInContext('sanitizeMapBuildings({width:100,height:100,rings:[[[1,1],[2,2],[NaN,3]]]})',scope),null);
    assert.equal(vm.runInContext('sanitizeMapBuildings({width:100,height:100,rings:[[[1,1],[102,2],[1,3]]]})',scope),null);
    assert.equal(vm.runInContext('sanitizeMapBuildings({width:100,height:100,rings:[[[1,1],[2,2],[1,3]]]})',scope).rings.length,1);
});

test('scene input rejects invalid coordinates and clips roads to the saved view',()=>{scope.scene={width:100,height:100,roads:[{points:[[0,0],[100,50]],class:'secondary'},{points:[[0,0],[101,0]],class:'invalid'}],green:[{rings:[[[0,0],[80,0],[0,90]]],class:'wood'}]};const result=vm.runInContext('sanitizeMapScene(scene)',scope);assert.equal(result.roads.length,1);assert.equal(result.green.length,1);assert.equal(result.water.length,0);const road=vm.runInContext('clipMapRoad([[-20,20],[120,20]],100,100)',scope);assert.equal(JSON.stringify(road),'[[[0,20],[100,20]]]');});
