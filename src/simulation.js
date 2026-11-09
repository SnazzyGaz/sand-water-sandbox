// Original height-field solver. See README for equations, units and intentional
// departures from Su et al. This module has no browser or rendering dependencies.
export const G = 9.81;
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const rho = 1.65; // bulk sand / water density
export function cohesion(phi) {
  if (phi < 0.2) return 4.5 * Math.max(0, phi) / 0.2;
  if (phi < 0.25) return 4.5 + (phi - 0.2) * 10;
  return phi < 0.33 ? 5.0 * (0.33 - phi) / 0.08 : 0;
}
export class Simulation {
  constructor(n = 192, size = 60, initialize = true) {
    this.n = n; this.count = n * n; this.size = size; this.dx = size / (n - 1);
    const array = () => new Float32Array(this.count);
    for (const key of ['H','sand','water','pore','sediment','u','v','pu','pv','su','sv',
      'theta','P00','P01','P11','stress00','stress01','stress11','initial','wet',
      'tmpU','tmpV','nextSand','nextPore','nextTheta','nextP00','nextP01','nextP11','nextWater','nextSediment']) this[key] = array();
    this.flux = new Float32Array(this.count * 4);
    this.poreFlux = new Float32Array(this.count * 4);
    this.sandFlux = new Float32Array(this.count * 4);
    this.neighbors = new Int32Array(this.count * 4);
    for (let y = 0; y < n; y++) for (let x = 0; x < n; x++) {
      const i = y*n+x, k = i*4;
      this.neighbors[k] = x ? i-1 : -1; this.neighbors[k+1] = x<n-1 ? i+1 : -1;
      this.neighbors[k+2] = y ? i-n : -1; this.neighbors[k+3] = y<n-1 ? i+n : -1;
    }
    this.options = { spring: true, underdrain: true, erosion: 1 };
    this.brush = null; this.time = 0; this.drained = 0; this.eroded = 0; this.deposited = 0; this.added = 0;
    this.sedimentOut = 0; this.lastDt = 0; this.maxSpeed = 0; this.maxDepth = 0;
    if (initialize) this.reset(); else { this.P00.fill(1); this.P11.fill(1); }
  }
  reset() {
    for (const key of ['sand','water','pore','sediment','u','v','pu','pv','su','sv','theta','P01','stress00','stress01','stress11','wet']) this[key].fill(0);
    this.flux.fill(0); this.poreFlux.fill(0); this.sandFlux.fill(0); this.P00.fill(1); this.P11.fill(1);
    this.time = this.drained = this.eroded = this.deposited = this.added = this.sedimentOut = 0;
    this.maxSpeed=0;this.maxDepth=0;
    const n=this.n, gauss=(x,z,cx,cz,rx,rz)=>Math.exp(-(((x-cx)/rx)**2+((z-cz)/rz)**2));
    for(let y=0;y<n;y++) for(let x=0;x<n;x++){
      const i=y*n+x, X=x*this.dx-this.size/2, Z=y*this.dx-this.size/2;
      // A perched inland catchment at the back, a sandy lip, and a lower quarry bowl.
      this.H[i]=0.18+0.008*(30-Z)+0.10*Math.sin(X*.13)*Math.sin(Z*.12);
      let h=1.35+0.028*(30-Z);
      h+=3.9*gauss(X,Z,-17,-12,11,12)+3.2*gauss(X,Z,19,-10,10,14);
      h+=2.8*gauss(X,Z,-15,17,12,9)+2.5*gauss(X,Z,19,18,11,12);
      h+=0.38*Math.sin(X*.38+Z*.17)*gauss(X,Z,-12,-3,23,22);
      h-=1.25*gauss(X,Z,0,11,10,13);
      h+=1.15*gauss(X,Z,0,-15,13,10);
      h-=0.9*gauss(X,Z,0,-19,5,4.6);
      // A narrow, initially shallow outlet guides the first flow, not a baked channel animation.
      h-=.42*gauss(X,Z,1,-9,1.7,7);
      this.sand[i]=Math.max(.22,h);
      const b=this.H[i]+this.sand[i];
      if (Math.abs(X)<7 && Z<-11 && Z>-25) {
        const w=Math.max(0,4.15-b); this.water[i]=w;
        this.pore[i]=.5*this.sand[i]*clamp(w*3,0,1);
        this.wet[i]=clamp(w*4,0,1);
      }
      if (gauss(X,Z,0,11,8,9)>.08) {
        const w=Math.max(0,1.9-b); this.water[i]=w;
        this.pore[i]=.5*this.sand[i]*clamp(w*5,0,1); this.wet[i]=clamp(w*5,0,1);
      }
      this.initial[i]=b;this.maxDepth=Math.max(this.maxDepth,this.water[i]);
    }
  }
  sample(a, x, z) {
    x=clamp(x,0,this.n-1.001); z=clamp(z,0,this.n-1.001);
    const ix=x|0, iz=z|0, fx=x-ix, fz=z-iz, i=iz*this.n+ix;
    return (a[i]*(1-fx)+a[i+1]*fx)*(1-fz)+(a[i+this.n]*(1-fx)+a[i+this.n+1]*fx)*fz;
  }
  applyBrush(x,z,radius,amount,mode) {
    const n=this.n, cx=(x+this.size/2)/this.dx, cy=(z+this.size/2)/this.dx, r=radius/this.dx;
    const x0=Math.max(0,Math.floor(cx-r)), x1=Math.min(n-1,Math.ceil(cx+r));
    const y0=Math.max(0,Math.floor(cy-r)), y1=Math.min(n-1,Math.ceil(cy+r));
    for(let y=y0;y<=y1;y++) for(let x=x0;x<=x1;x++){
      const d=((x-cx)**2+(y-cy)**2)/(r*r); if(d>1)continue;
      const i=y*n+x, a=amount*(1-d)**2;
      if(mode==='raise') this.sand[i]+=Math.min(a,Math.max(0,16-this.H[i]-this.sand[i]));
      if(mode==='lower') this.sand[i]=Math.max(.025,this.sand[i]-a);
      if(mode==='water'){ const add=Math.min(a,Math.max(0,8-this.water[i]));this.water[i]+=add;this.added+=add*this.dx*this.dx; }
      if(mode==='drain'){const d=Math.min(this.water[i],a);this.water[i]-=d;this.drained+=d*this.dx*this.dx;}
      const excess=Math.max(0,this.pore[i]-.5*this.sand[i]); this.pore[i]-=excess;this.water[i]+=excess;this.maxDepth=Math.max(this.maxDepth,this.water[i]);
    }
  }
  largePour(x=0,z=-18) {
    // Normalize the compact kernel so the button adds exactly 45 cubic metres.
    let sum=0, r=4.2;
    for(let y=0;y<this.n;y++)for(let xx=0;xx<this.n;xx++){
      const d=((xx*this.dx-this.size/2-x)**2+(y*this.dx-this.size/2-z)**2)/(r*r);
      if(d<1)sum+=(1-d)**2;
    }
    if(sum>0)this.applyBrush(x,z,r,45/(sum*this.dx*this.dx),'water');
  }
  timestep() {
    // Wave + transport CFL, with the elastic sand-wave bound included separately.
    return Math.min(1/45, .36*this.dx/(this.maxSpeed+Math.sqrt(G*this.maxDepth)+.1), .36*this.dx/Math.sqrt(12));
  }
  step(dt=this.timestep()) {
    dt=Math.min(dt,this.timestep()); this.lastDt=dt;
    if(this.options.spring) this.applyBrush(-.8,-19.5,1.65,dt*1.65,'water');
    if(this.brush) {
      const b=this.brush;this.applyBrush(b.x,b.z,b.radius,dt*b.strength*(b.mode==='water'?2.4:1.4),b.mode);
    }
    this.infiltrate(dt);
    this.surfaceFlow(dt);
    this.seep(dt);
    for(let s=0;s<3;s++)this.sandStep(dt/3);
    this.erode(dt);
    this.time+=dt;
    let maxV=0,maxH=0;
    for(let i=0;i<this.count;i++){
      const h=this.sand[i], excess=Math.max(0,this.pore[i]-.5*h);
      this.pore[i]-=excess;this.water[i]+=excess;
      const sat=this.pore[i]/(.5*h+.0001);
      this.wet[i]=Math.max(this.wet[i]*Math.exp(-dt*.016),Math.min(1,sat*1.8),Math.min(1,this.water[i]*25));
      maxV=Math.max(maxV,Math.abs(this.u[i]),Math.abs(this.v[i]),Math.abs(this.su[i]),Math.abs(this.sv[i]));
      maxH=Math.max(maxH,this.water[i]);
    }
    this.maxSpeed=maxV;this.maxDepth=maxH;
  }
  infiltrate(dt){
    const area=this.dx*this.dx;
    for(let i=0;i<this.count;i++){
      const cap=.5*this.sand[i], free=Math.max(0,cap-this.pore[i]);
      const amount=Math.min(this.water[i],free,dt*.095*(.25+free/(cap+.001))*(1+this.water[i]));
      // Momentum follows water as it switches layers.
      if(amount>0){ const p=this.pore[i];this.pu[i]=(this.pu[i]*p+this.u[i]*amount)/(p+amount);this.pv[i]=(this.pv[i]*p+this.v[i]*amount)/(p+amount); }
      this.water[i]-=amount;this.pore[i]+=amount;
      if(this.options.underdrain){const d=this.pore[i]*(1-Math.exp(-dt*.009));this.pore[i]-=d;this.drained+=d*area;}
    }
  }
  surfaceFlow(dt){
    const {count:N,neighbors:nb,flux:f,water:w,H,sand:h,dx,sediment:sed}=this;
    const c=dt/dx, damp=Math.exp(-dt*.55);
    for(let i=0;i<N;i++){
      if(w[i]<.00001){this.tmpU[i]=0;this.tmpV[i]=0;continue;}
      const x=i%this.n,z=(i/this.n)|0,bx=x-c*this.u[i],bz=z-c*this.v[i];
      this.tmpU[i]=this.sample(this.u,bx,bz)-this.u[i];this.tmpV[i]=this.sample(this.v,bx,bz)-this.v[i];
    }
    for(let i=0;i<N;i++){
      const b=H[i]+h[i], eta=b+w[i], k=i*4;let sum=0;
      for(let d=0;d<4;d++){
        const j=nb[k+d];let q=0;
        if(j<0)q=w[i]*Math.sqrt(G*w[i])*.75;
        else {
          const bj=H[j]+h[j], ej=bj+w[j];
          const face=Math.max(0,Math.max(eta,ej)-Math.max(b,bj));
          const advected=f[k+d]+Math.min(face,w[i])*(d<2?this.tmpU[i]:this.tmpV[i])*(d%2?1:-1);
          q=Math.max(0,damp*advected+dt*G*Math.min(face,Math.max(w[i],w[j]))*(eta-ej)/dx);
          // No flow can tunnel through a dry, higher bed.
          if(eta<=bj && w[j]<.00001)q=0;
        }
        q=Math.min(q,4*w[i]);f[k+d]=q;sum+=q;
      }
      const scale=Math.min(1,w[i]/(c*sum+1e-20));
      for(let d=0;d<4;d++)f[k+d]*=scale;
    }
    for(let i=0;i<N;i++){
      const k=i*4, conc=sed[i]/Math.max(w[i],1e-12);let wi=w[i],si=sed[i];
      let inL=0,inR=0,inT=0,inB=0;
      for(let d=0;d<4;d++){
        const j=nb[k+d],out=c*f[k+d];wi-=out;si-=out*conc;
        if(j>=0){const q=f[j*4+(d^1)];wi+=c*q;si+=c*q*sed[j]/Math.max(w[j],1e-12);if(d===0)inL=q;if(d===1)inR=q;if(d===2)inT=q;if(d===3)inB=q;}
        else {this.drained+=out*dx*dx;this.sedimentOut=(this.sedimentOut||0)+out*conc*dx*dx;}
      }
      this.nextWater[i]=Math.max(0,wi);this.nextSediment[i]=Math.max(0,si);
      const depth=Math.max(.008,.5*(w[i]+wi));
      this.u[i]=clamp((f[k+1]-f[k]+inL-inR)/(2*depth),-4,4);
      this.v[i]=clamp((f[k+3]-f[k+2]+inT-inB)/(2*depth),-4,4);
    }
    w.set(this.nextWater);sed.set(this.nextSediment);
  }
  seep(dt){
    const {count:N,neighbors:nb,pore:p,H,sand:h,poreFlux:f,dx}=this,c=dt/dx;
    for(let i=0;i<N;i++){
      const k=i*4, sat=p[i]/(.5*h[i]+.0001), head=H[i]+2*p[i]-.22*(1-sat);let sum=0;
      for(let d=0;d<4;d++){
        const j=nb[k+d];let q=0;
        if(j<0)q=.035*p[i];
        else {
          const sj=p[j]/(.5*h[j]+.0001), hj=H[j]+2*p[j]-.22*(1-sj);
          // Darcy hydraulic head plus a capillary diffusion contribution.
          q=Math.max(0,.15*Math.max(.008,Math.min(p[i],p[j]))*(head-hj)/dx + .015*(p[i]-p[j])/dx);
        }
        f[k+d]=q;sum+=q;
      }
      const scale=Math.min(1,p[i]/(c*sum+1e-20));for(let d=0;d<4;d++)f[k+d]*=scale;
    }
    for(let i=0;i<N;i++){
      const k=i*4;let value=p[i],px=0,pz=0;
      for(let d=0;d<4;d++){
        const j=nb[k+d],out=c*f[k+d];value-=out;
        const inc=j<0?0:f[j*4+(d^1)];value+=c*inc;
        if(j<0)this.drained+=out*dx*dx;
        const signed=f[k+d]-inc;if(d===0)px-=signed;if(d===1)px+=signed;if(d===2)pz-=signed;if(d===3)pz+=signed;
      }
      this.nextPore[i]=Math.max(0,value);
      this.pu[i]=px/(2*Math.max(.008,p[i]));this.pv[i]=pz/(2*Math.max(.008,p[i]));
    }
    p.set(this.nextPore);
  }
  sandStep(dt){
    const {n,count:N,dx,H,sand:h,water:w,pore:p,su,sv,neighbors:nb,sandFlux:f}=this;
    const c=dt/dx;
    // Semi-Lagrangian momentum predictor. The mass update below remains conservative.
    for(let y=0;y<n;y++)for(let x=0;x<n;x++){
      const i=y*n+x, bx=x-c*su[i], bz=y-c*sv[i];
      if(su[i]===0 && sv[i]===0){this.tmpU[i]=0;this.tmpV[i]=0;}else{this.tmpU[i]=this.sample(su,bx,bz);this.tmpV[i]=this.sample(sv,bx,bz);}
    }
    for(let i=0;i<N;i++){
      const k=i*4,L=nb[k]<0?i:nb[k],R=nb[k+1]<0?i:nb[k+1],T=nb[k+2]<0?i:nb[k+2],B=nb[k+3]<0?i:nb[k+3];
      const gx=((H[R]+h[R]+w[R]/rho)-(H[L]+h[L]+w[L]/rho))/(2*dx);
      const gz=((H[B]+h[B]+w[B]/rho)-(H[T]+h[T]+w[T]/rho))/(2*dx);
      const inv=1/(Math.max(.05,h[i])*2*dx);
      let ux=this.tmpU[i]+dt*(-G*gx+((h[R]*this.stress00[R]-h[L]*this.stress00[L])+(h[B]*this.stress01[B]-h[T]*this.stress01[T]))*inv);
      let uz=this.tmpV[i]+dt*(-G*gz+((h[R]*this.stress01[R]-h[L]*this.stress01[L])+(h[B]*this.stress11[B]-h[T]*this.stress11[T]))*inv);
      const ms=rho*Math.max(.025,h[i]);
      // Analytic pairwise drag: equal and opposite impulse, stable even for stiff drag.
      if(p[i]>.000001){
        const mw=p[i],reduced=ms*mw/(ms+mw),a=1-Math.exp(-18*mw*dt*(1/ms+1/mw));
        const jx=reduced*a*(this.pu[i]-ux),jz=reduced*a*(this.pv[i]-uz);
        ux+=jx/ms;uz+=jz/ms;this.pu[i]-=jx/mw;this.pv[i]-=jz/mw;
      }
      if(w[i]>.000001){
        const mw=w[i],reduced=ms*mw/(ms+mw),a=1-Math.exp(-1.8*Math.min(mw,.12)*dt*(1/ms+1/mw));
        const jx=reduced*a*(this.u[i]-ux),jz=reduced*a*(this.v[i]-uz);
        ux+=jx/ms;uz+=jz/ms;const du=-jx/mw,dv=-jz/mw;
        this.u[i]+=du;this.v[i]+=dv;
        // Feed the exchanged impulse back into the persistent face momenta.
        this.flux[k]=Math.max(0,this.flux[k]-du*mw*.5);this.flux[k+1]=Math.max(0,this.flux[k+1]+du*mw*.5);
        this.flux[k+2]=Math.max(0,this.flux[k+2]-dv*mw*.5);this.flux[k+3]=Math.max(0,this.flux[k+3]+dv*mw*.5);
      }
      const phi=(p[i]+w[i])/(h[i]+p[i]+w[i]+1e-8),coh=cohesion(phi);
      const saturation=clamp(2*p[i]/Math.max(.025,h[i]),0,1);
      const friction=.625*(1-.66*saturation);
      // A finite-depth cohesion yield augments the DP deviatoric internal stress.
      const resistance=G*friction+coh/Math.max(.35,Math.min(1.4,h[i]));
      const speed=Math.hypot(ux,uz),factor=Math.max(0,1-dt*resistance/(speed+1e-12))*Math.exp(-dt*.25);
      su[i]=clamp(ux*factor,-5,5);sv[i]=clamp(uz*factor,-5,5);
    }
    for(let i=0;i<N;i++){
      const k=i*4;let sum=0;
      for(let d=0;d<4;d++){
        const j=nb[k+d];let q=0;
        if(j>=0){const vel=d<2?.5*(su[i]+su[j]):.5*(sv[i]+sv[j]);q=Math.max(0,vel*(d%2?1:-1))*h[i];}
        f[k+d]=q;sum+=q;
      }
      const limit=Math.min(1,.35*h[i]/(c*sum+1e-20));for(let d=0;d<4;d++)f[k+d]*=limit;
    }
    // Conservative sand mass and mass-weighted polar attributes. Pore water is
    // entrained with the moving skeleton, in addition to its independent seepage.
    for(let i=0;i<N;i++){
      const k=i*4,hi=Math.max(h[i],1e-12);let mass=h[i],po=p[i],th=h[i]*this.theta[i],a=h[i]*this.P00[i],b=h[i]*this.P01[i],cc=h[i]*this.P11[i];
      for(let d=0;d<4;d++){
        const j=nb[k+d],out=c*f[k+d];mass-=out;po-=out*p[i]/hi;th-=out*this.theta[i];a-=out*this.P00[i];b-=out*this.P01[i];cc-=out*this.P11[i];
        if(j>=0){const inc=c*f[j*4+(d^1)];mass+=inc;po+=inc*p[j]/Math.max(h[j],1e-12);
          // Unwrap angles relative to this column before averaging.
          const angle=this.theta[i]+Math.atan2(Math.sin(this.theta[j]-this.theta[i]),Math.cos(this.theta[j]-this.theta[i]));
          th+=inc*angle;a+=inc*this.P00[j];b+=inc*this.P01[j];cc+=inc*this.P11[j];}
      }
      this.nextSand[i]=Math.max(0,mass);this.nextPore[i]=Math.max(0,po);
      const inv=1/Math.max(1e-12,mass);this.nextTheta[i]=th*inv;this.nextP00[i]=a*inv;this.nextP01[i]=b*inv;this.nextP11[i]=cc*inv;
    }
    h.set(this.nextSand);p.set(this.nextPore);this.theta.set(this.nextTheta);this.P00.set(this.nextP00);this.P01.set(this.nextP01);this.P11.set(this.nextP11);
    this.constitutive(dt);
  }
  constitutive(dt){
    const {count:N,neighbors:nb,dx,su,sv}=this;
    for(let i=0;i<N;i++){
      const k=i*4,L=nb[k]<0?i:nb[k],R=nb[k+1]<0?i:nb[k+1],T=nb[k+2]<0?i:nb[k+2],B=nb[k+3]<0?i:nb[k+3];
      const ux=dt*(su[R]-su[L])/(2*dx),uz=dt*(su[B]-su[T])/(2*dx),vx=dt*(sv[R]-sv[L])/(2*dx),vz=dt*(sv[B]-sv[T])/(2*dx);
      if(ux===0 && uz===0 && vx===0 && vz===0 && this.P00[i]===1 && this.P01[i]===0 && this.P11[i]===1)continue;
      const ct=Math.cos(this.theta[i]),st=Math.sin(this.theta[i]),p=this.P00[i],q=this.P01[i],r=this.P11[i];
      const A=ct*p-st*q,Bb=ct*q-st*r,C=st*p+ct*q,D=st*q+ct*r;
      const a=(1+ux)*A+uz*C,b=(1+ux)*Bb+uz*D,c=vx*A+(1+vz)*C,d=vx*Bb+(1+vz)*D;
      // Exact 2x2 right polar decomposition, F = R(theta) P. Positive P is
      // projected in principal logarithmic strain space (a DP-like yield cone).
      const angle=Math.atan2(c-b,a+d),co=Math.cos(angle),si=Math.sin(angle);
      const p0=co*a+si*c,p1=.5*(co*b+si*d-si*a+co*c),p2=-si*b+co*d;
      const mid=.5*(p0+p2),rad=Math.hypot(.5*(p0-p2),p1),eigAngle=.5*Math.atan2(2*p1,p0-p2);
      let e0=Math.log(clamp(mid+rad,.7,1.3)),e1=Math.log(clamp(mid-rad,.7,1.3));
      const phi=(this.pore[i]+this.water[i])/(this.sand[i]+this.pore[i]+this.water[i]+1e-9),cohes=cohesion(phi);
      // Normalized moduli (stress divided by bulk density), in m²/s².
      const K=5,mu=2.5;
      let trace=clamp(e0+e1,-.22,cohes/(K*3)),dev=.5*(e0-e1);
      const pressure=Math.max(0,-K*trace),yieldStress=.62*pressure+cohes;
      dev=Math.min(Math.abs(dev),yieldStress/(2*mu)+1e-12)*Math.sign(dev);
      e0=.5*trace+dev;e1=.5*trace-dev;
      const ec=Math.cos(eigAngle),es=Math.sin(eigAngle),l0=Math.exp(e0),l1=Math.exp(e1);
      this.theta[i]=angle;this.P00[i]=l0*ec*ec+l1*es*es;this.P01[i]=(l0-l1)*ec*es;this.P11[i]=l0*es*es+l1*ec*ec;
      const world=angle+eigAngle,cw=Math.cos(world),sw=Math.sin(world),s0=K*trace+2*mu*dev,s1=K*trace-2*mu*dev;
      this.stress00[i]=s0*cw*cw+s1*sw*sw;this.stress01[i]=(s0-s1)*cw*sw;this.stress11[i]=s0*sw*sw+s1*cw*cw;
    }
  }
  erode(dt){
    const {count:N,neighbors:nb,sand:h,water:w,sediment:s,H,dx}=this;
    const area=dx*dx;
    for(let i=0;i<N;i++){
      if(w[i]<.000001 && s[i]<.000001)continue;
      const k=i*4,L=nb[k]<0?i:nb[k],R=nb[k+1]<0?i:nb[k+1],T=nb[k+2]<0?i:nb[k+2],B=nb[k+3]<0?i:nb[k+3];
      const slope=Math.hypot(H[R]+h[R]-H[L]-h[L],H[B]+h[B]-H[T]-h[T])/(2*dx);
      const speed=Math.hypot(this.u[i],this.v[i]),phi=(this.pore[i]+w[i])/(h[i]+this.pore[i]+w[i]+1e-9);
      const shear=G*w[i]*Math.max(.015,slope)+.025*speed*speed;
      const threshold=.035+cohesion(phi)*.10;
      const capacity=Math.min(.28*w[i],.14*w[i]*speed*(.12+slope));
      if(w[i]>.001 && s[i]<capacity && shear>threshold){
        const amount=Math.min(Math.max(0,h[i]-.025),(capacity-s[i])*(1-Math.exp(-dt*2.8))*this.options.erosion,dt*.16*Math.max(0,shear-threshold));
        h[i]-=amount;s[i]+=amount;this.eroded+=amount*area;
      }else{
        const amount=w[i]<.001?s[i]:Math.max(0,s[i]-capacity)*(1-Math.exp(-dt*2.2));
        s[i]-=amount;h[i]+=amount;this.deposited+=amount*area;
      }
    }
  }
  stats(){
    let surface=0,pore=0,sand=0,sediment=0,maxChange=0;
    for(let i=0;i<this.count;i++){surface+=this.water[i];pore+=this.pore[i];sand+=this.sand[i];sediment+=this.sediment[i];maxChange=Math.max(maxChange,Math.abs(this.H[i]+this.sand[i]-this.initial[i]));}
    const a=this.dx*this.dx;
    return {time:this.time,surface:surface*a,pore:pore*a,sand:sand*a,sediment:sediment*a,sedimentOut:this.sedimentOut,drained:this.drained,eroded:this.eroded,deposited:this.deposited,added:this.added,maxChange,dt:this.lastDt,maxSpeed:this.maxSpeed};
  }
  pack(target=new Float32Array(this.count*8)){
    for(let i=0;i<this.count;i++){
      const k=i*8,h=this.sand[i],w=this.water[i];
      target[k]=this.H[i]+h;target[k+1]=w;target[k+2]=clamp(2*this.pore[i]/Math.max(h,.001),0,1);target[k+3]=this.wet[i];
      target[k+4]=this.u[i];target[k+5]=this.v[i];target[k+6]=this.sediment[i]/Math.max(.001,w);target[k+7]=this.H[i]+h-this.initial[i];
    }
    return target;
  }
}
