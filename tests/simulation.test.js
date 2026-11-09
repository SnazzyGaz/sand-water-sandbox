import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, cohesion } from '../src/simulation.js';
const quiet=s=>{s.options.spring=false;s.options.underdrain=false;s.options.erosion=0;return s;};
const sum=a=>a.reduce((s,x)=>s+x,0);
const close=(a,b,tol)=>assert.ok(Math.abs(a-b)<tol,`${a} != ${b}, error ${a-b}`);
test('piecewise capillary cohesion rises and collapses',()=>{
  assert.equal(cohesion(0),0);assert.ok(cohesion(.2)>cohesion(.02));assert.ok(cohesion(.25)>=cohesion(.2));assert.equal(cohesion(.33),0);assert.equal(cohesion(.9),0);
});
test('brush edits sand, never the static bed, and cannot make negative columns',()=>{
  const s=quiet(new Simulation(32,16));const H=s.H.slice(),h=sum(s.sand);
  s.applyBrush(0,0,3,2,'raise');assert.ok(sum(s.sand)>h);assert.deepEqual(s.H,H);
  s.applyBrush(0,0,3,1000,'lower');assert.ok(s.sand.every(x=>x>=.024));
  const w=sum(s.water);s.applyBrush(0,0,2,1,'water');assert.ok(sum(s.water)>w);
  s.applyBrush(0,0,20,100,'drain');assert.ok(s.water.every(x=>x>=0));
});
test('surface flow is conservative including tracked boundary drains',()=>{
  const s=quiet(new Simulation(40,16,false));s.sand.fill(1);s.water[20*40+20]=1;
  const initial=s.stats();for(let k=0;k<180;k++)s.step();const a=s.stats();
  close(a.surface+a.pore+a.drained,initial.surface,1e-5);
  assert.ok(a.pore>0);assert.ok(s.water.filter((x,i)=>x+s.pore[i]>.00001).length>10);assert.ok(s.water.every(x=>Number.isFinite(x)&&x>=0));
});
test('Darcy/capillary seepage crosses pore cells with no surface flow',()=>{
  const s=quiet(new Simulation(32,12,false));s.sand.fill(2);s.pore[16*32+16]=.8;
  for(let k=0;k<100;k++)s.seep(.02);
  close(sum(s.pore),.8,1e-5);assert.ok(s.pore[16*32+17]>.01);assert.equal(sum(s.water),0);
});
test('moist sand holds a slope that dry sand yields on; saturated sand slumps fastest',()=>{
  const speeds=[];
  for(const phi of [0,.22,1/3]){
    const s=quiet(new Simulation(32,8,false));
    for(let y=0;y<32;y++)for(let x=0;x<32;x++){const i=y*32+x;s.sand[i]=2+.70*x*s.dx;s.pore[i]=s.sand[i]*phi/(1-phi);}
    s.sandStep(.004);speeds.push(sum(s.su.map(Math.abs)));
  }
  console.log('slope test dry / moist / saturated speed totals',speeds);
  assert.ok(speeds[1]<speeds[0]*.1);assert.ok(speeds[2]>speeds[0]*2);
});
test('moving sand transfers momentum back to water',()=>{
  const s=quiet(new Simulation(24,12,false));s.sand.fill(1);s.water.fill(.5);s.su.fill(1.5);
  s.sandStep(.005);assert.ok(sum(s.u)>0);assert.ok(s.su[12*24+12]<1.5);
});
test('pure rotation remains uncompressed under polar constitutive update',()=>{
  const s=quiet(new Simulation(12,12,false));s.sand.fill(1);s.theta.fill(.8);
  s.constitutive(.005);for(let i=0;i<s.count;i++){close(s.P00[i],1,1e-6);close(s.P11[i],1,1e-6);close(s.P01[i],0,1e-6);}
});
test('erosion transports solid mass and deposits it downstream; long run stays finite',()=>{
  const s=new Simulation(64,60);const initial=s.stats();let t=0;
  while(t<15){const dt=s.timestep();s.step(dt);t+=dt;}
  const a=s.stats();assert.ok(a.eroded>.1);assert.ok(a.deposited>.01);assert.ok(a.maxChange>.05);
  close(a.sand+a.sediment+a.sedimentOut,initial.sand,0.02);
  close(a.surface+a.pore+a.drained-a.added,initial.surface+initial.pore,.01);
  for(const key of ['sand','water','pore','sediment','P00','P11'])assert.ok(s[key].every(x=>Number.isFinite(x)&&x>=0),key);
});
test('large pour adds 45 m³ independent of resolution',()=>{for(const n of [32,64,192]){const s=new Simulation(n,60,false);const a=s.stats();s.largePour();close(s.stats().surface-a.surface,45,.001);}});

test('a lake at rest on a non-flat bed stays at rest',()=>{
  const s=quiet(new Simulation(40,16,false));
  for(let y=0;y<40;y++)for(let x=0;x<40;x++){const i=y*40+x;const r=Math.hypot(x-20,y-20);s.sand[i]=.5+r*.08;s.water[i]=Math.max(0,1.3-s.sand[i]);}
  const old=s.water.slice();for(let k=0;k<200;k++)s.surfaceFlow(.01);
  let max=0;for(let i=0;i<s.count;i++)max=Math.max(max,Math.abs(s.water[i]-old[i]));assert.ok(max<.0001,`lake drift ${max}`);
});
