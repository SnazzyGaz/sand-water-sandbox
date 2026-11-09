import { Simulation } from '../src/simulation.js';
const s=new Simulation(192,60);const initial=s.stats();const start=performance.now();const steps=+process.env.STEPS||500;
for(let i=0;i<steps;i++)s.step();const a=s.stats();console.log({grid:'192 × 192',steps,msPerWaterStep:(performance.now()-start)/steps,simulatedSeconds:a.time,waterBalanceError:a.surface+a.pore+a.drained-a.added-initial.surface-initial.pore,solidBalanceError:a.sand+a.sediment+a.sedimentOut-initial.sand,stats:a});
