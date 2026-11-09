import * as THREE from 'three';
import { HDRLoader } from 'three/addons/loaders/HDRLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
const common = /* glsl */`
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
`;
const terrainVertex=/* glsl */`
${common}
void main(){vUv=uv;vec3 p=position;p.y=state(uv).x;vWorld=(modelMatrix*vec4(p,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}
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
`;
export class SandboxRenderer {
  constructor(canvas,n=192,size=60){
    this.n=n;this.size=size;
    this.renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    const gl=this.renderer.getContext(), info=gl.getExtension('WEBGL_debug_renderer_info');
    this.gpuName=info?gl.getParameter(info.UNMASKED_RENDERER_WEBGL):'WebGL2';
    this.software=/swiftshader|llvmpipe|software/i.test(this.gpuName);
    this.renderMs=0;this.renderGpuMs=null;this.timerExtension=gl.getExtension('EXT_disjoint_timer_query_webgl2');this.gpuQuery=null;
    this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=.90;
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
    this.grainTexture=this.makeGrains();
    const loader=new THREE.TextureLoader(),asset=path=>`${import.meta.env.BASE_URL}textures/${path}`;
    const repeat=(path,color=false)=>{const t=loader.load(asset(path));t.wrapS=t.wrapT=THREE.RepeatWrapping;t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());if(color)t.colorSpace=THREE.SRGBColorSpace;return t;};
    this.sandColor=repeat('sand-color.jpg',true);this.sandNormal=repeat('sand-normal.jpg');
    this.lightTarget=new THREE.WebGLRenderTarget(n,n,{type:THREE.HalfFloatType,minFilter:THREE.LinearFilter,magFilter:THREE.LinearFilter,depthBuffer:false});
    this.lightDirty=true;
    this.uniforms={sandColor:{value:this.sandColor},sandNormal:{value:this.sandNormal},skyMap:{value:this.grainTexture},skyReady:{value:0},skyRotation:{value:0},surfaceLight:{value:this.lightTarget.texture},grains:{value:this.grainTexture},field:{value:this.field},transport:{value:this.transport},gridN:{value:n},fieldSize:{value:size},time:{value:0},viewMode:{value:0},sunDir:{value:new THREE.Vector3(-.76,.52,-.38).normalize()},brush:{value:new THREE.Vector3(0,0,2.4)},brushColor:{value:new THREE.Color('#daefb5')},brushVisible:{value:0}};
    new HDRLoader().load(asset('quarry-sky.hdr'),t=>{
      t.wrapS=THREE.RepeatWrapping;t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearFilter;
      this.uniforms.skyMap.value=t;this.uniforms.skyReady.value=1;
      // Match the direct light to the photographed sun, rather than introducing
      // a second, contradictory source in pool reflections.
      const {data,width,height}=t.image;let best=-1,index=0;
      for(let i=0;i<width*height/2;i++){
        const luminance=THREE.DataUtils.fromHalfFloat(data[i*4])+THREE.DataUtils.fromHalfFloat(data[i*4+1])+THREE.DataUtils.fromHalfFloat(data[i*4+2]);
        if(luminance>best){best=luminance;index=i;}
      }
      const elevation=(.5-((index/width|0)+.5)/height)*Math.PI;
      const azimuth=Math.atan2(-.38,-.76),phi=((index%width+.5)/width-.5)*2*Math.PI;
      this.uniforms.skyRotation.value=phi-azimuth;
      this.uniforms.sunDir.value.set(Math.cos(azimuth)*Math.cos(elevation),Math.sin(elevation),Math.sin(azimuth)*Math.cos(elevation));
      this.lightDirty=true;
    });
    this.lightScene=new THREE.Scene();this.lightCamera=new THREE.OrthographicCamera(-1,1,1,-1,0,1);
    this.lightScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2,2),new THREE.ShaderMaterial({
      uniforms:this.uniforms,toneMapped:false,
      vertexShader:'varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=vec3(0.);gl_Position=vec4(position.xy,0.,1.);}',
      fragmentShader:`${common}
      void main(){vec2 uv=(vUv*gridN-.5)/(gridN-1.);vec3 N=heightNormal(uv,false);vec3 w=vec3((uv.x-.5)*fieldSize,state(uv).x,(uv.y-.5)*fieldSize);gl_FragColor=vec4(N*.5+.5,terrainShadow(w));}`
    })));
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
  makeGrains(){
    // Deterministic, original seamless grain microtexture. No external assets.
    const n=1024,a=new Uint8Array(n*n*4),height=new Float32Array(n*n);let seed=789234;
    const random=()=>{seed=(Math.imul(seed,1664525)+1013904223)|0;return (seed>>>0)/4294967296;};
    for(let i=0;i<n*n;i++)height[i]=random();
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=y*n+x,k=i*4,h=height[i];
      a[k]=Math.round(105+145*h);
      a[k+1]=Math.round(128+100*(height[y*n+(x+1)%n]-height[y*n+(x+n-1)%n]));
      a[k+2]=Math.round(128+100*(height[((y+1)%n)*n+x]-height[((y+n-1)%n)*n+x]));
      a[k+3]=Math.round(255*random());
    }
    const t=new THREE.DataTexture(a,n,n);t.wrapS=t.wrapT=THREE.RepeatWrapping;
    t.magFilter=THREE.LinearFilter;t.minFilter=THREE.LinearMipmapLinearFilter;t.generateMipmaps=true;
    t.anisotropy=Math.min(8,this.renderer.capabilities.getMaxAnisotropy());t.needsUpdate=true;return t;
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
    this.data.set(packed.subarray(0,this.data.length));
    this.flowData.set(packed.subarray(this.data.length));
    this.field.needsUpdate=true;this.transport.needsUpdate=true;this.lightDirty=true;
    let k=0;const n=this.n;
    for(let y=0;y<n-1;y++)for(let x=0;x<n-1;x++){
      const i=y*n+x;if(Math.max(this.data[i*4+1],this.data[(i+1)*4+1],this.data[(i+n)*4+1],this.data[(i+n+1)*4+1])<.002)continue;
      this.waterIndices[k++]=i;this.waterIndices[k++]=i+n;this.waterIndices[k++]=i+1;this.waterIndices[k++]=i+1;this.waterIndices[k++]=i+n;this.waterIndices[k++]=i+n+1;
    }
    this.water.geometry.index.needsUpdate=true;this.water.geometry.setDrawRange(0,k);
  }
  frameScene(){this.camera.position.set(16,34,22);this.controls.target.set(0,2,0);this.controls.update();}
  resize(){
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));
    this.renderer.setSize(innerWidth,innerHeight);this.camera.aspect=innerWidth/innerHeight;this.camera.updateProjectionMatrix();
    const v=new THREE.Vector2();this.renderer.getDrawingBufferSize(v);this.target.setSize(v.x,v.y);this.waterUniforms.resolution.value.copy(v);
  }
  render(time){
    const started=performance.now(),gl=this.renderer.getContext(),ext=this.timerExtension;
    if(this.gpuQuery && gl.getQueryParameter(this.gpuQuery,gl.QUERY_RESULT_AVAILABLE)){
      if(!gl.getParameter(ext.GPU_DISJOINT_EXT))this.renderGpuMs=gl.getQueryParameter(this.gpuQuery,gl.QUERY_RESULT)/1e6;
      gl.deleteQuery(this.gpuQuery);this.gpuQuery=null;
    }
    let query=null;if(ext && !this.gpuQuery){query=gl.createQuery();gl.beginQuery(ext.TIME_ELAPSED_EXT,query);}
    this.uniforms.time.value=time;this.controls.update();
    // Clamp panning to the field, keeping navigation recoverable with F.
    this.controls.target.x=THREE.MathUtils.clamp(this.controls.target.x,-38,38);this.controls.target.z=THREE.MathUtils.clamp(this.controls.target.z,-38,38);
    const waterVisible=this.uniforms.viewMode.value===0||this.uniforms.viewMode.value===3;
    if(this.lightDirty){this.renderer.setRenderTarget(this.lightTarget);this.renderer.render(this.lightScene,this.lightCamera);this.lightDirty=false;}
    this.renderer.setRenderTarget(this.target);this.renderer.render(this.scene,this.camera);
    this.renderer.setRenderTarget(null);this.renderer.render(this.copyScene,this.copyCamera);
    if(waterVisible){this.renderer.autoClear=false;this.renderer.render(this.waterScene,this.camera);this.renderer.autoClear=true;}
    if(query){gl.endQuery(ext.TIME_ELAPSED_EXT);this.gpuQuery=query;}
    this.renderMs=performance.now()-started;
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
