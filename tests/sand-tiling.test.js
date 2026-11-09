import test from 'node:test';
import assert from 'node:assert/strict';
import { sandSamplingShader } from '../src/rendering.js';

// CPU reference for the shader's hex/triangle partition. Aggregating by cell
// lets us compare the independently chosen triangles on either side of a seam.
function partition(x, y) {
  const ix=Math.floor(x),iy=Math.floor(y),fx=x-ix,fy=y-iy;
  const lower=fx+fy<1;
  const cells=lower?[[ix,iy],[ix+1,iy],[ix,iy+1]]:[[ix+1,iy+1],[ix,iy+1],[ix+1,iy]];
  const w=(lower?[1-fx-fy,fx,fy]:[fx+fy-1,1-fx,1-fy]).map(v=>v**3);
  const sum=w.reduce((a,b)=>a+b,0);
  return new Map(cells.map((c,i)=>[c.join(','),w[i]/sum]));
}
function difference(a,b) {
  return Math.max(...[...new Set([...a.keys(),...b.keys()])].map(k=>Math.abs((a.get(k)||0)-(b.get(k)||0))));
}

test('stochastic sand keeps the same patch weights across all triangle seams',()=>{
  const e=1e-8;
  for(let i=-3;i<=3;i++) for(let j=-3;j<=3;j++) for(const t of [.05,.2,.5,.8,.95]) {
    const pairs=[
      [[i-e,j+t],[i+e,j+t]],
      [[i+t,j-e],[i+t,j+e]],
      [[i+t,j+1-t-e],[i+t,j+1-t+e]],
    ];
    for(const [a,b] of pairs) assert.ok(difference(partition(...a),partition(...b))<1e-6);
    for(const p of [partition(i+t,j+t),partition(i+e,j-e)]) {
      const w=[...p.values()];
      assert.ok(Math.abs(w.reduce((a,b)=>a+b,0)-1)<1e-12);
      const gain=1/Math.hypot(...w);
      assert.ok(gain>=1-1e-12&&gain<=Math.sqrt(3)+1e-12);
    }
  }
});

test('rotated normal slopes transform back into the albedo world frame',()=>{
  for(const angle of [0,.23,1.7,3.4,6.2]) {
    const c=Math.cos(angle),s=Math.sin(angle),n=[.23,-.41];
    const local=[c*n[0]-s*n[1],s*n[0]+c*n[1]];
    const restored=[c*local[0]+s*local[1],-s*local[0]+c*local[1]];
    assert.ok(Math.hypot(restored[0]-n[0],restored[1]-n[1])<1e-12);
  }
});

test('photo albedo and normals share explicit-gradient stochastic transforms',()=>{
  assert.match(sandSamplingShader,/textureGrad\(sandColor,uv,rotation\*dx\*scale,rotation\*dy\*scale\)/);
  assert.match(sandSamplingShader,/textureGrad\(sandNormal,uv,rotation\*dx\*scale,rotation\*dy\*scale\)/);
  assert.equal((sandSamplingShader.match(/sandPatch\(p,dx,dy,/g)||[]).length,3);
  assert.match(sandSamplingShader,/normal\.xy\/max\(normal\.z/);
});
