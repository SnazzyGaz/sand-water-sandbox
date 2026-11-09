import{W as re,A as oe,c as ie,d as O,e as q,f as ae,M as j,T as Y,V as k,g as N,h as F,i as se,H as ne,D as le,U as ce,O as de,j as K,B as A,k as W,l as ue,a as R,m as X,n as he,o as fe,p as ve,q as me,r as pe,F as B,L as ge,s as we,b as P,t as xe,u as ye,v as be,w as Se,x as ze,y as Le}from"./three-core-CDxP1puG.js";import{O as ke}from"./three-controls-RcapDe_y.js";(function(){const o=document.createElement("link").relList;if(o&&o.supports&&o.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))n(r);new MutationObserver(r=>{for(const s of r)if(s.type==="childList")for(const a of s.addedNodes)a.tagName==="LINK"&&a.rel==="modulepreload"&&n(a)}).observe(document,{childList:!0,subtree:!0});function c(r){const s={};return r.integrity&&(s.integrity=r.integrity),r.referrerPolicy&&(s.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?s.credentials="include":r.crossOrigin==="anonymous"?s.credentials="omit":s.credentials="same-origin",s}function n(r){if(r.ep)return;r.ep=!0;const s=c(r);fetch(r.href,s)}})();const D=`
uniform sampler2D field;
uniform sampler2D transport;
uniform float gridN;
uniform float fieldSize;
uniform float time;
uniform int viewMode;
uniform vec3 sunDir;
uniform vec3 brush;
uniform vec3 brushColor;
uniform float brushVisible;
varying vec2 vUv;
varying vec3 vWorld;
varying vec3 vHeightNormal;
varying float vShadow;
vec2 texUV(vec2 uv){return (clamp(uv,0.,1.)*(gridN-1.)+.5)/gridN;}
vec4 state(vec2 uv){return texture2D(field,texUV(uv));}
vec4 flow(vec2 uv){return texture2D(transport,texUV(uv));}
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),f.x),f.y);}
vec3 heightNormal(vec2 uv,bool water){
 float e=1./(gridN-1.);vec4 L=state(uv-vec2(e,0)),R=state(uv+vec2(e,0)),T=state(uv-vec2(0,e)),B=state(uv+vec2(0,e));
 float l=L.x,r=R.x,t=T.x,b=B.x;if(water){l+=L.y;r+=R.y;t+=T.y;b+=B.y;}
 return normalize(vec3(l-r,2.*fieldSize/(gridN-1.),t-b));
}
vec3 diagnostic(vec4 s,vec4 f,vec3 original){
 if(viewMode==1){return mix(mix(vec3(.76,.61,.35),vec3(.25,.55,.37),smoothstep(0.,.45,s.z)),vec3(.06,.35,.64),smoothstep(.55,1.,s.z));}
 if(viewMode==2){float d=f.w;return mix(vec3(.46,.45,.37),d<0.?vec3(.83,.22,.10):vec3(.22,.64,.47),smoothstep(.004,.3,abs(d)));}
 if(viewMode==3){return mix(vec3(.19,.25,.24),mix(vec3(.13,.53,.54),vec3(.97,.65,.20),smoothstep(.2,3.5,length(f.xy))),smoothstep(.003,.04,s.y));}
 return original;
}
float terrainShadow(vec3 world){
 float vis=1.;
 for(int i=1;i<=12;i++){
  float dist=float(i)*1.15;vec3 q=world+sunDir*dist;
  vec2 uv=q.xz/fieldSize+.5;
  if(uv.x>0.&&uv.y>0.&&uv.x<1.&&uv.y<1.){
   float hill=state(uv).x;
   vis=min(vis,smoothstep(-.10,.28,q.y-hill));
  }
 }
 return mix(.30,1.,vis);
}
vec3 drawBrush(vec3 col){float dist=length(vWorld.xz-brush.xy);float width=.045;float ring=1.-smoothstep(width,width*2.,abs(dist-brush.z));float center=(1.-smoothstep(.04,.08,dist))*.5;return mix(col,brushColor,(ring*.8+center)*brushVisible);}
`,Ne=`
${D}
void main(){vUv=uv;vec3 p=position;p.y=state(uv).x;vWorld=(modelMatrix*vec4(p,1.)).xyz;vHeightNormal=heightNormal(uv,false);vShadow=terrainShadow(vWorld);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`,De=`
${D}
const float PI=3.14159265;
float ggx(vec3 N,vec3 L,vec3 V,float rough){
 vec3 H=normalize(L+V);float NoH=max(dot(N,H),0.),NoV=max(dot(N,V),.001),NoL=max(dot(N,L),.001),VoH=max(dot(V,H),0.);
 float a=rough*rough,a2=a*a,den=NoH*NoH*(a2-1.)+1.,D=a2/(PI*den*den);
 float k=(rough+1.)*(rough+1.)*.125;float geom=NoV/(NoV*(1.-k)+k)*NoL/(NoL*(1.-k)+k);
 float F=.035+.965*pow(1.-VoH,5.);return D*geom*F/(4.*NoV*NoL);
}
void main(){
 vec4 s=state(vUv),f=flow(vUv);vec3 N=normalize(vHeightNormal),V=normalize(cameraPosition-vWorld);
 float wet=clamp(max(s.w,s.z),0.,1.);
 float grain=noise(vWorld.xz*95.);float grainFade=1.-smoothstep(.2,1.5,length(fwidth(vWorld.xz*95.)));
 float rip=sin(vWorld.x*.95+sin(vWorld.z*.31)*1.8+sin(vWorld.x*.18)*1.4);
 float detail=(noise(vWorld.xz*1.5)-.5)*.10+(grain-.5)*.10*grainFade;
 vec3 albedo=mix(vec3(.69,.53,.32),vec3(.255,.202,.133),wet*.92);
 albedo*=1.+detail+(.025*rip)*(1.-wet);
 float fine=hash(floor(vWorld.xz*110.));
 N=normalize(N+vec3((noise(vWorld.xz*38.)-.5),0.,(noise(vWorld.xz*38.+19.)-.5))*.13*grainFade);
 vec3 L=normalize(sunDir);float NoL=max(dot(N,L),0.);float sh=vShadow;
 // Broad rough diffuse + microfacet reflection, damp sand has narrower highlights.
 float rough=mix(.92,.29,wet);
 vec3 diffuse=albedo*(vec3(.34,.42,.46)*(.72+.28*N.y)+vec3(1.12,.95,.68)*NoL*sh);
 float spec=ggx(N,L,V,rough)*NoL*sh;
 float grazing=pow(1.-max(dot(N,V),0.),3.);
 vec3 halfDir=normalize(L+V);
 vec3 gn=normalize(N+vec3(hash(floor(vWorld.xz*110.)+3.)-.5,.1,hash(floor(vWorld.xz*110.)+8.)-.5)*.7);
 float glitter=pow(max(dot(gn,halfDir),0.),200.)*step(.88,fine)*grainFade*(.18+grazing)*sh;
 // Small-scale horizon/cavity approximation from the actual height field.
 float avg=(state(vUv+vec2(.015,0)).x+state(vUv-vec2(.015,0)).x+state(vUv+vec2(0,.015)).x+state(vUv-vec2(0,.015)).x)*.25;
 float ao=clamp(1.-(avg-s.x)*.65,.65,1.);
 vec3 col=(diffuse+vec3(1.1,.95,.74)*(spec*.8+glitter*1.3))*ao;
 col=diagnostic(s,f,col);col=drawBrush(col);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`,Me=`
${D}
void main(){vUv=uv;vec4 s=state(uv);vec3 p=position;p.y=s.x+s.y+.006;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`,Ce=`
${D}
uniform sampler2D background;
uniform vec2 resolution;
void main(){
 vec4 s=state(vUv),f=flow(vUv);float depth=s.y;
 if(depth<.0025)discard;
 vec3 N=heightNormal(vUv,true),V=normalize(cameraPosition-vWorld);
 float speed=length(f.xy);
 // Secondary normals only: no fabricated displacement/splashes. Moving water
 // advects the two phase-shifted ripple samples to avoid unbounded UV stretching.
 float phase=fract(time*.13),phase2=fract(time*.13+.5),blend=abs(phase*2.-1.);
 vec2 p=vWorld.xz*2.;vec2 a=p-f.xy*phase*.7,b=p-f.xy*phase2*.7;
 vec2 ripple=mix(vec2(sin(a.x*2.3+a.y*.8),cos(a.y*2.7-a.x*.5)),vec2(sin(b.x*2.3+b.y*.8),cos(b.y*2.7-b.x*.5)),blend);
 float amplitude=.012+min(.035,speed*.012);
 N=normalize(N+vec3(ripple.x,0.,ripple.y)*amplitude*smoothstep(.005,.09,depth));
 float fresnel=.0204+.9796*pow(1.-max(dot(N,V),0.),5.);
 vec3 reflected=reflect(-V,N);
 vec3 sky=mix(vec3(.39,.48,.47),vec3(.10,.23,.30),smoothstep(-.1,.8,reflected.y));
 sky+=vec3(1.1,.91,.64)*pow(max(dot(reflected,sunDir),0.),650.)*3.;
 vec2 screen=gl_FragCoord.xy/resolution;
 vec2 refractUV=clamp(screen+N.xz*min(depth,.7)*.012,vec2(.002),vec2(.998));
 vec3 beneath=texture2D(background,refractUV).rgb;
 vec3 attenuation=exp(-vec3(.60,.25,.15)*depth*2.2);
 float turbidity=clamp(f.z*9.,0.,.85);
 vec3 body=mix(vec3(.075,.245,.245),vec3(.34,.27,.14),turbidity);
 vec3 transmitted=beneath*attenuation+body*(1.-attenuation);
 vec3 col=mix(transmitted,sky,clamp(fresnel,.02,.88));
 vec3 halfDir=normalize(sunDir+V);
 float spec=pow(max(dot(N,halfDir),0.),240.);
 col+=vec3(1.15,1.03,.80)*spec*.8;
 // Thin shoreline contact, not a uniform white foam outline.
 col*=mix(.83,1.,smoothstep(.002,.07,depth));
 if(viewMode==3)col=mix(vec3(.09,.48,.55),vec3(.96,.59,.14),smoothstep(.2,3.5,speed));
 col=drawBrush(col);
 gl_FragColor=vec4(col,smoothstep(.0025,.035,depth)*.97);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;class Ue{constructor(o,c=192,n=60){this.n=c,this.size=n,this.renderer=new re({canvas:o,antialias:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65)),this.renderer.toneMapping=oe,this.renderer.toneMappingExposure=1.15,this.renderer.outputColorSpace=ie,this.scene=new O,this.scene.background=new q("#263633"),this.camera=new ae(42,innerWidth/innerHeight,.2,350),this.controls=new ke(this.camera,o),this.controls.enableDamping=!0,this.controls.dampingFactor=.075,this.controls.minDistance=5,this.controls.maxDistance=125,this.controls.maxPolarAngle=Math.PI*.47,this.controls.minPolarAngle=.12,this.controls.mouseButtons={LEFT:null,MIDDLE:j.PAN,RIGHT:j.ROTATE},this.controls.touches={ONE:Y.ROTATE,TWO:Y.DOLLY_PAN},this.controls.enablePan=!0,this.controls.panSpeed=.65,this.controls.zoomSpeed=.8,this.frameScene(),this.data=new Float32Array(c*c*4),this.flowData=new Float32Array(c*c*4),this.raw=null;const r=f=>{let v=new be(f,c,c,Se,ze);return v.minFilter=v.magFilter=Le,v.generateMipmaps=!1,v.needsUpdate=!0,v};this.field=r(this.data),this.transport=r(this.flowData),this.uniforms={field:{value:this.field},transport:{value:this.transport},gridN:{value:c},fieldSize:{value:n},time:{value:0},viewMode:{value:0},sunDir:{value:new k(-.6,.72,-.35).normalize()},brush:{value:new k(0,0,2.4)},brushColor:{value:new q("#daefb5")},brushVisible:{value:0}};const s=this.makeGrid(c,n);this.terrain=new N(s,new F({uniforms:this.uniforms,vertexShader:Ne,fragmentShader:De})),this.terrain.frustumCulled=!1,this.scene.add(this.terrain),this.target=new se(1,1,{type:ne,depthBuffer:!0}),this.target.depthTexture=new le(1,1,ce),this.copyScene=new O,this.copyCamera=new de(-1,1,1,-1,0,1),this.copyScene.add(new N(new K(2,2),new F({uniforms:{image:{value:this.target.texture},depthImage:{value:this.target.depthTexture}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:`uniform sampler2D image;uniform sampler2D depthImage;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);gl_FragDepth=texture2D(depthImage,vUv).x;
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}))),this.waterScene=new O,this.waterIndices=new Uint32Array((c-1)*(c-1)*6);const a=new A;a.setAttribute("position",s.getAttribute("position")),a.setAttribute("uv",s.getAttribute("uv")),a.setIndex(new W(this.waterIndices,1).setUsage(ue)),a.setDrawRange(0,0),this.waterUniforms={...this.uniforms,background:{value:this.target.texture},resolution:{value:new R(1,1)}},this.water=new N(a,new F({uniforms:this.waterUniforms,vertexShader:Me,fragmentShader:Ce,transparent:!0,depthWrite:!1,side:X})),this.water.renderOrder=2,this.water.frustumCulled=!1,this.waterScene.add(this.water),this.scene.add(new he(13165026,3750443,2));const i=new fe(16769964,2.2);i.position.set(-30,45,-25),this.scene.add(i),this.makeSkirt();const d=new N(new ve(n+.25,1,n+.25),new me({color:3358263,roughness:.94}));d.position.y=-1.5,this.scene.add(d);const u=new N(new K(700,700),new pe({color:"#263633"}));u.rotation.x=-Math.PI/2,u.position.y=-2.02,this.scene.add(u);const t=[];for(const f of[-1,1])for(const v of[-1,1]){const p=f*30.5,g=v*30.5;t.push(p,-1.99,g,p-f*3,-1.99,g,p,-1.99,g,p,-1.99,g-v*3)}const h=new A;h.setAttribute("position",new B(t,3)),this.scene.add(new ge(h,new we({color:8162676,transparent:!0,opacity:.45}))),this.resize()}makeGrid(o,c){const n=new A,r=new Float32Array(o*o*3),s=new Float32Array(o*o*2),a=new Uint32Array((o-1)*(o-1)*6);let i=0;for(let d=0;d<o;d++)for(let u=0;u<o;u++){const t=d*o+u;r[t*3]=u/(o-1)*c-c/2,r[t*3+2]=d/(o-1)*c-c/2,s[t*2]=u/(o-1),s[t*2+1]=d/(o-1),u<o-1&&d<o-1&&(a[i++]=t,a[i++]=t+o,a[i++]=t+1,a[i++]=t+1,a[i++]=t+o,a[i++]=t+o+1)}return n.setAttribute("position",new W(r,3)),n.setAttribute("uv",new W(s,2)),n.setIndex(new W(a,1)),n}makeSkirt(){const o=[],c=[],n=[],r=this.n,s=this.size,a=[];for(let t=0;t<r;t++)a.push([t/(r-1),0]);for(let t=1;t<r;t++)a.push([1,t/(r-1)]);for(let t=r-2;t>=0;t--)a.push([t/(r-1),1]);for(let t=r-2;t>=0;t--)a.push([0,t/(r-1)]);a.forEach(([t,h],f)=>{o.push((t-.5)*s,0,(h-.5)*s,(t-.5)*s,1,(h-.5)*s),c.push(t,h,t,h),f<a.length-1&&n.push(f*2,f*2+1,f*2+2,f*2+1,f*2+3,f*2+2)});const i=new A;i.setAttribute("position",new B(o,3)),i.setAttribute("uv",new B(c,2)),i.setIndex(n);const d=new F({uniforms:this.uniforms,side:X,vertexShader:`${D}
void main(){vUv=uv;vec3 p=position;p.y=mix(-1.,state(uv).x,position.y);vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`${D}
void main(){vec4 s=state(vUv);float strata=sin(vWorld.y*19.+noise(vWorld.xz*.25)*2.)*.025;float wet=smoothstep(s.x*(1.-s.z),s.x*(1.-s.z)+.4,vWorld.y);vec3 col=mix(vec3(.24,.20,.13),vec3(.40,.32,.20),wet);col*=.82+strata+noise(vWorld.xz*45.+vWorld.yy)*.14;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}),u=new N(i,d);u.frustumCulled=!1,this.scene.add(u)}update(o){for(let r=0;r<this.n*this.n;r++){const s=r*8,a=r*4;for(let i=0;i<4;i++)this.data[a+i]=o[s+i],this.flowData[a+i]=o[s+i+4]}this.field.needsUpdate=!0,this.transport.needsUpdate=!0;let c=0;const n=this.n;for(let r=0;r<n-1;r++)for(let s=0;s<n-1;s++){const a=r*n+s;Math.max(this.data[a*4+1],this.data[(a+1)*4+1],this.data[(a+n)*4+1],this.data[(a+n+1)*4+1])<.002||(this.waterIndices[c++]=a,this.waterIndices[c++]=a+n,this.waterIndices[c++]=a+1,this.waterIndices[c++]=a+1,this.waterIndices[c++]=a+n,this.waterIndices[c++]=a+n+1)}this.water.geometry.index.needsUpdate=!0,this.water.geometry.setDrawRange(0,c)}frameScene(){this.camera.position.set(52,49,66),this.controls.target.set(2,2,-1),this.controls.update()}resize(){this.renderer.setSize(innerWidth,innerHeight),this.camera.aspect=innerWidth/innerHeight,this.camera.updateProjectionMatrix();const o=new R;this.renderer.getDrawingBufferSize(o),this.target.setSize(o.x,o.y),this.waterUniforms.resolution.value.copy(o)}render(o){this.uniforms.time.value=o,this.controls.update(),this.controls.target.x=P.clamp(this.controls.target.x,-38,38),this.controls.target.z=P.clamp(this.controls.target.z,-38,38);const c=this.uniforms.viewMode.value===0||this.uniforms.viewMode.value===3;this.renderer.setRenderTarget(this.target),this.renderer.render(this.scene,this.camera),this.renderer.setRenderTarget(null),this.renderer.render(this.copyScene,this.copyCamera),c&&(this.renderer.autoClear=!1,this.renderer.render(this.waterScene,this.camera),this.renderer.autoClear=!0)}pick(o,c){const n=new xe;n.setFromCamera(new R(o/innerWidth*2-1,1-c/innerHeight*2),this.camera);const r=n.ray,s=new ye(new k(-30,-.1,-30),new k(30,25,30)),a=r.intersectBox(s,new k);if(!a)return null;let i=Math.max(0,a.clone().sub(r.origin).dot(r.direction)),d=i,u=100;const t=new k;for(let h=0;h<500;h++){if(r.at(i,t),t.x<-30.01||t.x>30.01||t.z<-30.01||t.z>30.01||t.y<-.2)return null;const f=this.sample(t.x,t.z),v=t.y-f.height-f.water;if(v<=0&&u>0){let p=d,g=i;for(let z=0;z<10;z++){const S=(p+g)/2;r.at(S,t);const L=this.sample(t.x,t.z);t.y>L.height+L.water?p=S:g=S}return r.at((p+g)/2,t),{x:t.x,z:t.z,...this.sample(t.x,t.z)}}u=v,d=i,i+=.25}return null}sample(o,c){const n=this.n,r=P.clamp((o/this.size+.5)*(n-1),0,n-1.001),s=P.clamp((c/this.size+.5)*(n-1),0,n-1.001),a=r|0,i=s|0,d=r-a,u=s-i,t=(i*n+a)*4,h=(f,v)=>(f[t+v]*(1-d)+f[t+4+v]*d)*(1-u)+(f[t+n*4+v]*(1-d)+f[t+(n+1)*4+v]*d)*u;return{height:h(this.data,0),water:h(this.data,1),saturation:h(this.data,2),wet:h(this.data,3),speed:Math.hypot(h(this.flowData,0),h(this.flowData,1)),change:h(this.flowData,3)}}}const l=m=>document.getElementById(m);function J(m){l("error").hidden=!1,l("error").textContent=m,console.error(m)}try{let V=function(){l("intro").style.opacity=0,l("intro").style.pointerEvents="none"},M=function(){return a?Z[n]:n},b=function(){o.uniforms.brushVisible.value=i?1:0,i&&o.uniforms.brush.value.set(i.x,i.z,t),o.uniforms.brushColor.value.set(ee[M()]),l("mode-label").textContent=Q[M()];const e=s&&i?{x:i.x,z:i.z,radius:t,strength:h,mode:M()}:null;x({type:"brush",brush:e})},C=function(e){n=e,document.querySelectorAll(".mode").forEach(y=>{y.classList.toggle("active",y.dataset.mode===e),y.setAttribute("aria-pressed",String(y.dataset.mode===e))}),b()},H=function(){t=+l("radius").value,l("radius-value").textContent=`${t.toFixed(1)} m`,b()},$=function(e){r=e,l("pause").innerHTML=e?"Resume <kbd>Space</kbd>":"Pause <kbd>Space</kbd>",l("live").textContent=e?"SIMULATION PAUSED":"COUPLED SIMULATION",x({type:"pause",paused:r}),b()},_=function(e){u&&(d={x:e.clientX,y:e.clientY},i=o.pick(e.clientX,e.clientY),b())},U=function(){s&&(s=!1,x({type:"brush",brush:null}))},G=function(e){if(requestAnimationFrame(G),p++,e-g>750&&(z=Math.round(p*1e3/(e-g)),p=0,g=e,z<28&&e>2500)){const y=o.renderer.getPixelRatio();y>.65&&(o.renderer.setPixelRatio(Math.max(.65,y*.82)),o.resize())}if(d&&e-f>80){if(i=o.pick(d.x,d.y),b(),f=e,i){const y=i.saturation>.86?"SATURATED / LOW COHESION":i.saturation>.08?"MOIST / CAPILLARY COHESION":i.wet>.2?"DAMP SURFACE":"DRY / FRICTIONAL SAND";l("probe-state").textContent=y,l("probe-values").textContent=`${Math.round(i.saturation*100)}% pore saturation · ${i.water.toFixed(2)} m water · ${i.speed.toFixed(2)} m/s`}r&&s&&i&&x({type:"edit",brush:{...i,radius:t,strength:h,mode:M()}})}e-v>350&&u&&(l("water-stat").textContent=`${w.surface.toFixed(1)} m³`,l("pore-stat").textContent=`${w.pore.toFixed(1)} m³`,l("drained-stat").textContent=`${w.drained.toFixed(1)} m³`,l("eroded-stat").textContent=`${w.eroded.toFixed(2)} m³`,l("performance").textContent=`192² · CPU worker · ${z} fps · ${r?"paused":T.toFixed(2)+"× time"} · ${w.time.toFixed(1)} s`,v=e,window.sandboxDiagnostics={...w,fps:z,simRate:T,solverMs:I,ready:u,paused:r,mode:n}),o.render(w.time||0)};const m=l("scene"),o=new Ue(m),c=new Worker(new URL("/sand-water-sandbox/assets/worker-BJa39eFS.js",import.meta.url),{type:"module"});let n="raise",r=!1,s=!1,a=!1,i=null,d=null,u=!1,t=2.4,h=.6,f=0,v=0,p=0,g=performance.now(),z=0,S=0,L=performance.now(),T=1,w={},I=0;const x=e=>c.postMessage(e),Z={raise:"lower",lower:"raise",water:"drain",drain:"water"},Q={raise:"raise sand",lower:"lower sand",water:"pour water",drain:"remove surface water"},ee={raise:"#dcebb4",lower:"#f6b787",water:"#a3e3e5",drain:"#c1b5f1"};l("dismiss").onclick=V,document.querySelectorAll(".mode").forEach(e=>e.onclick=()=>C(e.dataset.mode)),l("radius").oninput=H,l("strength").oninput=()=>{h=+l("strength").value/100,l("strength-value").textContent=`${Math.round(h*100)}%`,b()},l("pause").onclick=()=>$(!r),l("reset").onclick=()=>{s=!1,i=null,x({type:"brush",brush:null}),x({type:"reset"})},l("camera").onclick=()=>o.frameScene(),l("flood").onclick=()=>{x({type:"pour",x:i?.x??0,z:i?.z??-18}),V()},l("spring").onchange=()=>x({type:"options",options:{spring:l("spring").checked}}),l("underdrain").onchange=()=>x({type:"options",options:{underdrain:l("underdrain").checked}}),l("erosion").oninput=()=>{const e=+l("erosion").value;l("erosion-value").textContent=`${e.toFixed(1)}×`,x({type:"options",options:{erosion:e}})};const te=["Light sand → damp → dark saturated banks","Ochre: dry · green: moist · blue: saturated","Orange: removed · green: deposited · ±0.3 m","Dark: still · teal: sheet flow · amber: 3.5 m/s"];l("view").onchange=()=>{const e=+l("view").value;o.uniforms.viewMode.value=e,l("view-key").textContent=te[e]},l("collapse").onclick=()=>{const e=l("tools-body");e.hidden=!e.hidden,l("collapse").textContent=e.hidden?"+":"−"},m.addEventListener("contextmenu",e=>e.preventDefault()),m.addEventListener("pointermove",e=>{e.pointerType!=="touch"&&_(e)}),m.addEventListener("pointerdown",e=>{e.button!==0||e.pointerType==="touch"||(e.preventDefault(),e.stopImmediatePropagation(),m.setPointerCapture(e.pointerId),s=!0,a=e.shiftKey,_(e),V(),r&&i&&x({type:"edit",brush:{...i,radius:t,strength:h,mode:M()}}))},!0),window.addEventListener("pointerup",U),m.addEventListener("lostpointercapture",U),m.addEventListener("pointerleave",()=>{s||(i=null,d=null,b())}),window.addEventListener("blur",()=>{U(),a=!1,b()}),document.addEventListener("visibilitychange",()=>{document.hidden&&U()}),window.addEventListener("keydown",e=>{e.target.matches("input,select")||(a=e.shiftKey,e.key==="Shift"&&b(),e.code==="Space"&&(e.preventDefault(),e.repeat||$(!r)),e.key==="1"&&C("raise"),e.key==="2"&&C("lower"),e.key==="3"&&C("water"),e.key==="4"&&C("drain"),e.key.toLowerCase()==="r"&&!e.repeat&&l("reset").click(),e.key.toLowerCase()==="f"&&o.frameScene(),(e.key==="["||e.key==="]")&&(l("radius").value=String(Math.max(.6,Math.min(7,t+(e.key==="["?-.3:.3)))),H()))}),window.addEventListener("keyup",e=>{a=e.shiftKey,e.key==="Shift"&&b()}),window.addEventListener("resize",()=>o.resize()),c.onerror=e=>J(`Simulation could not start: ${e.message}. Try a current WebGL2-capable desktop browser.`),c.onmessage=({data:e})=>{if(e.type!=="frame")return;const y=new Float32Array(e.buffer);o.update(y),x({type:"recycle",buffer:e.buffer}),u=!0,w=e.stats,w.time<S&&(S=w.time,L=performance.now()),I=e.cost||I;const E=performance.now();E-L>1e3&&(T=(w.time-S)/((E-L)/1e3),S=w.time,L=E)},requestAnimationFrame(G),window.addEventListener("beforeunload",()=>{c.terminate(),o.renderer.dispose()})}catch(m){J(`Unable to initialize WebGL2: ${m.message}. This demo needs a modern desktop browser with hardware acceleration.`)}
