import{W as ue,A as he,e as Z,f as I,g as ee,h as me,M as te,T as re,i as fe,j as ie,b as E,H as ae,V as F,k as B,a as $,O as se,l as z,m as Q,n as W,o as pe,U as ve,B as V,p as _,q as ge,c as q,r as oe,s as we,t as xe,u as ye,v as be,w as ke,x as j,y as Me,z as Se,E as ne,G as De,d as O,I as Le,J as Ne,K as ze,F as Ue}from"./three-core-1bQ-A291.js";import{O as Ce,H as Ee}from"./three-controls-CsOF_Nam.js";(function(){const i=document.createElement("link").relList;if(i&&i.supports&&i.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))s(r);new MutationObserver(r=>{for(const l of r)if(l.type==="childList")for(const o of l.addedNodes)o.tagName==="LINK"&&o.rel==="modulepreload"&&s(o)}).observe(document,{childList:!0,subtree:!0});function n(r){const l={};return r.integrity&&(l.integrity=r.integrity),r.referrerPolicy&&(l.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?l.credentials="include":r.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function s(r){if(r.ep)return;r.ep=!0;const l=n(r);fetch(r.href,l)}})();const U=`
uniform sampler2D field;
uniform sampler2D transport;
uniform sampler2D surfaceLight;
uniform sampler2D grains;
uniform sampler2D sandColor;
uniform sampler2D sandNormal;
uniform sampler2D skyMap;
uniform float skyReady;
uniform float skyRotation;
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
  float dist=float(i)*.9;vec3 q=world+sunDir*dist;
  vec2 uv=q.xz/fieldSize+.5;
  if(uv.x>0.&&uv.y>0.&&uv.x<1.&&uv.y<1.){
   float hill=state(uv).x;
   vis=min(vis,smoothstep(-.10,.28,q.y-hill));
  }
 }
 return mix(.12,1.,vis);
}
vec3 skyRadiance(vec3 dir){
 vec2 uv=vec2(fract(atan(dir.z,dir.x)/6.2831853+.5+skyRotation/6.2831853),asin(clamp(dir.y,-1.,1.))/3.14159265+.5);
 return texture2D(skyMap,uv).rgb;
}
vec3 drawBrush(vec3 col){float dist=length(vWorld.xz-brush.xy);float width=.045;float ring=1.-smoothstep(width,width*2.,abs(dist-brush.z));float center=(1.-smoothstep(.04,.08,dist))*.5;return mix(col,brushColor,(ring*.8+center)*brushVisible);}
`,Fe=`
${U}
void main(){vUv=uv;vec3 p=position;p.y=state(uv).x;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`,Te=`
${U}
const float PI=3.14159265;
float ggx(vec3 N,vec3 L,vec3 V,float rough){
 vec3 H=normalize(L+V);float NoH=max(dot(N,H),0.),NoV=max(dot(N,V),.001),NoL=max(dot(N,L),.001),VoH=max(dot(V,H),0.);
 float a=rough*rough,a2=a*a,den=NoH*NoH*(a2-1.)+1.,D=a2/(PI*den*den);
 float k=(rough+1.)*(rough+1.)*.125;float geom=NoV/(NoV*(1.-k)+k)*NoL/(NoL*(1.-k)+k);
 float F=.035+.965*pow(1.-VoH,5.);return D*geom*F/(4.*NoV*NoL);
}
void main(){
 vec4 s=state(vUv),f=flow(vUv),lit=texture2D(surfaceLight,texUV(vUv));
 vec3 N=normalize(lit.xyz*2.-1.),V=normalize(cameraPosition-vWorld);
 float wet=clamp(max(s.w,s.z*.85),0.,1.);
 vec4 grit=texture2D(grains,vWorld.xz*.5);
 vec4 fineGrit=texture2D(grains,vWorld.xz*2.13+vec2(.19,.37));
 float macro=noise(vWorld.xz*.35),meso=noise(vWorld.xz*3.7);
 float ripple=sin(vWorld.x*6.+sin(vWorld.z*.48)*2.)*.5+.5;
 float flatness=smoothstep(.55,.98,N.y);
 vec3 dry=texture2D(sandColor,vWorld.xz/1.5).rgb*(.85+.25*macro);
 vec3 albedo=mix(dry,dry*vec3(.27,.30,.32),pow(wet,.65));
 albedo*=.88+.14*grit.r+.09*meso+.025*ripple*flatness*(1.-wet);
 // Mipmapped grain normals retain millimetre detail nearby without sparkling
 // aliasing in the overview. Wet grains smooth down under the surface film.
 vec2 bump=(texture2D(sandNormal,vWorld.xz/1.5).rg*2.-1.)*.85+(grit.gb*2.-1.)*.15+(fineGrit.gb*2.-1.)*.10;
 N=normalize(N+vec3(bump.x,0.,bump.y)*mix(1.,.32,wet));
 vec3 L=normalize(sunDir);float NoL=max(dot(N,L),0.),sh=lit.a;
 float rough=mix(.86,.20,pow(wet,.7));
 vec3 ambient=mix(vec3(.10,.105,.095),vec3(.24,.31,.40),N.y*.5+.5);
 vec3 diffuse=albedo*(ambient+vec3(1.52,1.30,1.03)*NoL*sh);
 float spec=ggx(N,L,V,rough)*NoL*sh;
 float grazing=pow(1.-max(dot(N,V),0.),3.);
 vec3 halfDir=normalize(L+V);
 vec3 gn=normalize(N+vec3(grit.g-.5,.08,grit.b-.5)*.9);
 float grainFade=1.-smoothstep(.25,1.2,length(fwidth(vWorld.xz*512.)));
 float glitter=pow(max(dot(gn,halfDir),0.),160.)*smoothstep(.85,.99,grit.a)*grainFade*(.12+grazing)*sh;
 vec3 col=diffuse+vec3(1.15,1.05,.88)*(spec+glitter*1.6);
 col+=min(skyRadiance(reflect(-V,N)),vec3(2.))*.025*wet*skyReady;
 col=diagnostic(s,f,col);col=drawBrush(col);
 gl_FragColor=vec4(col,1.);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`,Ae=`
${U}
void main(){vUv=uv;vec4 s=state(uv);vec3 p=position;p.y=s.x+s.y+.006;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`,Re=`
${U}
uniform sampler2D background;
uniform vec2 resolution;
void main(){
 vec4 s=state(vUv),f=flow(vUv);float depth=s.y;
 if(depth<.0025)discard;
 vec3 N=heightNormal(vUv,true),V=normalize(cameraPosition-vWorld);
 float speed=length(f.xy);
 // Wind/capillary normals only: no fabricated displacement or splashes.
 // Three incommensurate directions avoid the old regular checkerboard ripple.
 vec2 p=vWorld.xz-f.xy*min(depth,.2)*.3;
 float w1=sin(dot(p,vec2(.92,.38))*17.3-time*1.7);
 float w2=sin(dot(p,vec2(-.29,.96))*23.7-time*2.1);
 float w3=sin(dot(p,vec2(.61,.79))*31.1+time*1.2);
 vec2 ripple=vec2(.92,.38)*w1+vec2(-.29,.96)*w2*.65+vec2(.61,.79)*w3*.35;
 float amplitude=.0035+min(.012,speed*.004);
 N=normalize(N+vec3(ripple.x,0.,ripple.y)*amplitude*smoothstep(.005,.09,depth));
 float fresnel=.0204+.9796*pow(1.-max(dot(N,V),0.),5.);
 vec3 reflected=reflect(-V,N);
 vec3 sky=mix(vec3(.68,.73,.76),vec3(.16,.30,.48),smoothstep(0.,.85,reflected.y));
 sky=mix(vec3(.16,.125,.075),sky,smoothstep(-.12,.04,reflected.y));
 sky=mix(sky,skyRadiance(reflected),skyReady);
 // Height-field ray reflection: honours both the upper and lower pools without
 // assuming one global reflection plane. Sky remains the miss environment.
 for(int j=1;j<=8;j++){
   float dist=float(j*j)*.32;vec3 q=vWorld+N*.025+reflected*dist;
   vec2 uv=q.xz/fieldSize+.5;
   if(uv.x<0.||uv.y<0.||uv.x>1.||uv.y>1.)break;
   vec4 bank=state(uv);
   if(q.y<bank.x && q.y>bank.x-1.2){
     vec4 lighting=texture2D(surfaceLight,texUV(uv));
     vec3 bankN=normalize(lighting.xyz*2.-1.);
     vec3 sand=mix(vec3(.52,.38,.22),vec3(.14,.115,.075),max(bank.z,bank.w));
     sky=sand*(vec3(.22,.28,.34)+vec3(1.52,1.30,1.03)*max(dot(bankN,sunDir),0.)*lighting.a);
     break;
   }
 }
 sky+=vec3(1.1,.91,.64)*pow(max(dot(reflected,sunDir),0.),650.)*3.;
 vec2 screen=gl_FragCoord.xy/resolution;
 vec2 refractUV=clamp(screen+(viewMatrix*vec4(N,0.)).xy*min(depth,1.2)*.018,vec2(.002),vec2(.998));
 vec3 beneath=texture2D(background,refractUV).rgb;
 float path=depth/max(.25,dot(N,V));
 vec3 attenuation=exp(-vec3(.48,.22,.12)*path);
 float turbidity=clamp(f.z*9.,0.,.85);
 vec3 body=mix(vec3(.055,.085,.065),vec3(.23,.16,.065),turbidity);
 vec3 transmitted=beneath*attenuation+body*(1.-attenuation);
 vec3 col=mix(transmitted,sky,clamp(fresnel,.02,.88));
 vec3 halfDir=normalize(sunDir+V);
 float spec=pow(max(dot(N,halfDir),0.),240.);
 col+=vec3(2.1,1.9,1.6)*spec*texture2D(surfaceLight,texUV(vUv)).a;
 // Thin shoreline contact, not a uniform white foam outline.
 col*=mix(.72,1.,smoothstep(.002,.055,depth));
 float edge=(1.-smoothstep(.006,.035,depth))*smoothstep(.0025,.008,depth);
 float foam=edge*smoothstep(.65,1.8,speed)*(.4+.6*noise(vWorld.xz*34.-f.xy*time));
 col=mix(col,vec3(.65,.63,.56),foam*.4);
 if(viewMode==3)col=mix(vec3(.09,.48,.55),vec3(.96,.59,.14),smoothstep(.2,3.5,speed));
 col=drawBrush(col);
 gl_FragColor=vec4(col,smoothstep(.0025,.035,depth)*.97);
 #include <tonemapping_fragment>
 #include <colorspace_fragment>
}
`;class We{constructor(i,n=192,s=60){this.n=n,this.size=s,this.renderer=new ue({canvas:i,antialias:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));const r=this.renderer.getContext(),l=r.getExtension("WEBGL_debug_renderer_info");this.gpuName=l?r.getParameter(l.UNMASKED_RENDERER_WEBGL):"WebGL2",this.software=/swiftshader|llvmpipe|software/i.test(this.gpuName),this.renderMs=0,this.renderGpuMs=null,this.timerExtension=r.getExtension("EXT_disjoint_timer_query_webgl2"),this.gpuQuery=null,this.renderer.toneMapping=he,this.renderer.toneMappingExposure=.9,this.renderer.outputColorSpace=Z,this.scene=new I,this.scene.background=new ee("#263633"),this.camera=new me(42,innerWidth/innerHeight,.2,350),this.controls=new Ce(this.camera,i),this.controls.enableDamping=!0,this.controls.dampingFactor=.075,this.controls.minDistance=5,this.controls.maxDistance=125,this.controls.maxPolarAngle=Math.PI*.47,this.controls.minPolarAngle=.12,this.controls.mouseButtons={LEFT:null,MIDDLE:te.PAN,RIGHT:te.ROTATE},this.controls.touches={ONE:re.ROTATE,TWO:re.DOLLY_PAN},this.controls.enablePan=!0,this.controls.panSpeed=.65,this.controls.zoomSpeed=.8,this.frameScene(),this.data=new Float32Array(n*n*4),this.flowData=new Float32Array(n*n*4),this.raw=null;const o=m=>{let f=new ne(m,n,n,ze,Ue);return f.minFilter=f.magFilter=E,f.generateMipmaps=!1,f.needsUpdate=!0,f};this.field=o(this.data),this.transport=o(this.flowData),this.grainTexture=this.makeGrains();const a=new fe,c=m=>`/sand-water-sandbox/textures/${m}`,h=(m,f=!1)=>{const g=a.load(c(m));return g.wrapS=g.wrapT=B,g.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),f&&(g.colorSpace=Z),g};this.sandColor=h("sand-color.jpg",!0),this.sandNormal=h("sand-normal.jpg"),this.lightTarget=new ie(n,n,{type:ae,minFilter:E,magFilter:E,depthBuffer:!1}),this.lightDirty=!0,this.uniforms={sandColor:{value:this.sandColor},sandNormal:{value:this.sandNormal},skyMap:{value:this.grainTexture},skyReady:{value:0},skyRotation:{value:0},surfaceLight:{value:this.lightTarget.texture},grains:{value:this.grainTexture},field:{value:this.field},transport:{value:this.transport},gridN:{value:n},fieldSize:{value:s},time:{value:0},viewMode:{value:0},sunDir:{value:new F(-.76,.52,-.38).normalize()},brush:{value:new F(0,0,2.4)},brushColor:{value:new ee("#daefb5")},brushVisible:{value:0}},new Ee().load(c("quarry-sky.hdr"),m=>{m.wrapS=B,m.magFilter=E,m.minFilter=E,this.uniforms.skyMap.value=m,this.uniforms.skyReady.value=1;const{data:f,width:g,height:v}=m.image;let C=-1,x=0;for(let M=0;M<g*v/2;M++){const L=$.fromHalfFloat(f[M*4])+$.fromHalfFloat(f[M*4+1])+$.fromHalfFloat(f[M*4+2]);L>C&&(C=L,x=M)}const T=(.5-((x/g|0)+.5)/v)*Math.PI,A=Math.atan2(-.38,-.76),G=((x%g+.5)/g-.5)*2*Math.PI;this.uniforms.skyRotation.value=G-A,this.uniforms.sunDir.value.set(Math.cos(A)*Math.cos(T),Math.sin(T),Math.sin(A)*Math.cos(T)),this.lightDirty=!0}),this.lightScene=new I,this.lightCamera=new se(-1,1,1,-1,0,1),this.lightScene.add(new z(new Q(2,2),new W({uniforms:this.uniforms,toneMapped:!1,vertexShader:"varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=vec3(0.);gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:`${U}
      void main(){vec2 uv=(vUv*gridN-.5)/(gridN-1.);vec3 N=heightNormal(uv,false);vec3 w=vec3((uv.x-.5)*fieldSize,state(uv).x,(uv.y-.5)*fieldSize);gl_FragColor=vec4(N*.5+.5,terrainShadow(w));}`})));const t=this.makeGrid(n,s);this.terrain=new z(t,new W({uniforms:this.uniforms,vertexShader:Fe,fragmentShader:Te})),this.terrain.frustumCulled=!1,this.scene.add(this.terrain),this.target=new ie(1,1,{type:ae,depthBuffer:!0}),this.target.depthTexture=new pe(1,1,ve),this.copyScene=new I,this.copyCamera=new se(-1,1,1,-1,0,1),this.copyScene.add(new z(new Q(2,2),new W({uniforms:{image:{value:this.target.texture},depthImage:{value:this.target.depthTexture}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:`uniform sampler2D image;uniform sampler2D depthImage;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);gl_FragDepth=texture2D(depthImage,vUv).x;
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}))),this.waterScene=new I,this.waterIndices=new Uint32Array((n-1)*(n-1)*6);const u=new V;u.setAttribute("position",t.getAttribute("position")),u.setAttribute("uv",t.getAttribute("uv")),u.setIndex(new _(this.waterIndices,1).setUsage(ge)),u.setDrawRange(0,0),this.waterUniforms={...this.uniforms,background:{value:this.target.texture},resolution:{value:new q(1,1)}},this.water=new z(u,new W({uniforms:this.waterUniforms,vertexShader:Ae,fragmentShader:Re,transparent:!0,depthWrite:!1,side:oe})),this.water.renderOrder=2,this.water.frustumCulled=!1,this.waterScene.add(this.water),this.scene.add(new we(13165026,3750443,2));const p=new xe(16769964,2.2);p.position.set(-30,45,-25),this.scene.add(p),this.makeSkirt();const y=new z(new ye(s+.25,1,s+.25),new be({color:3358263,roughness:.94}));y.position.y=-1.5,this.scene.add(y);const b=new z(new Q(700,700),new ke({color:"#263633"}));b.rotation.x=-Math.PI/2,b.position.y=-2.02,this.scene.add(b);const k=[];for(const m of[-1,1])for(const f of[-1,1]){const g=m*30.5,v=f*30.5;k.push(g,-1.99,v,g-m*3,-1.99,v,g,-1.99,v,g,-1.99,v-f*3)}const D=new V;D.setAttribute("position",new j(k,3)),this.scene.add(new Me(D,new Se({color:8162676,transparent:!0,opacity:.45}))),this.resize()}makeGrains(){const n=new Uint8Array(4194304),s=new Float32Array(1024*1024);let r=789234;const l=()=>(r=Math.imul(r,1664525)+1013904223|0,(r>>>0)/4294967296);for(let a=0;a<1024*1024;a++)s[a]=l();for(let a=0;a<1024;a++)for(let c=0;c<1024;c++){const h=a*1024+c,t=h*4,u=s[h];n[t]=Math.round(105+145*u),n[t+1]=Math.round(128+100*(s[a*1024+(c+1)%1024]-s[a*1024+(c+1024-1)%1024])),n[t+2]=Math.round(128+100*(s[(a+1)%1024*1024+c]-s[(a+1024-1)%1024*1024+c])),n[t+3]=Math.round(255*l())}const o=new ne(n,1024,1024);return o.wrapS=o.wrapT=B,o.magFilter=E,o.minFilter=De,o.generateMipmaps=!0,o.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),o.needsUpdate=!0,o}makeGrid(i,n){const s=new V,r=new Float32Array(i*i*3),l=new Float32Array(i*i*2),o=new Uint32Array((i-1)*(i-1)*6);let a=0;for(let c=0;c<i;c++)for(let h=0;h<i;h++){const t=c*i+h;r[t*3]=h/(i-1)*n-n/2,r[t*3+2]=c/(i-1)*n-n/2,l[t*2]=h/(i-1),l[t*2+1]=c/(i-1),h<i-1&&c<i-1&&(o[a++]=t,o[a++]=t+i,o[a++]=t+1,o[a++]=t+1,o[a++]=t+i,o[a++]=t+i+1)}return s.setAttribute("position",new _(r,3)),s.setAttribute("uv",new _(l,2)),s.setIndex(new _(o,1)),s}makeSkirt(){const i=[],n=[],s=[],r=this.n,l=this.size,o=[];for(let t=0;t<r;t++)o.push([t/(r-1),0]);for(let t=1;t<r;t++)o.push([1,t/(r-1)]);for(let t=r-2;t>=0;t--)o.push([t/(r-1),1]);for(let t=r-2;t>=0;t--)o.push([0,t/(r-1)]);o.forEach(([t,u],p)=>{i.push((t-.5)*l,0,(u-.5)*l,(t-.5)*l,1,(u-.5)*l),n.push(t,u,t,u),p<o.length-1&&s.push(p*2,p*2+1,p*2+2,p*2+1,p*2+3,p*2+2)});const a=new V;a.setAttribute("position",new j(i,3)),a.setAttribute("uv",new j(n,2)),a.setIndex(s);const c=new W({uniforms:this.uniforms,side:oe,vertexShader:`${U}
void main(){vUv=uv;vec3 p=position;p.y=mix(-1.,state(uv).x,position.y);vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`${U}
void main(){vec4 s=state(vUv);float strata=sin(vWorld.y*19.+noise(vWorld.xz*.25)*2.)*.025;float wet=smoothstep(s.x*(1.-s.z),s.x*(1.-s.z)+.4,vWorld.y);vec3 col=mix(vec3(.24,.20,.13),vec3(.40,.32,.20),wet);col*=.82+strata+noise(vWorld.xz*45.+vWorld.yy)*.14;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}),h=new z(a,c);h.frustumCulled=!1,this.scene.add(h)}update(i){this.data.set(i.subarray(0,this.data.length)),this.flowData.set(i.subarray(this.data.length)),this.field.needsUpdate=!0,this.transport.needsUpdate=!0,this.lightDirty=!0;let n=0;const s=this.n;for(let r=0;r<s-1;r++)for(let l=0;l<s-1;l++){const o=r*s+l;Math.max(this.data[o*4+1],this.data[(o+1)*4+1],this.data[(o+s)*4+1],this.data[(o+s+1)*4+1])<.002||(this.waterIndices[n++]=o,this.waterIndices[n++]=o+s,this.waterIndices[n++]=o+1,this.waterIndices[n++]=o+1,this.waterIndices[n++]=o+s,this.waterIndices[n++]=o+s+1)}this.water.geometry.index.needsUpdate=!0,this.water.geometry.setDrawRange(0,n)}frameScene(){this.camera.position.set(16,34,22),this.controls.target.set(0,2,0),this.controls.update()}resize(){this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)),this.renderer.setSize(innerWidth,innerHeight),this.camera.aspect=innerWidth/innerHeight,this.camera.updateProjectionMatrix();const i=new q;this.renderer.getDrawingBufferSize(i),this.target.setSize(i.x,i.y),this.waterUniforms.resolution.value.copy(i)}render(i){const n=performance.now(),s=this.renderer.getContext(),r=this.timerExtension;this.gpuQuery&&s.getQueryParameter(this.gpuQuery,s.QUERY_RESULT_AVAILABLE)&&(s.getParameter(r.GPU_DISJOINT_EXT)||(this.renderGpuMs=s.getQueryParameter(this.gpuQuery,s.QUERY_RESULT)/1e6),s.deleteQuery(this.gpuQuery),this.gpuQuery=null);let l=null;r&&!this.gpuQuery&&(l=s.createQuery(),s.beginQuery(r.TIME_ELAPSED_EXT,l)),this.uniforms.time.value=i,this.controls.update(),this.controls.target.x=O.clamp(this.controls.target.x,-38,38),this.controls.target.z=O.clamp(this.controls.target.z,-38,38);const o=this.uniforms.viewMode.value===0||this.uniforms.viewMode.value===3;this.lightDirty&&(this.renderer.setRenderTarget(this.lightTarget),this.renderer.render(this.lightScene,this.lightCamera),this.lightDirty=!1),this.renderer.setRenderTarget(this.target),this.renderer.render(this.scene,this.camera),this.renderer.setRenderTarget(null),this.renderer.render(this.copyScene,this.copyCamera),o&&(this.renderer.autoClear=!1,this.renderer.render(this.waterScene,this.camera),this.renderer.autoClear=!0),l&&(s.endQuery(r.TIME_ELAPSED_EXT),this.gpuQuery=l),this.renderMs=performance.now()-n}pick(i,n){const s=new Le;s.setFromCamera(new q(i/innerWidth*2-1,1-n/innerHeight*2),this.camera);const r=s.ray,l=new Ne(new F(-30,-.1,-30),new F(30,25,30)),o=r.intersectBox(l,new F);if(!o)return null;let a=Math.max(0,o.clone().sub(r.origin).dot(r.direction)),c=a,h=100;const t=new F;for(let u=0;u<500;u++){if(r.at(a,t),t.x<-30.01||t.x>30.01||t.z<-30.01||t.z>30.01||t.y<-.2)return null;const p=this.sample(t.x,t.z),y=t.y-p.height-p.water;if(y<=0&&h>0){let b=c,k=a;for(let D=0;D<10;D++){const m=(b+k)/2;r.at(m,t);const f=this.sample(t.x,t.z);t.y>f.height+f.water?b=m:k=m}return r.at((b+k)/2,t),{x:t.x,z:t.z,...this.sample(t.x,t.z)}}h=y,c=a,a+=.25}return null}sample(i,n){const s=this.n,r=O.clamp((i/this.size+.5)*(s-1),0,s-1.001),l=O.clamp((n/this.size+.5)*(s-1),0,s-1.001),o=r|0,a=l|0,c=r-o,h=l-a,t=(a*s+o)*4,u=(p,y)=>(p[t+y]*(1-c)+p[t+4+y]*c)*(1-h)+(p[t+s*4+y]*(1-c)+p[t+(s+1)*4+y]*c)*h;return{height:u(this.data,0),water:u(this.data,1),saturation:u(this.data,2),wet:u(this.data,3),speed:Math.hypot(u(this.flowData,0),u(this.flowData,1)),change:u(this.flowData,3)}}}const d=w=>document.getElementById(w);function le(w){d("error").hidden=!1,d("error").textContent=w,console.error(w)}try{let M=function(){d("intro").style.opacity=0,d("intro").style.pointerEvents="none"},L=function(){return o?T[s]:s},S=function(){i.uniforms.brushVisible.value=a?1:0,a&&i.uniforms.brush.value.set(a.x,a.z,t),i.uniforms.brushColor.value.set(G[L()]),d("mode-label").textContent=A[L()];const e=l&&a?{x:a.x,z:a.z,radius:t,strength:u,mode:L()}:null;x({type:"brush",brush:e})},R=function(e){s=e,document.querySelectorAll(".mode").forEach(N=>{N.classList.toggle("active",N.dataset.mode===e),N.setAttribute("aria-pressed",String(N.dataset.mode===e))}),S()},Y=function(){t=+d("radius").value,d("radius-value").textContent=`${t.toFixed(1)} m`,S()},X=function(e){r=e,m=v.time||0,f=performance.now(),d("pause").innerHTML=e?"Resume <kbd>Space</kbd>":"Pause <kbd>Space</kbd>",d("live").textContent=e?"SIMULATION PAUSED":"COUPLED SIMULATION",x({type:"pause",paused:r}),S()},K=function(e){h&&(c={x:e.clientX,y:e.clientY},a=i.pick(e.clientX,e.clientY),S())},P=function(){l&&(l=!1,x({type:"brush",brush:null}))},J=function(e){if(requestAnimationFrame(J),b++,e-k>750&&(D=Math.round(b*1e3/(e-k)),b=0,k=e),c&&e-p>80){if(a=i.pick(c.x,c.y),S(),p=e,a){const N=a.saturation>.86?"SATURATED / LOW COHESION":a.saturation>.08?"MOIST / CAPILLARY COHESION":a.wet>.2?"DAMP SURFACE":"DRY / FRICTIONAL SAND";d("probe-state").textContent=N,d("probe-values").textContent=`${Math.round(a.saturation*100)}% pore saturation · ${a.water.toFixed(2)} m water · ${a.speed.toFixed(2)} m/s`}r&&l&&a&&x({type:"edit",brush:{...a,radius:t,strength:u,mode:L()}})}e-y>350&&h&&(d("water-stat").textContent=`${v.surface.toFixed(1)} m³`,d("pore-stat").textContent=`${v.pore.toFixed(1)} m³`,d("drained-stat").textContent=`${v.drained.toFixed(1)} m³`,d("eroded-stat").textContent=`${v.eroded.toFixed(2)} m³`,d("performance").textContent=`192² physics · sparse CPU worker · ${D} fps · ${r?"paused":g.toFixed(2)+"× time"} · ${v.time.toFixed(1)} s${i.software?" · SOFTWARE WebGL":""}`,y=e,window.sandboxDiagnostics={...v,fps:D,simRate:g,solverMs:C,pixelRatio:i.renderer.getPixelRatio(),renderer:i.gpuName,renderSubmitMs:i.renderMs,renderGpuMs:i.renderGpuMs,ready:h,paused:r,mode:s}),i.render(v.time||0)};const w=d("scene"),i=new We(w),n=new Worker(new URL("/sand-water-sandbox/assets/worker-QYJYZJUV.js",import.meta.url),{type:"module"});let s="raise",r=!1,l=!1,o=!1,a=null,c=null,h=!1,t=2.4,u=.6,p=0,y=0,b=0,k=performance.now(),D=0,m=0,f=performance.now(),g=1,v={},C=0;const x=e=>n.postMessage(e),T={raise:"lower",lower:"raise",water:"drain",drain:"water"},A={raise:"raise sand",lower:"lower sand",water:"pour water",drain:"remove surface water"},G={raise:"#dcebb4",lower:"#f6b787",water:"#a3e3e5",drain:"#c1b5f1"};d("dismiss").onclick=M,document.querySelectorAll(".mode").forEach(e=>e.onclick=()=>R(e.dataset.mode)),d("radius").oninput=Y,d("strength").oninput=()=>{u=+d("strength").value/100,d("strength-value").textContent=`${Math.round(u*100)}%`,S()},d("pause").onclick=()=>X(!r),d("reset").onclick=()=>{l=!1,a=null,x({type:"brush",brush:null}),x({type:"reset"})},d("camera").onclick=()=>i.frameScene(),d("flood").onclick=()=>{x({type:"pour",x:a?.x??0,z:a?.z??-18}),M()},d("spring").onchange=()=>x({type:"options",options:{spring:d("spring").checked}}),d("underdrain").onchange=()=>x({type:"options",options:{underdrain:d("underdrain").checked}}),d("erosion").oninput=()=>{const e=+d("erosion").value;d("erosion-value").textContent=`${e.toFixed(1)}×`,x({type:"options",options:{erosion:e}})};const de=["Light sand → damp → dark saturated banks","Ochre: dry · green: moist · blue: saturated","Orange: removed · green: deposited · ±0.3 m","Dark: still · teal: sheet flow · amber: 3.5 m/s"];d("view").onchange=()=>{const e=+d("view").value;i.uniforms.viewMode.value=e,d("view-key").textContent=de[e]},d("collapse").onclick=()=>{const e=d("tools-body");e.hidden=!e.hidden,d("collapse").textContent=e.hidden?"+":"−"},w.addEventListener("contextmenu",e=>e.preventDefault()),w.addEventListener("pointermove",e=>{e.pointerType!=="touch"&&K(e)}),w.addEventListener("pointerdown",e=>{e.button!==0||e.pointerType==="touch"||(e.preventDefault(),e.stopImmediatePropagation(),w.setPointerCapture(e.pointerId),l=!0,o=e.shiftKey,K(e),M(),r&&a&&x({type:"edit",brush:{...a,radius:t,strength:u,mode:L()}}))},!0),window.addEventListener("pointerup",P),w.addEventListener("lostpointercapture",P),w.addEventListener("pointerleave",()=>{l||(a=null,c=null,S())}),window.addEventListener("blur",()=>{P(),o=!1,S()}),document.addEventListener("visibilitychange",()=>{document.hidden&&P()}),window.addEventListener("keydown",e=>{e.target.matches("input,select")||(o=e.shiftKey,e.key==="Shift"&&S(),e.code==="Space"&&(e.preventDefault(),e.repeat||X(!r)),e.key==="1"&&R("raise"),e.key==="2"&&R("lower"),e.key==="3"&&R("water"),e.key==="4"&&R("drain"),e.key.toLowerCase()==="r"&&!e.repeat&&d("reset").click(),e.key.toLowerCase()==="f"&&i.frameScene(),(e.key==="["||e.key==="]")&&(d("radius").value=String(Math.max(.6,Math.min(7,t+(e.key==="["?-.3:.3)))),Y()))}),window.addEventListener("keyup",e=>{o=e.shiftKey,e.key==="Shift"&&S()}),window.addEventListener("resize",()=>i.resize()),n.onerror=e=>le(`Simulation could not start: ${e.message}. Try a current WebGL2-capable desktop browser.`),n.onmessage=({data:e})=>{if(e.type!=="frame")return;const N=h,ce=new Float32Array(e.buffer);i.update(ce),n.postMessage({type:"recycle",buffer:e.buffer},[e.buffer]),h=!0,v=e.stats,(!N||v.time<m)&&(m=v.time,f=performance.now()),C=e.cost||C;const H=performance.now();H-f>1e3&&(g=(v.time-m)/((H-f)/1e3),m=v.time,f=H)},requestAnimationFrame(J),window.addEventListener("beforeunload",()=>{n.terminate(),i.renderer.dispose()})}catch(w){le(`Unable to initialize WebGL2: ${w.message}. This demo needs a modern desktop browser with hardware acceleration.`)}
