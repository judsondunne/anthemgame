import * as THREE from 'three';
// Atmospheric sky surface: multi-scale cloud density, directional self-shadow,
// silver linings, solar limb darkening, lunar relief and round distant stars.
export function createSkyMaterial(time){return new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:time,uHour:{value:12},uNight:{value:0},uSun:{value:new THREE.Vector3(-.4,.6,-.8)},uMoon:{value:new THREE.Vector3(-.5,.7,-.6)},uGold:{value:0},uDetail:{value:1}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`
 precision highp float;
 uniform float uTime,uHour,uNight,uGold,uDetail;uniform vec3 uSun,uMoon;varying vec3 vDir;
 float hash(vec3 p){p=fract(p*.3183099+.1);p*=17.;return fract(p.x*p.y*p.z*(p.x+p.y+p.z));}
 float noise(vec3 p){vec3 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(mix(hash(i),hash(i+vec3(1,0,0)),f.x),mix(hash(i+vec3(0,1,0)),hash(i+vec3(1,1,0)),f.x),f.y),mix(mix(hash(i+vec3(0,0,1)),hash(i+vec3(1,0,1)),f.x),mix(hash(i+vec3(0,1,1)),hash(i+vec3(1,1,1)),f.x),f.y),f.z);}
 float fbm(vec3 p){float v=0.,w=.5;for(int i=0;i<5;i++){v+=noise(p)*w;p=p*2.04+vec3(5.7,1.3,7.1);w*=.48;}return v;}
 float cloud(vec3 p){return smoothstep(.43,.62,fbm(p*3.7+vec3(fbm(p*1.1)*1.2,0.,0.)));}
 void main(){vec3 d=normalize(vDir),sun=normalize(uSun),moon=normalize(uMoon);float h=max(0.,d.y),gold=uGold,night=uNight;
  float optical=exp(-h*3.8);vec3 zenith=mix(vec3(.20,.46,.67),vec3(.30,.43,.60),gold*.4),horizon=mix(vec3(.75,.85,.86),vec3(1.,.70,.43),gold*.68);
  vec3 c=mix(zenith,horizon,optical*.82);float sd=max(0.,dot(d,sun));c+=vec3(1.,.72,.36)*pow(sd,12.)*.12*(1.-night);
  c=mix(c,mix(vec3(.012,.025,.060),vec3(.15,.22,.31),optical),night);
  float sunAngle=acos(clamp(dot(d,sun),-1.,1.)),sunRadius=.0074;float disk=1.-smoothstep(sunRadius*.95,sunRadius*1.025,sunAngle);float limb=sqrt(max(0.,1.-pow(sunAngle/sunRadius,2.)));c+=vec3(1.,.86,.61)*disk*(1.7+limb*.9)*(1.-night);c+=vec3(1.,.71,.36)*exp(-sunAngle*48.)*.19*(1.-night);
  vec3 mr=normalize(cross(moon,vec3(0.,1.,0.))),mu=cross(mr,moon);vec2 uv=vec2(dot(d,mr),dot(d,mu))/.009;float md=length(uv);float moonMask=1.-smoothstep(.985,1.015,md);
  if(md<1.015){float nz=sqrt(max(0.,1.-dot(uv,uv)));vec3 point=vec3(uv,nz);float mares=fbm(point*4.3+vec3(12.,3.,8.));float detail=fbm(point*27.);float craters=0.;vec2 grid=uv*9.;vec2 cell=floor(grid),local=fract(grid)-.5;float radius=.14+hash(vec3(cell,6.))*.23;float r=length(local);craters=(smoothstep(radius-.08,radius,r)-smoothstep(radius,radius+.10,r))*.15;float shade=.35+.65*max(0.,dot(point,normalize(vec3(-.35,.35,1.))));vec3 lunar=vec3(.81,.85,.87)*(.67+mares*.4+detail*.12+craters)*shade;c=mix(c,lunar*1.5,moonMask*night);}
  c+=vec3(.51,.65,.89)*exp(-md*1.4)*.045*night;
  vec2 starUv=vec2(atan(d.z,d.x)/6.283185+.5,asin(d.y)/3.14159+.5)*vec2(430.,215.);float seed=hash(vec3(floor(starUv),6.));float star=step(.986,seed)*(1.-smoothstep(.012,.17,length(fract(starUv)-.5)))*(.8+.2*sin(uTime*.5+seed*52.));c+=star*vec3(.84,.9,1.)*night*smoothstep(.0,.3,h)*.8;
  if(d.y>-.03){vec2 plane=d.xz/max(.10,d.y+.07);vec3 p=vec3(plane.x*.42+uTime*.0035,.13,plane.y*.42+uTime*.001);float density=cloud(p);float upper=cloud(p+vec3(.035,.14,.025));float selfShadow=cloud(p+vec3(sun.x*.18,.08,sun.z*.18));float illumination=clamp(1.-selfShadow*.66, .22,1.);float silver=pow(sd,28.)*(1.-density)*2.;vec3 cloudDay=mix(vec3(.47,.59,.68),vec3(1.24,1.19,1.10),illumination+silver+.17);cloudDay=mix(cloudDay,vec3(.96,.77,.56),gold*.30);vec3 cloudNight=mix(vec3(.025,.046,.082),vec3(.18,.23,.30),illumination*.6+pow(max(0.,dot(d,moon)),14.)*.7);vec3 clouds=mix(cloudDay,cloudNight,night);float opacity=(density*.76+upper*.18)*smoothstep(-.03,.17,d.y)*(1.-smoothstep(2.,5.,length(plane))*.45);c=mix(c,clouds,clamp(opacity,0.,.94));}
  gl_FragColor=vec4(c,1.);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
 }`});}
