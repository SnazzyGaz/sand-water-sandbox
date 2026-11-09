import{W as ue,A as he,e as Z,f as I,g as ee,h as me,M as te,T as re,i as ve,j as ae,b as C,H as ie,V as F,k as B,a as $,O as oe,l as N,m as q,n as P,o as pe,U as fe,B as V,p as _,q as ge,c as Q,r as se,s as we,t as xe,u as ye,v as be,w as Se,x as j,y as ke,z as Me,E as ne,G as De,d as O,I as ze,J as Le,K as Ne,F as Ue}from"./three-core-1bQ-A291.js";import{O as Ee,H as Ce}from"./three-controls-CsOF_Nam.js";(function(){const a=document.createElement("link").relList;if(a&&a.supports&&a.supports("modulepreload"))return;for(const r of document.querySelectorAll('link[rel="modulepreload"]'))o(r);new MutationObserver(r=>{for(const l of r)if(l.type==="childList")for(const s of l.addedNodes)s.tagName==="LINK"&&s.rel==="modulepreload"&&o(s)}).observe(document,{childList:!0,subtree:!0});function n(r){const l={};return r.integrity&&(l.integrity=r.integrity),r.referrerPolicy&&(l.referrerPolicy=r.referrerPolicy),r.crossOrigin==="use-credentials"?l.credentials="include":r.crossOrigin==="anonymous"?l.credentials="omit":l.credentials="same-origin",l}function o(r){if(r.ep)return;r.ep=!0;const l=n(r);fetch(r.href,l)}})();const U=`
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
vec2 sandHash(vec2 cell){
 return fract(sin(vec2(dot(cell,vec2(127.1,311.7)),dot(cell,vec2(269.5,183.3))))*43758.5453);
}
void sandPatch(vec2 p,vec2 dx,vec2 dy,vec2 cell,out vec3 color,out vec2 slope){
 vec2 seed=sandHash(cell);
 float angle=seed.x*6.2831853,c=cos(angle),s=sin(angle);
 mat2 rotation=mat2(c,s,-s,c);
 float scale=mix(.92,1.08,seed.y);
 vec2 uv=rotation*p*scale+seed*17.13;
 // Explicit, transformed gradients exclude discontinuous cell IDs from LOD:
 // otherwise mip selection blurs the grain along triangle boundaries.
 color=textureGrad(sandColor,uv,rotation*dx*scale,rotation*dy*scale).rgb;
 vec3 normal=textureGrad(sandNormal,uv,rotation*dx*scale,rotation*dy*scale).xyz*2.-1.;
 // Blend surface slopes, not unit normals. Inverse rotation brings the sampled
 // tangent normal back to world XZ, matching the rotated albedo exactly.
 vec2 localSlope=normal.xy/max(normal.z,.25);
 slope=vec2(dot(rotation[0],localSlope),dot(rotation[1],localSlope))*scale;
}
void sampleSand(vec2 world,out vec3 color,out vec2 slope){
 vec2 p=world/1.5,dx=dFdx(p),dy=dFdy(p);
 // Equilateral lattice, at roughly one photographic tile per hex cell.
 vec2 lattice=vec2(p.x-p.y*.5773502692,p.y*1.1547005384);
 vec2 cell=floor(lattice),f=fract(lattice);
 vec2 a,b,c;vec3 weights;
 if(f.x+f.y<1.){
  a=cell;b=cell+vec2(1.,0.);c=cell+vec2(0.,1.);
  weights=vec3(1.-f.x-f.y,f.x,f.y);
 }else{
  a=cell+vec2(1.);b=cell+vec2(0.,1.);c=cell+vec2(1.,0.);
  weights=vec3(f.x+f.y-1.,1.-f.x,1.-f.y);
 }
 // Smooth, sharpened weights keep most of each patch photographic, rather
 // than washing three samples into mud. Soft transitions avoid visible hex outlines.
 weights=weights*weights*weights;weights/=dot(weights,vec3(1.));
 vec3 ca,cb,cc;vec2 na,nb,nc;
 sandPatch(p,dx,dy,a,ca,na);sandPatch(p,dx,dy,b,cb,nb);sandPatch(p,dx,dy,c,cc,nc);
 color=ca*weights.x+cb*weights.y+cc*weights.z;
 float varianceGain=inversesqrt(dot(weights,weights));
 // Approximate variance preservation in the blend zones, bounded to avoid
 // over-contrast. The mean is the linear-light mean of the sand photograph.
 const vec3 meanSand=vec3(.381,.305,.161);
 color=max(vec3(0.),meanSand+(color-meanSand)*mix(1.,varianceGain,.65));
 slope=(na*weights.x+nb*weights.y+nc*weights.z)*varianceGain;
}
`,Ae=`
${U}
${Te}
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
 vec3 photo;vec2 photoSlope;sampleSand(vWorld.xz,photo,photoSlope);
 // Broad non-periodic tint plus a separate, incommensurate micro-grain scale.
 // Keep variation subtle: the photograph, not procedural noise, supplies detail.
 vec3 dry=photo*(.92+.16*macro)*mix(vec3(.97,1.,1.025),vec3(1.025,1.,.97),noise(vWorld.xz*.13));
 vec3 albedo=mix(dry,dry*vec3(.27,.30,.32),pow(wet,.65));
 albedo*=.88+.14*grit.r+.09*meso+.025*ripple*flatness*(1.-wet);
 // Mipmapped grain normals retain millimetre detail nearby without sparkling
 // aliasing in the overview. Wet grains smooth down under the surface film.
 vec2 bump=photoSlope*.85+(grit.gb*2.-1.)*.15+(fineGrit.gb*2.-1.)*.10;
 // Reorient the detail to the actual bank normal, then renormalize once.
 vec3 tangent=normalize(vec3(N.y,-N.x,0.));
 vec3 bitangent=cross(tangent,N);
 N=normalize(N+(tangent*bump.x+bitangent*bump.y)*mix(1.,.32,wet));
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
`,Re=`
${U}
void main(){vUv=uv;vec4 s=state(uv);vec3 p=position;p.y=s.x+s.y+.006;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`,Pe=`
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
`;class We{constructor(a,n=192,o=60){this.n=n,this.size=o,this.renderer=new ue({canvas:a,antialias:!0,powerPreference:"high-performance"}),this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));const r=this.renderer.getContext(),l=r.getExtension("WEBGL_debug_renderer_info");this.gpuName=l?r.getParameter(l.UNMASKED_RENDERER_WEBGL):"WebGL2",this.software=/swiftshader|llvmpipe|software/i.test(this.gpuName),this.renderMs=0,this.renderGpuMs=null,this.timerExtension=r.getExtension("EXT_disjoint_timer_query_webgl2"),this.gpuQuery=null,this.renderer.toneMapping=he,this.renderer.toneMappingExposure=.9,this.renderer.outputColorSpace=Z,this.scene=new I,this.scene.background=new ee("#263633"),this.camera=new me(42,innerWidth/innerHeight,.2,350),this.controls=new Ee(this.camera,a),this.controls.enableDamping=!0,this.controls.dampingFactor=.075,this.controls.minDistance=5,this.controls.maxDistance=125,this.controls.maxPolarAngle=Math.PI*.47,this.controls.minPolarAngle=.12,this.controls.mouseButtons={LEFT:null,MIDDLE:te.PAN,RIGHT:te.ROTATE},this.controls.touches={ONE:re.ROTATE,TWO:re.DOLLY_PAN},this.controls.enablePan=!0,this.controls.panSpeed=.65,this.controls.zoomSpeed=.8,this.frameScene(),this.data=new Float32Array(n*n*4),this.flowData=new Float32Array(n*n*4),this.raw=null;const s=m=>{let v=new ne(m,n,n,Ne,Ue);return v.minFilter=v.magFilter=C,v.generateMipmaps=!1,v.needsUpdate=!0,v};this.field=s(this.data),this.transport=s(this.flowData),this.grainTexture=this.makeGrains();const i=new ve,d=m=>`/sand-water-sandbox/textures/${m}`,h=(m,v=!1)=>{const g=i.load(d(m));return g.wrapS=g.wrapT=B,g.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),v&&(g.colorSpace=Z),g};this.sandColor=h("sand-color.jpg",!0),this.sandNormal=h("sand-normal.jpg"),this.lightTarget=new ae(n,n,{type:ie,minFilter:C,magFilter:C,depthBuffer:!1}),this.lightDirty=!0,this.uniforms={sandColor:{value:this.sandColor},sandNormal:{value:this.sandNormal},skyMap:{value:this.grainTexture},skyReady:{value:0},skyRotation:{value:0},surfaceLight:{value:this.lightTarget.texture},grains:{value:this.grainTexture},field:{value:this.field},transport:{value:this.transport},gridN:{value:n},fieldSize:{value:o},time:{value:0},viewMode:{value:0},sunDir:{value:new F(-.76,.52,-.38).normalize()},brush:{value:new F(0,0,2.4)},brushColor:{value:new ee("#daefb5")},brushVisible:{value:0}},new Ce().load(d("quarry-sky.hdr"),m=>{m.wrapS=B,m.magFilter=C,m.minFilter=C,this.uniforms.skyMap.value=m,this.uniforms.skyReady.value=1;const{data:v,width:g,height:f}=m.image;let E=-1,x=0;for(let k=0;k<g*f/2;k++){const z=$.fromHalfFloat(v[k*4])+$.fromHalfFloat(v[k*4+1])+$.fromHalfFloat(v[k*4+2]);z>E&&(E=z,x=k)}const T=(.5-((x/g|0)+.5)/f)*Math.PI,A=Math.atan2(-.38,-.76),G=((x%g+.5)/g-.5)*2*Math.PI;this.uniforms.skyRotation.value=G-A,this.uniforms.sunDir.value.set(Math.cos(A)*Math.cos(T),Math.sin(T),Math.sin(A)*Math.cos(T)),this.lightDirty=!0}),this.lightScene=new I,this.lightCamera=new oe(-1,1,1,-1,0,1),this.lightScene.add(new N(new q(2,2),new P({uniforms:this.uniforms,toneMapped:!1,vertexShader:"varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=vec3(0.);gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:`${U}
      void main(){vec2 uv=(vUv*gridN-.5)/(gridN-1.);vec3 N=heightNormal(uv,false);vec3 w=vec3((uv.x-.5)*fieldSize,state(uv).x,(uv.y-.5)*fieldSize);gl_FragColor=vec4(N*.5+.5,terrainShadow(w));}`})));const t=this.makeGrid(n,o);this.terrain=new N(t,new P({uniforms:this.uniforms,vertexShader:Fe,fragmentShader:Ae})),this.terrain.frustumCulled=!1,this.scene.add(this.terrain),this.target=new ae(1,1,{type:ie,depthBuffer:!0}),this.target.depthTexture=new pe(1,1,fe),this.copyScene=new I,this.copyCamera=new oe(-1,1,1,-1,0,1),this.copyScene.add(new N(new q(2,2),new P({uniforms:{image:{value:this.target.texture},depthImage:{value:this.target.depthTexture}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}",fragmentShader:`uniform sampler2D image;uniform sampler2D depthImage;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);gl_FragDepth=texture2D(depthImage,vUv).x;
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}))),this.waterScene=new I,this.waterIndices=new Uint32Array((n-1)*(n-1)*6);const u=new V;u.setAttribute("position",t.getAttribute("position")),u.setAttribute("uv",t.getAttribute("uv")),u.setIndex(new _(this.waterIndices,1).setUsage(ge)),u.setDrawRange(0,0),this.waterUniforms={...this.uniforms,background:{value:this.target.texture},resolution:{value:new Q(1,1)}},this.water=new N(u,new P({uniforms:this.waterUniforms,vertexShader:Re,fragmentShader:Pe,transparent:!0,depthWrite:!1,side:se})),this.water.renderOrder=2,this.water.frustumCulled=!1,this.waterScene.add(this.water),this.scene.add(new we(13165026,3750443,2));const p=new xe(16769964,2.2);p.position.set(-30,45,-25),this.scene.add(p),this.makeSkirt();const y=new N(new ye(o+.25,1,o+.25),new be({color:3358263,roughness:.94}));y.position.y=-1.5,this.scene.add(y);const b=new N(new q(700,700),new Se({color:"#263633"}));b.rotation.x=-Math.PI/2,b.position.y=-2.02,this.scene.add(b);const S=[];for(const m of[-1,1])for(const v of[-1,1]){const g=m*30.5,f=v*30.5;S.push(g,-1.99,f,g-m*3,-1.99,f,g,-1.99,f,g,-1.99,f-v*3)}const D=new V;D.setAttribute("position",new j(S,3)),this.scene.add(new ke(D,new Me({color:8162676,transparent:!0,opacity:.45}))),this.resize()}makeGrains(){const n=new Uint8Array(4194304),o=new Float32Array(1024*1024);let r=789234;const l=()=>(r=Math.imul(r,1664525)+1013904223|0,(r>>>0)/4294967296);for(let i=0;i<1024*1024;i++)o[i]=l();for(let i=0;i<1024;i++)for(let d=0;d<1024;d++){const h=i*1024+d,t=h*4,u=o[h];n[t]=Math.round(105+145*u),n[t+1]=Math.round(128+100*(o[i*1024+(d+1)%1024]-o[i*1024+(d+1024-1)%1024])),n[t+2]=Math.round(128+100*(o[(i+1)%1024*1024+d]-o[(i+1024-1)%1024*1024+d])),n[t+3]=Math.round(255*l())}const s=new ne(n,1024,1024);return s.wrapS=s.wrapT=B,s.magFilter=C,s.minFilter=De,s.generateMipmaps=!0,s.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy()),s.needsUpdate=!0,s}makeGrid(a,n){const o=new V,r=new Float32Array(a*a*3),l=new Float32Array(a*a*2),s=new Uint32Array((a-1)*(a-1)*6);let i=0;for(let d=0;d<a;d++)for(let h=0;h<a;h++){const t=d*a+h;r[t*3]=h/(a-1)*n-n/2,r[t*3+2]=d/(a-1)*n-n/2,l[t*2]=h/(a-1),l[t*2+1]=d/(a-1),h<a-1&&d<a-1&&(s[i++]=t,s[i++]=t+a,s[i++]=t+1,s[i++]=t+1,s[i++]=t+a,s[i++]=t+a+1)}return o.setAttribute("position",new _(r,3)),o.setAttribute("uv",new _(l,2)),o.setIndex(new _(s,1)),o}makeSkirt(){const a=[],n=[],o=[],r=this.n,l=this.size,s=[];for(let t=0;t<r;t++)s.push([t/(r-1),0]);for(let t=1;t<r;t++)s.push([1,t/(r-1)]);for(let t=r-2;t>=0;t--)s.push([t/(r-1),1]);for(let t=r-2;t>=0;t--)s.push([0,t/(r-1)]);s.forEach(([t,u],p)=>{a.push((t-.5)*l,0,(u-.5)*l,(t-.5)*l,1,(u-.5)*l),n.push(t,u,t,u),p<s.length-1&&o.push(p*2,p*2+1,p*2+2,p*2+1,p*2+3,p*2+2)});const i=new V;i.setAttribute("position",new j(a,3)),i.setAttribute("uv",new j(n,2)),i.setIndex(o);const d=new P({uniforms:this.uniforms,side:se,vertexShader:`${U}
void main(){vUv=uv;vec3 p=position;p.y=mix(-1.,state(uv).x,position.y);vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`${U}
void main(){vec4 s=state(vUv);float strata=sin(vWorld.y*19.+noise(vWorld.xz*.25)*2.)*.025;float wet=smoothstep(s.x*(1.-s.z),s.x*(1.-s.z)+.4,vWorld.y);vec3 col=mix(vec3(.24,.20,.13),vec3(.40,.32,.20),wet);col*=.82+strata+noise(vWorld.xz*45.+vWorld.yy)*.14;gl_FragColor=vec4(col,1.);
#include <tonemapping_fragment>
#include <colorspace_fragment>
}`}),h=new N(i,d);h.frustumCulled=!1,this.scene.add(h)}update(a){this.data.set(a.subarray(0,this.data.length)),this.flowData.set(a.subarray(this.data.length)),this.field.needsUpdate=!0,this.transport.needsUpdate=!0,this.lightDirty=!0;let n=0;const o=this.n;for(let r=0;r<o-1;r++)for(let l=0;l<o-1;l++){const s=r*o+l;Math.max(this.data[s*4+1],this.data[(s+1)*4+1],this.data[(s+o)*4+1],this.data[(s+o+1)*4+1])<.002||(this.waterIndices[n++]=s,this.waterIndices[n++]=s+o,this.waterIndices[n++]=s+1,this.waterIndices[n++]=s+1,this.waterIndices[n++]=s+o,this.waterIndices[n++]=s+o+1)}this.water.geometry.index.needsUpdate=!0,this.water.geometry.setDrawRange(0,n)}frameScene(){this.camera.position.set(16,34,22),this.controls.target.set(0,2,0),this.controls.update()}resize(){this.renderer.setPixelRatio(Math.min(devicePixelRatio,2)),this.renderer.setSize(innerWidth,innerHeight),this.camera.aspect=innerWidth/innerHeight,this.camera.updateProjectionMatrix();const a=new Q;this.renderer.getDrawingBufferSize(a),this.target.setSize(a.x,a.y),this.waterUniforms.resolution.value.copy(a)}render(a){const n=performance.now(),o=this.renderer.getContext(),r=this.timerExtension;this.gpuQuery&&o.getQueryParameter(this.gpuQuery,o.QUERY_RESULT_AVAILABLE)&&(o.getParameter(r.GPU_DISJOINT_EXT)||(this.renderGpuMs=o.getQueryParameter(this.gpuQuery,o.QUERY_RESULT)/1e6),o.deleteQuery(this.gpuQuery),this.gpuQuery=null);let l=null;r&&!this.gpuQuery&&(l=o.createQuery(),o.beginQuery(r.TIME_ELAPSED_EXT,l)),this.uniforms.time.value=a,this.controls.update(),this.controls.target.x=O.clamp(this.controls.target.x,-38,38),this.controls.target.z=O.clamp(this.controls.target.z,-38,38);const s=this.uniforms.viewMode.value===0||this.uniforms.viewMode.value===3;this.lightDirty&&(this.renderer.setRenderTarget(this.lightTarget),this.renderer.render(this.lightScene,this.lightCamera),this.lightDirty=!1),this.renderer.setRenderTarget(this.target),this.renderer.render(this.scene,this.camera),this.renderer.setRenderTarget(null),this.renderer.render(this.copyScene,this.copyCamera),s&&(this.renderer.autoClear=!1,this.renderer.render(this.waterScene,this.camera),this.renderer.autoClear=!0),l&&(o.endQuery(r.TIME_ELAPSED_EXT),this.gpuQuery=l),this.renderMs=performance.now()-n}pick(a,n){const o=new ze;o.setFromCamera(new Q(a/innerWidth*2-1,1-n/innerHeight*2),this.camera);const r=o.ray,l=new Le(new F(-30,-.1,-30),new F(30,25,30)),s=r.intersectBox(l,new F);if(!s)return null;let i=Math.max(0,s.clone().sub(r.origin).dot(r.direction)),d=i,h=100;const t=new F;for(let u=0;u<500;u++){if(r.at(i,t),t.x<-30.01||t.x>30.01||t.z<-30.01||t.z>30.01||t.y<-.2)return null;const p=this.sample(t.x,t.z),y=t.y-p.height-p.water;if(y<=0&&h>0){let b=d,S=i;for(let D=0;D<10;D++){const m=(b+S)/2;r.at(m,t);const v=this.sample(t.x,t.z);t.y>v.height+v.water?b=m:S=m}return r.at((b+S)/2,t),{x:t.x,z:t.z,...this.sample(t.x,t.z)}}h=y,d=i,i+=.25}return null}sample(a,n){const o=this.n,r=O.clamp((a/this.size+.5)*(o-1),0,o-1.001),l=O.clamp((n/this.size+.5)*(o-1),0,o-1.001),s=r|0,i=l|0,d=r-s,h=l-i,t=(i*o+s)*4,u=(p,y)=>(p[t+y]*(1-d)+p[t+4+y]*d)*(1-h)+(p[t+o*4+y]*(1-d)+p[t+(o+1)*4+y]*d)*h;return{height:u(this.data,0),water:u(this.data,1),saturation:u(this.data,2),wet:u(this.data,3),speed:Math.hypot(u(this.flowData,0),u(this.flowData,1)),change:u(this.flowData,3)}}}const c=w=>document.getElementById(w);function le(w){c("error").hidden=!1,c("error").textContent=w,console.error(w)}try{let k=function(){c("intro").style.opacity=0,c("intro").style.pointerEvents="none"},z=function(){return s?T[o]:o},M=function(){a.uniforms.brushVisible.value=i?1:0,i&&a.uniforms.brush.value.set(i.x,i.z,t),a.uniforms.brushColor.value.set(G[z()]),c("mode-label").textContent=A[z()];const e=l&&i?{x:i.x,z:i.z,radius:t,strength:u,mode:z()}:null;x({type:"brush",brush:e})},R=function(e){o=e,document.querySelectorAll(".mode").forEach(L=>{L.classList.toggle("active",L.dataset.mode===e),L.setAttribute("aria-pressed",String(L.dataset.mode===e))}),M()},Y=function(){t=+c("radius").value,c("radius-value").textContent=`${t.toFixed(1)} m`,M()},X=function(e){r=e,m=f.time||0,v=performance.now(),c("pause").innerHTML=e?"Resume <kbd>Space</kbd>":"Pause <kbd>Space</kbd>",c("live").textContent=e?"SIMULATION PAUSED":"COUPLED SIMULATION",x({type:"pause",paused:r}),M()},K=function(e){h&&(d={x:e.clientX,y:e.clientY},i=a.pick(e.clientX,e.clientY),M())},W=function(){l&&(l=!1,x({type:"brush",brush:null}))},J=function(e){if(requestAnimationFrame(J),b++,e-S>750&&(D=Math.round(b*1e3/(e-S)),b=0,S=e),d&&e-p>80){if(i=a.pick(d.x,d.y),M(),p=e,i){const L=i.saturation>.86?"SATURATED / LOW COHESION":i.saturation>.08?"MOIST / CAPILLARY COHESION":i.wet>.2?"DAMP SURFACE":"DRY / FRICTIONAL SAND";c("probe-state").textContent=L,c("probe-values").textContent=`${Math.round(i.saturation*100)}% pore saturation · ${i.water.toFixed(2)} m water · ${i.speed.toFixed(2)} m/s`}r&&l&&i&&x({type:"edit",brush:{...i,radius:t,strength:u,mode:z()}})}e-y>350&&h&&(c("water-stat").textContent=`${f.surface.toFixed(1)} m³`,c("pore-stat").textContent=`${f.pore.toFixed(1)} m³`,c("drained-stat").textContent=`${f.drained.toFixed(1)} m³`,c("eroded-stat").textContent=`${f.eroded.toFixed(2)} m³`,c("performance").textContent=`192² physics · sparse CPU worker · ${D} fps · ${r?"paused":g.toFixed(2)+"× time"} · ${f.time.toFixed(1)} s${a.software?" · SOFTWARE WebGL":""}`,y=e,window.sandboxDiagnostics={...f,fps:D,simRate:g,solverMs:E,pixelRatio:a.renderer.getPixelRatio(),renderer:a.gpuName,renderSubmitMs:a.renderMs,renderGpuMs:a.renderGpuMs,ready:h,paused:r,mode:o}),a.render(f.time||0)};const w=c("scene"),a=new We(w),n=new Worker(new URL("/sand-water-sandbox/assets/worker-QYJYZJUV.js",import.meta.url),{type:"module"});let o="raise",r=!1,l=!1,s=!1,i=null,d=null,h=!1,t=2.4,u=.6,p=0,y=0,b=0,S=performance.now(),D=0,m=0,v=performance.now(),g=1,f={},E=0;const x=e=>n.postMessage(e),T={raise:"lower",lower:"raise",water:"drain",drain:"water"},A={raise:"raise sand",lower:"lower sand",water:"pour water",drain:"remove surface water"},G={raise:"#dcebb4",lower:"#f6b787",water:"#a3e3e5",drain:"#c1b5f1"};c("dismiss").onclick=k,document.querySelectorAll(".mode").forEach(e=>e.onclick=()=>R(e.dataset.mode)),c("radius").oninput=Y,c("strength").oninput=()=>{u=+c("strength").value/100,c("strength-value").textContent=`${Math.round(u*100)}%`,M()},c("pause").onclick=()=>X(!r),c("reset").onclick=()=>{l=!1,i=null,x({type:"brush",brush:null}),x({type:"reset"})},c("camera").onclick=()=>a.frameScene(),c("flood").onclick=()=>{x({type:"pour",x:i?.x??0,z:i?.z??-18}),k()},c("spring").onchange=()=>x({type:"options",options:{spring:c("spring").checked}}),c("underdrain").onchange=()=>x({type:"options",options:{underdrain:c("underdrain").checked}}),c("erosion").oninput=()=>{const e=+c("erosion").value;c("erosion-value").textContent=`${e.toFixed(1)}×`,x({type:"options",options:{erosion:e}})};const ce=["Light sand → damp → dark saturated banks","Ochre: dry · green: moist · blue: saturated","Orange: removed · green: deposited · ±0.3 m","Dark: still · teal: sheet flow · amber: 3.5 m/s"];c("view").onchange=()=>{const e=+c("view").value;a.uniforms.viewMode.value=e,c("view-key").textContent=ce[e]},c("collapse").onclick=()=>{const e=c("tools-body");e.hidden=!e.hidden,c("collapse").textContent=e.hidden?"+":"−"},w.addEventListener("contextmenu",e=>e.preventDefault()),w.addEventListener("pointermove",e=>{e.pointerType!=="touch"&&K(e)}),w.addEventListener("pointerdown",e=>{e.button!==0||e.pointerType==="touch"||(e.preventDefault(),e.stopImmediatePropagation(),w.setPointerCapture(e.pointerId),l=!0,s=e.shiftKey,K(e),k(),r&&i&&x({type:"edit",brush:{...i,radius:t,strength:u,mode:z()}}))},!0),window.addEventListener("pointerup",W),w.addEventListener("lostpointercapture",W),w.addEventListener("pointerleave",()=>{l||(i=null,d=null,M())}),window.addEventListener("blur",()=>{W(),s=!1,M()}),document.addEventListener("visibilitychange",()=>{document.hidden&&W()}),window.addEventListener("keydown",e=>{e.target.matches("input,select")||(s=e.shiftKey,e.key==="Shift"&&M(),e.code==="Space"&&(e.preventDefault(),e.repeat||X(!r)),e.key==="1"&&R("raise"),e.key==="2"&&R("lower"),e.key==="3"&&R("water"),e.key==="4"&&R("drain"),e.key.toLowerCase()==="r"&&!e.repeat&&c("reset").click(),e.key.toLowerCase()==="f"&&a.frameScene(),(e.key==="["||e.key==="]")&&(c("radius").value=String(Math.max(.6,Math.min(7,t+(e.key==="["?-.3:.3)))),Y()))}),window.addEventListener("keyup",e=>{s=e.shiftKey,e.key==="Shift"&&M()}),window.addEventListener("resize",()=>a.resize()),n.onerror=e=>le(`Simulation could not start: ${e.message}. Try a current WebGL2-capable desktop browser.`),n.onmessage=({data:e})=>{if(e.type!=="frame")return;const L=h,de=new Float32Array(e.buffer);a.update(de),n.postMessage({type:"recycle",buffer:e.buffer},[e.buffer]),h=!0,f=e.stats,(!L||f.time<m)&&(m=f.time,v=performance.now()),E=e.cost||E;const H=performance.now();H-v>1e3&&(g=(f.time-m)/((H-v)/1e3),m=f.time,v=H)},requestAnimationFrame(J),window.addEventListener("beforeunload",()=>{n.terminate(),a.renderer.dispose()})}catch(w){le(`Unable to initialize WebGL2: ${w.message}. This demo needs a modern desktop browser with hardware acceleration.`)}
