import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const common = /* glsl */`
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
`;
const terrainVertex=/* glsl */`
${common}
void main(){vUv=uv;vec3 p=position;p.y=state(uv).x;vWorld=(modelMatrix*vec4(p,1.)).xyz;vHeightNormal=heightNormal(uv,false);vShadow=terrainShadow(vWorld);gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`;
const terrainFragment=/* glsl */`
${common}
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
`;
const waterVertex=/* glsl */`
${common}
void main(){vUv=uv;vec4 s=state(uv);vec3 p=position;p.y=s.x+s.y+.006;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
`;
const waterFragment=/* glsl */`
${common}
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
`;
export class SandboxRenderer {
  constructor(canvas,n=192,size=60){
    this.n=n;this.size=size;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.65));
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.15;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;
    this.scene=new THREE.Scene();this.scene.background=new THREE.Color('#263633');
    this.camera=new THREE.PerspectiveCamera(42,innerWidth/innerHeight,.2,350);
    this.controls=new OrbitControls(this.camera,canvas);
    this.controls.enableDamping=true;this.controls.dampingFactor=.075;this.controls.minDistance=5;this.controls.maxDistance=125;
    this.controls.maxPolarAngle=Math.PI*.47;this.controls.minPolarAngle=.12;
    this.controls.mouseButtons={LEFT:null,MIDDLE:THREE.MOUSE.PAN,RIGHT:THREE.MOUSE.ROTATE};
    this.controls.touches={ONE:THREE.TOUCH.ROTATE,TWO:THREE.TOUCH.DOLLY_PAN};
    this.controls.enablePan=true;this.controls.panSpeed=.65;this.controls.zoomSpeed=.8;
    this.frameScene();
    this.data=new Float32Array(n*n*4);this.flowData=new Float32Array(n*n*4);this.raw=null;
    const texture=(a)=>{let t=new THREE.DataTexture(a,n,n,THREE.RGBAFormat,THREE.FloatType);t.minFilter=t.magFilter=THREE.LinearFilter;t.generateMipmaps=false;t.needsUpdate=true;return t;};
    this.field=texture(this.data);this.transport=texture(this.flowData);
    this.uniforms={field:{value:this.field},transport:{value:this.transport},gridN:{value:n},fieldSize:{value:size},time:{value:0},viewMode:{value:0},sunDir:{value:new THREE.Vector3(-.6,.72,-.35).normalize()},brush:{value:new THREE.Vector3(0,0,2.4)},brushColor:{value:new THREE.Color('#daefb5')},brushVisible:{value:0}};
    const geo=this.makeGrid(n,size);
    this.terrain=new THREE.Mesh(geo,new THREE.ShaderMaterial({uniforms:this.uniforms,vertexShader:terrainVertex,fragmentShader:terrainFragment}));
    this.terrain.frustumCulled=false;this.scene.add(this.terrain);
    this.target=new THREE.WebGLRenderTarget(1,1,{type:THREE.HalfFloatType,depthBuffer:true});
    this.target.depthTexture=new THREE.DepthTexture(1,1,THREE.UnsignedIntType);
    this.copyScene=new THREE.Scene();this.copyCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.copyScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:{image:{value:this.target.texture},depthImage:{value:this.target.depthTexture}},
      vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:'uniform sampler2D image;uniform sampler2D depthImage;varying vec2 vUv;void main(){gl_FragColor=texture2D(image,vUv);gl_FragDepth=texture2D(depthImage,vUv).x;\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}'
    })));
    this.waterScene=new THREE.Scene();
    this.waterIndices=new Uint32Array((n-1)*(n-1)*6);
    const waterGeo=new THREE.BufferGeometry();waterGeo.setAttribute('position',geo.getAttribute('position'));waterGeo.setAttribute('uv',geo.getAttribute('uv'));waterGeo.setIndex(new THREE.BufferAttribute(this.waterIndices,1).setUsage(THREE.DynamicDrawUsage));waterGeo.setDrawRange(0,0);
    this.waterUniforms={...this.uniforms,background:{value:this.target.texture},resolution:{value:new THREE.Vector2(1,1)}};
    this.water=new THREE.Mesh(waterGeo,new THREE.ShaderMaterial({uniforms:this.waterUniforms,vertexShader:waterVertex,fragmentShader:waterFragment,transparent:true,depthWrite:false,side:THREE.DoubleSide}));
    this.water.renderOrder=2;this.water.frustumCulled=false;this.waterScene.add(this.water);
    this.scene.add(new THREE.HemisphereLight(0xc8e1e2,0x393a2b,2));
    const sun=new THREE.DirectionalLight(0xffe3ac,2.2);sun.position.set(-30,45,-25);this.scene.add(sun);
    this.makeSkirt();
    const base=new THREE.Mesh(new THREE.BoxGeometry(size+.25,1.0,size+.25),new THREE.MeshStandardMaterial({color:0x333e37,roughness:.94}));base.position.y=-1.5;this.scene.add(base);
    const floor=new THREE.Mesh(new THREE.PlaneGeometry(700,700),new THREE.MeshBasicMaterial({color:'#263633'}));floor.rotation.x=-Math.PI/2;floor.position.y=-2.02;this.scene.add(floor);
    // Thin survey brackets keep the extent legible without adding scenic props.
    const lines=[];for(const x of [-1,1])for(const z of [-1,1]){const X=x*30.5,Z=z*30.5;lines.push(X,-1.99,Z,X-x*3,-1.99,Z,X,-1.99,Z,X,-1.99,Z-z*3);}
    const lg=new THREE.BufferGeometry();lg.setAttribute('position',new THREE.Float32BufferAttribute(lines,3));this.scene.add(new THREE.LineSegments(lg,new THREE.LineBasicMaterial({color:0x7c8d74,transparent:true,opacity:.45})));
    this.resize();
  }
  makeGrid(n,size){
    const geo=new THREE.BufferGeometry(),p=new Float32Array(n*n*3),uv=new Float32Array(n*n*2),idx=new Uint32Array((n-1)*(n-1)*6);let k=0;
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){const i=y*n+x;p[i*3]=x/(n-1)*size-size/2;p[i*3+2]=y/(n-1)*size-size/2;uv[i*2]=x/(n-1);uv[i*2+1]=y/(n-1);if(x<n-1 && y<n-1){idx[k++]=i;idx[k++]=i+n;idx[k++]=i+1;idx[k++]=i+1;idx[k++]=i+n;idx[k++]=i+n+1;}}
    geo.setAttribute('position',new THREE.BufferAttribute(p,3));geo.setAttribute('uv',new THREE.BufferAttribute(uv,2));geo.setIndex(new THREE.BufferAttribute(idx,1));return geo;
  }
  makeSkirt(){
    const p=[],uv=[],indices=[],n=this.n,s=this.size;
    const edge=[];for(let x=0;x<n;x++)edge.push([x/(n-1),0]);for(let y=1;y<n;y++)edge.push([1,y/(n-1)]);for(let x=n-2;x>=0;x--)edge.push([x/(n-1),1]);for(let y=n-2;y>=0;y--)edge.push([0,y/(n-1)]);
    edge.forEach(([x,z],i)=>{p.push((x-.5)*s,0,(z-.5)*s,(x-.5)*s,1,(z-.5)*s);uv.push(x,z,x,z);if(i<edge.length-1)indices.push(i*2,i*2+1,i*2+2,i*2+1,i*2+3,i*2+2);});
    const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(p,3));geo.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));geo.setIndex(indices);
    const material=new THREE.ShaderMaterial({uniforms:this.uniforms,side:THREE.DoubleSide,vertexShader:`${common}\nvoid main(){vUv=uv;vec3 p=position;p.y=mix(-1.,state(uv).x,position.y);vWorld=p;gl_Position=projectionMatrix*modelViewMatrix*vec4(p,1.);}`,fragmentShader:`${common}\nvoid main(){vec4 s=state(vUv);float strata=sin(vWorld.y*19.+noise(vWorld.xz*.25)*2.)*.025;float wet=smoothstep(s.x*(1.-s.z),s.x*(1.-s.z)+.4,vWorld.y);vec3 col=mix(vec3(.24,.20,.13),vec3(.40,.32,.20),wet);col*=.82+strata+noise(vWorld.xz*45.+vWorld.yy)*.14;gl_FragColor=vec4(col,1.);\n#include <tonemapping_fragment>\n#include <colorspace_fragment>\n}`});
    const mesh=new THREE.Mesh(geo,material);mesh.frustumCulled=false;this.scene.add(mesh);
  }
  update(packed){
    for(let i=0;i<this.n*this.n;i++){const a=i*8,b=i*4;for(let c=0;c<4;c++){this.data[b+c]=packed[a+c];this.flowData[b+c]=packed[a+c+4];}}
    this.field.needsUpdate=true;this.transport.needsUpdate=true;
    let k=0;const n=this.n;
    for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){
      const i=y*n+x;if(Math.max(this.data[i*4+1],this.data[(i+1)*4+1],this.data[(i+n)*4+1],this.data[(i+n+1)*4+1])<.002)continue;
      this.waterIndices[k++]=i;this.waterIndices[k++]=i+n;this.waterIndices[k++]=i+1;this.waterIndices[k++]=i+1;this.waterIndices[k++]=i+n;this.waterIndices[k++]=i+n+1;
    }
    this.water.geometry.index.needsUpdate=true;this.water.geometry.setDrawRange(0,k);
  }
  frameScene(){this.camera.position.set(52,49,66);this.controls.target.set(2,2,-1);this.controls.update();}
  resize(){
    this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
    const v=new THREE.Vector2();this.renderer.getDrawingBufferSize(v);this.target.setSize(v.x,v.y);this.waterUniforms.resolution.value.copy(v);
  }
  render(time){
    this.uniforms.time.value=time;this.controls.update();
    // Clamp panning to the field, keeping navigation recoverable with F.
    this.controls.target.x=THREE.MathUtils.clamp(this.controls.target.x,-38,38);this.controls.target.z=THREE.MathUtils.clamp(this.controls.target.z,-38,38);
    const waterVisible=this.uniforms.viewMode.value===0||this.uniforms.viewMode.value===3;
    this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);
    this.renderer.setRenderTarget(null);this.renderer.render(this.copyScene,this.copyCamera);
    if(waterVisible){this.renderer.autoClear=false;this.renderer.render(this.waterScene,this.camera);this.renderer.autoClear=true;}
  }
  // CPU ray/heightfield intersection: picking exactly follows the displaced
  // surface instead of raycasting the undeformed GPU mesh or a flat y=0 plane.
  pick(clientX,clientY){
    const ray=new THREE.Raycaster();ray.setFromCamera(new THREE.Vector2(clientX/innerWidth*2-1,1-clientY/innerHeight*2),this.camera);
    const r=ray.ray,box=new THREE.Box3(new THREE.Vector3(-30,-.1,-30),new THREE.Vector3(30,25,30));
    const near=r.intersectBox(box,new THREE.Vector3());if(!near)return null;
    let t=Math.max(0,near.clone().sub(r.origin).dot(r.direction)),last=t,prev=100;
    const point=new THREE.Vector3();
    for(let k=0;k<500;k++){
      r.at(t,point);if(point.x<-30.01||point.x>30.01||point.z<-30.01||point.z>30.01||point.y<-.2)return null;
      const surface=this.sample(point.x,point.z),diff=point.y-surface.height-surface.water;
      if(diff<=0 && prev>0){let lo=last,hi=t;for(let j=0;j<10;j++){const mid=(lo+hi)/2;r.at(mid,point);const a=this.sample(point.x,point.z);if(point.y>a.height+a.water)lo=mid;else hi=mid;}r.at((lo+hi)/2,point);return {x:point.x,z:point.z,...this.sample(point.x,point.z)};}
      prev=diff;last=t;t+=.25;
    }
    return null;
  }
  sample(x,z){
    const n=this.n,gx=THREE.MathUtils.clamp((x/this.size+.5)*(n-1),0,n-1.001),gz=THREE.MathUtils.clamp((z/this.size+.5)*(n-1),0,n-1.001),ix=gx|0,iz=gz|0,fx=gx-ix,fz=gz-iz,i=(iz*n+ix)*4;
    const sample=(data,c)=>((data[i+c]*(1-fx)+data[i+4+c]*fx)*(1-fz)+(data[i+n*4+c]*(1-fx)+data[i+(n+1)*4+c]*fx)*fz);
    return {height:sample(this.data,0),water:sample(this.data,1),saturation:sample(this.data,2),wet:sample(this.data,3),speed:Math.hypot(sample(this.flowData,0),sample(this.flowData,1)),change:sample(this.flowData,3)};
  }
}
