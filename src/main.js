import './style.css';
import { SandboxRenderer } from './rendering.js';
const $=id=>document.getElementById(id);
function showError(message){$('error').hidden=false;$('error').textContent=message;console.error(message);}
try {
  const canvas=$('scene'), display=new SandboxRenderer(canvas);
  const worker=new Worker(new URL('./worker.js',import.meta.url),{type:'module'});
  let mode='raise',paused=false,down=false,shift=false,hit=null,pointer=null,ready=false;
  let radius=2.4,strength=.6,lastProbe=0,lastStats=0,frames=0,lastFPS=performance.now(),fps=0;
  let lastTime=0,lastSimWall=performance.now(),simRate=1,stats={},lastCost=0;
  const post=(m)=>worker.postMessage(m);
  const invert={raise:'lower',lower:'raise',water:'drain',drain:'water'};
  const labels={raise:'raise sand',lower:'lower sand',water:'pour water',drain:'remove surface water'};
  const colors={raise:'#dcebb4',lower:'#f6b787',water:'#a3e3e5',drain:'#c1b5f1'};
  function dismiss(){$('intro').style.opacity=0;$('intro').style.pointerEvents='none';}
  $('dismiss').onclick=dismiss;
  function activeMode(){return shift?invert[mode]:mode;}
  function updateBrush(){
    display.uniforms.brushVisible.value=hit?1:0;
    if(hit)display.uniforms.brush.value.set(hit.x,hit.z,radius);
    display.uniforms.brushColor.value.set(colors[activeMode()]);
    $('mode-label').textContent=labels[activeMode()];
    const brush=down&&hit?{x:hit.x,z:hit.z,radius,strength,mode:activeMode()}:null;
    post({type:'brush',brush});
  }
  function selectMode(m){mode=m;document.querySelectorAll('.mode').forEach(b=>{b.classList.toggle('active',b.dataset.mode===m);b.setAttribute('aria-pressed',String(b.dataset.mode===m));});updateBrush();}
  document.querySelectorAll('.mode').forEach(b=>b.onclick=()=>selectMode(b.dataset.mode));
  function updateRadius(){radius=+$('radius').value;$('radius-value').textContent=`${radius.toFixed(1)} m`;updateBrush();}
  $('radius').oninput=updateRadius;
  $('strength').oninput=()=>{strength=+$('strength').value/100;$('strength-value').textContent=`${Math.round(strength*100)}%`;updateBrush();};
  function setPaused(p){paused=p;$('pause').innerHTML=p?'Resume <kbd>Space</kbd>':'Pause <kbd>Space</kbd>';$('live').textContent=p?'SIMULATION PAUSED':'COUPLED SIMULATION';post({type:'pause',paused});updateBrush();}
  $('pause').onclick=()=>setPaused(!paused);
  $('reset').onclick=()=>{down=false;hit=null;post({type:'brush',brush:null});post({type:'reset'});};
  $('camera').onclick=()=>display.frameScene();
  $('flood').onclick=()=>{post({type:'pour',x:hit?.x??0,z:hit?.z??-18});dismiss();};
  $('spring').onchange=()=>post({type:'options',options:{spring:$('spring').checked}});
  $('underdrain').onchange=()=>post({type:'options',options:{underdrain:$('underdrain').checked}});
  $('erosion').oninput=()=>{const v=+$('erosion').value;$('erosion-value').textContent=`${v.toFixed(1)}×`;post({type:'options',options:{erosion:v}});};
  const keys=['Light sand → damp → dark saturated banks','Ochre: dry · green: moist · blue: saturated','Orange: removed · green: deposited · ±0.3 m','Dark: still · teal: sheet flow · amber: 3.5 m/s'];
  $('view').onchange=()=>{const m=+$('view').value;display.uniforms.viewMode.value=m;$('view-key').textContent=keys[m];};
  $('collapse').onclick=()=>{const body=$('tools-body');body.hidden=!body.hidden;$('collapse').textContent=body.hidden?'+':'−';};
  function locate(e){if(!ready)return;pointer={x:e.clientX,y:e.clientY};hit=display.pick(e.clientX,e.clientY);updateBrush();}
  canvas.addEventListener('contextmenu',e=>e.preventDefault());
  canvas.addEventListener('pointermove',e=>{if(e.pointerType!=='touch')locate(e);});
  canvas.addEventListener('pointerdown',e=>{
    if(e.button!==0||e.pointerType==='touch')return;
    e.preventDefault();e.stopImmediatePropagation();canvas.setPointerCapture(e.pointerId);down=true;shift=e.shiftKey;locate(e);dismiss();
    if(paused&&hit)post({type:'edit',brush:{...hit,radius,strength,mode:activeMode()}});
  },true);
  function release(){if(down){down=false;post({type:'brush',brush:null});}}
  window.addEventListener('pointerup',release);canvas.addEventListener('lostpointercapture',release);
  canvas.addEventListener('pointerleave',()=>{if(!down){hit=null;pointer=null;updateBrush();}});
  window.addEventListener('blur',()=>{release();shift=false;updateBrush();});
  document.addEventListener('visibilitychange',()=>{if(document.hidden)release();});
  window.addEventListener('keydown',e=>{
    if(e.target.matches('input,select'))return;
    shift=e.shiftKey;
    if(e.key==='Shift')updateBrush();
    if(e.code==='Space'){e.preventDefault();if(!e.repeat)setPaused(!paused);}
    if(e.key==='1')selectMode('raise');if(e.key==='2')selectMode('lower');if(e.key==='3')selectMode('water');if(e.key==='4')selectMode('drain');
    if(e.key.toLowerCase()==='r'&&!e.repeat)$('reset').click();
    if(e.key.toLowerCase()==='f')display.frameScene();
    if(e.key==='['||e.key===']'){$('radius').value=String(Math.max(.6,Math.min(7,radius+(e.key==='['?-.3:.3))));updateRadius();}
  });
  window.addEventListener('keyup',e=>{shift=e.shiftKey;if(e.key==='Shift')updateBrush();});
  window.addEventListener('resize',()=>display.resize());
  worker.onerror=e=>showError(`Simulation could not start: ${e.message}. Try a current WebGL2-capable desktop browser.`);
  worker.onmessage=({data:m})=>{
    if(m.type!=='frame')return;const a=new Float32Array(m.buffer);display.update(a);post({type:'recycle',buffer:m.buffer});ready=true;
    stats=m.stats;if(stats.time<lastTime){lastTime=stats.time;lastSimWall=performance.now();}lastCost=m.cost||lastCost;
    const now=performance.now();if(now-lastSimWall>1000){simRate=(stats.time-lastTime)/((now-lastSimWall)/1000);lastTime=stats.time;lastSimWall=now;}
  };
  function animate(now){
    requestAnimationFrame(animate);frames++;
    if(now-lastFPS>750){fps=Math.round(frames*1000/(now-lastFPS));frames=0;lastFPS=now;if(fps<28&&now>2500){const ratio=display.renderer.getPixelRatio();if(ratio>.65){display.renderer.setPixelRatio(Math.max(.65,ratio*.82));display.resize();}}}
    if(pointer&&now-lastProbe>80){hit=display.pick(pointer.x,pointer.y);updateBrush();lastProbe=now;
      if(hit){const state=hit.saturation>.86?'SATURATED / LOW COHESION':hit.saturation>.08?'MOIST / CAPILLARY COHESION':hit.wet>.2?'DAMP SURFACE':'DRY / FRICTIONAL SAND';$('probe-state').textContent=state;$('probe-values').textContent=`${Math.round(hit.saturation*100)}% pore saturation · ${hit.water.toFixed(2)} m water · ${hit.speed.toFixed(2)} m/s`;}
      if(paused&&down&&hit)post({type:'edit',brush:{...hit,radius,strength,mode:activeMode()}});
    }
    if(now-lastStats>350 && ready){
      $('water-stat').textContent=`${stats.surface.toFixed(1)} m³`;$('pore-stat').textContent=`${stats.pore.toFixed(1)} m³`;$('drained-stat').textContent=`${stats.drained.toFixed(1)} m³`;$('eroded-stat').textContent=`${stats.eroded.toFixed(2)} m³`;
      $('performance').textContent=`192² · CPU worker · ${fps} fps · ${paused?'paused':simRate.toFixed(2)+'× time'} · ${stats.time.toFixed(1)} s`;
      lastStats=now;
      // A read-only diagnostic for browser smoke tests and local experiments.
      window.sandboxDiagnostics={...stats,fps,simRate,solverMs:lastCost,ready,paused,mode};
    }
    display.render(stats.time||0);
  }
  requestAnimationFrame(animate);
  window.addEventListener('beforeunload',()=>{worker.terminate();display.renderer.dispose();});
} catch(e){showError(`Unable to initialize WebGL2: ${e.message}. This demo needs a modern desktop browser with hardware acceleration.`);}
