import { Simulation } from './simulation.js';
const sim = new Simulation(192,60);
let paused=false, last=performance.now(), debt=0, frame=0, buffer=null, busy=false;
function snapshot(cost=0){
  if(!buffer)buffer=new Float32Array(sim.count*8);
  sim.pack(buffer);const stats=sim.stats();
  self.postMessage({type:'frame',buffer:buffer.buffer,n:sim.n,size:sim.size,stats,cost,paused},[buffer.buffer]);buffer=null;
}
self.onmessage=({data:m})=>{
  if(m.type==='recycle')buffer=new Float32Array(m.buffer);
  if(m.type==='brush')sim.brush=m.brush;
  if(m.type==='options')Object.assign(sim.options,m.options);
  if(m.type==='pause'){paused=m.paused;debt=0;last=performance.now();snapshot();}
  if(m.type==='pour'){sim.largePour(m.x,m.z);if(paused)snapshot();}
  if(m.type==='reset'){sim.reset();debt=0;last=performance.now();snapshot();}
  if(m.type==='edit' && paused){const b=m.brush;sim.applyBrush(b.x,b.z,b.radius,b.strength*.035*(b.mode==='water'?2.4:1.4),b.mode);snapshot();}
};
function tick(){
  const now=performance.now();debt=Math.min(.12,debt+(now-last)/1000);last=now;
  if(!paused){
    const start=performance.now();let steps=0;
    while(debt>=sim.timestep() && steps<4){const dt=sim.timestep();sim.step(dt);debt-=dt;steps++;if(performance.now()-start>19)break;}
    if(steps)snapshot(performance.now()-start);
  }else debt=0;
  frame++;setTimeout(tick,paused?40:0);
}
snapshot();tick();
