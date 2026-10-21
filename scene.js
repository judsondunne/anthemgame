import * as THREE from 'three';
import {EffectComposer} from 'three/addons/postprocessing/EffectComposer.js';
import {RenderPass} from 'three/addons/postprocessing/RenderPass.js';
import {UnrealBloomPass} from 'three/addons/postprocessing/UnrealBloomPass.js';
import {ShaderPass} from 'three/addons/postprocessing/ShaderPass.js';
import {OutputPass} from 'three/addons/postprocessing/OutputPass.js';
import {loadAssets,model,play,palette,windTime,duskUniform,assetInfo} from './assets.js';
const G=window.GameState,{world,Farm,view,params}=G;
const canvas=document.querySelector('canvas');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setSize(innerWidth,innerHeight);renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;
const scene=new THREE.Scene();scene.fog=new THREE.FogExp2('#b6c9b0',.012);
const camera=new THREE.OrthographicCamera(-18,18,12,-12,.1,240);
const root=new THREE.Group();scene.add(root);
const hemi=new THREE.HemisphereLight('#fff4d7','#687b55',2);scene.add(hemi);
const sun=new THREE.DirectionalLight('#fff1d1',3.2);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-24,right:24,top:24,bottom:-24,near:1,far:90});sun.shadow.bias=-.00025;sun.shadow.normalBias=.03;sun.shadow.radius=3;scene.add(sun,sun.target);
const moon=new THREE.DirectionalLight('#a8c7ed',.4);moon.position.set(-10,25,15);scene.add(moon);
const lantern=new THREE.PointLight('#ffc777',0,9,1.7);scene.add(lantern);
const windows=[];const windowLights=[];for(const [x,y]of [[630,463],[320,820],[-190,548],[1590,548]]){const l=new THREE.PointLight('#ffd393',0,4,2);l.position.set((x-700)/50,1.15,(y-650)*1.65/50);scene.add(l);windowLights.push(l);}
const composer=new EffectComposer(renderer);composer.addPass(new RenderPass(scene,camera));const bloom=new UnrealBloomPass(new THREE.Vector2(innerWidth,innerHeight),.15,.65,.86);composer.addPass(bloom);
const grade=new ShaderPass({uniforms:{tDiffuse:{value:null},warm:{value:0}},vertexShader:'varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:'uniform sampler2D tDiffuse;uniform float warm;varying vec2 vUv;void main(){vec3 c=texture2D(tDiffuse,vUv).rgb;float v=smoothstep(.8,.22,distance(vUv,vec2(.5)));c*=mix(.90,1.,v);c*=vec3(1.+warm*.055,1.,1.-warm*.06);gl_FragColor=vec4(c,1.);}'});composer.addPass(grade);composer.addPass(new OutputPass());
let quality=params.get('quality')==='low'?'low':'high',fallback=false;
function qualitySet(q,automatic=false){quality=q;fallback=automatic;const low=q==='low';renderer.setPixelRatio(Math.min(devicePixelRatio,low?1:2));sun.shadow.mapSize.set(low?1024:2048,low?1024:2048);sun.shadow.map?.dispose();sun.shadow.map=null;bloom.enabled=!low;grass&&(grass.count=low?8500:28000);resize();}
const logicalVector=new THREE.Vector3();
const logical=(x,y,h=0)=>logicalVector.set((x-700)/50,h,(y-650)*1.65/50);
function place(o,x,y,h=0){o.position.copy(logical(x,y,h));root.add(o);return o;}
function piece(name,parent,x,y,z,sx=1,sy=sx,sz=sx,rot=0){const o=model(name,{raw:true});o.position.set(x,y,z);o.scale.set(sx,sy,sz);o.rotation.y=rot;parent.add(o);return o;}
await loadAssets();
// Every architectural component below is a downloaded GLB module. No generated building meshes.
function building(x,y,{scale=1,coop=false,barn=false}={}){
 const b=new THREE.Group();place(b,x,y);b.scale.setScalar(scale);
 const unit=1.7,cols=3,front=0,back=-3.4;
 for(let i=0;i<cols;i++){
  const px=(i-1)*unit;
  piece(i===1?'wall-door':'wall-window-shutters',b,px,0,-.85,unit,2.35,unit,-Math.PI/2);
  piece('wall',b,px,0,back+.85,unit,2.35,unit,Math.PI/2);

 }
 piece('roof-gable-detail',b,0,2.35,back/2,3.4,2.5,5.1,Math.PI/2);
 for(let j=0;j<2;j++)for(const side of [-1,1])piece(j===0?'wall-window-glass':'wall',b,side*1.7,0,-.85-j*1.7,unit,2.35,unit,side===1?0:Math.PI);
 // Porch decking, posts and pitched canopy, all from the same pack.
 if(!barn){
  for(let i=-1;i<=1;i++)piece('planks',b,i*1.7,.02,.65,1.7,.9,1.4);
  for(const px of [-2.25,2.25])piece('pillar-wood',b,px,.04,1.18,1.1,1.5,1.1);
  piece('roof-gable',b,0,1.50,.85,.82,.5,5.1,Math.PI/2);
  piece('stairs-wood',b,0,-.02,1.6,.55,.2,1.3,Math.PI/2);
  for(const px of [-1.75,1.75])piece('balcony-wall-fence',b,px,.05,1.13,1,.65,1.1,-Math.PI/2);
 }
 piece('chimney',b,1.15,2.6,-2.2,1.2,1.45,1.2);
 if(!coop&&!barn){
  // Bay and ornamental gable crosswork reuse authentic downloaded wall modules.
  piece('wall-window-glass',b,-1.65,.7,.05,.7,1.25,.8,-Math.PI/2);
  piece('wall-window-glass',b,-2.05,.7,-.1,.65,1.25,.55,-Math.PI*.75);
  piece('wall-window-glass',b,-1.25,.7,-.1,.65,1.25,.55,-Math.PI*.25);
  piece('roof-gable-detail',b,-1.65,1.95,.15,.9,.55,1.35,Math.PI/2);
  for(const px of [-1.25,1.25])piece('wall-detail-cross',b,px,2.36,-.84,.5,.4,.65,-Math.PI/2);
  piece('wall-window-round',b,0,1.55,-.8,1.2,1.1,1.2,-Math.PI/2);}
 const l=piece('lantern',b,1.75,.45,.5,.7,.8,.7);windows.push(l);
 return b;
}
const house=building(630,460,{scale:1.03}),coop=building(320,818,{scale:.65,coop:true});
for(const p of Farm.pastures)building(p.barn,545,{scale:1.1,barn:true});
lantern.position.copy(logical(715,476,1.8));
// Local clock is expressed in hours at the interface; existing simulation retains its normalized cycle.
function hourToTime(h){return h<6?h/6*.075:h<=20?.075+(h-6)/14*.615:.69+(h-20)/4*.31;}
function clockHour(){const t=world.time;return t<.075?t/.075*6:t<=.69?6+(t-.075)/.615*14:20+(t-.69)/.31*4;}
function setHour(h){world.forcedTime=hourToTime(h);world.time=world.forcedTime;world.timeTween=null;}
if(params.has('time'))setHour(Number(params.get('time')));
// Continuous ground and painted path/pond floor are allowed ground shader geometry.
const groundMat=new THREE.MeshStandardMaterial({color:palette.grass,roughness:1});
groundMat.onBeforeCompile=s=>{s.uniforms.uTime=windTime;s.vertexShader='varying vec3 vGround;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <worldpos_vertex>','#include <worldpos_vertex>\n vGround=(modelMatrix*vec4(transformed,1.)).xyz;');s.fragmentShader='uniform float uTime;varying vec3 vGround;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 p=vGround.xz;float z=p.y;float pathX=-1.2+sin(z*.29)*.55;float pathMask=(1.-smoothstep(.57,.92,abs(p.x-pathX)))*smoothstep(-7.,-5.3,z);
 float n=sin(p.x*3.8+sin(z*2.4))*sin(z*4.1)*.025;
 diffuseColor.rgb*=1.+n;diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.65,.54,.36),pathMask*.65);
 vec2 pond=(p-vec2(5.98,-.792))/vec2(3.02,2.376);float d=length(pond);if(d<.98)discard;float shore=1.-smoothstep(.97,1.08,d);diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.18,.36,.32),shore);
 float caustic=pow(max(0.,sin(p.x*8.+uTime)*sin(p.y*7.-uTime*.7)),12.);diffuseColor.rgb+=caustic*shore*.13;
 float cloud=sin(p.x*.2+uTime*.035+sin(p.y*.25))*sin(p.y*.19+uTime*.02);diffuseColor.rgb*=1.-smoothstep(.35,.85,cloud)*.07;`);};
const ground=new THREE.Mesh(new THREE.PlaneGeometry(230,200),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
// Tree/bush anchors exactly match the logical scenery. Flowers and crops retain growth references.
for(const s of world.scenery){if(s.type==='tree')place(model('tree_oak',{height:4.3*s.scale,sway:true}),s.x,s.y);if(s.type==='bush')place(model('plant_bushLarge',{width:1.35*s.scale,sway:true}),s.x,s.y);if(s.type==='flowers')place(model(['flower_purpleA','flower_redA','flower_yellowA'][Math.floor(s.x)%3],{height:.5*s.scale,sway:true}),s.x,s.y);if(s.type==='fence')for(let j=-1;j<=1;j++)place(model('fence_simple',{width:1.5}),s.x+j*72,s.y);}
for(const cx of [355,710]){
 const bed=place(model('crops_dirtDoubleRow',{width:3.8}),cx,660,.01);bed.scale.z*=1.1;
 for(let j=0;j<3;j++)place(model('log',{width:.25}),cx-100+j*100,691,.06).rotation.y=Math.PI/2;
}
const plants=world.plants.map(p=>{const o=place(model(['flower_purpleA','flower_redA','flower_yellowA','flower_purpleB'][p.kind],{height:.65,sway:true}),p.x,p.y,.08);o.userData.target=p;return o;});
for(let i=0;i<8;i++){place(model(i%2?'crops_leafsStageB':'crops_wheatStageB',{height:.55,sway:true}),i<4?300+i*28:650+(i-4)*28,685,.06);}
for(let i=0;i<25;i++){const y=505+i*16,x=620+Math.sin(i*.35)*23;const stone=place(model(i%2?'stone_smallFlatA':'stone_smallFlatB',{width:.5+G.rand()*.25}),x,y,.015);stone.rotation.y=G.rand()*6.28;}
for(let i=0;i<38;i++){const a=i/38*Math.PI*2,r=1+.035*Math.sin(a*5);const stone=place(model(i%3?'stone_largeA':'stone_largeB',{width:.47+G.rand()*.3}),999+Math.cos(a)*151*r,626+Math.sin(a)*72*r,-.03);stone.rotation.y=G.rand()*6.28;stone.scale.y*=.65;}
for(const [x,y,big] of [[910,617,0],[1066,656,1],[1043,581,0],[928,655,1]])place(model(big?'lily_large':'lily_small',{width:.65}),x,y,.105);
for(const p of Farm.pastures){for(let i=-7;i<=7;i++)place(model('fence_simple',{width:1.4}),p.x+i*72,550);for(const [dx,y]of[[-450,510],[450,515],[p.kind==='cow'?-480:480,840]])place(model('tree_detailed',{height:3.7,sway:true}),p.x+dx,y);for(let i=-1;i<=1;i++)place(model('bowl-cereal',{width:1.1}),p.gate+(p.kind==='cow'?-65:65)+i*54,795);}
for(const [x,y]of [[475,480],[805,470],[215,790],[400,815]]){place(model('pot_small',{height:.4}),x,y);place(model('flower_redA',{height:.6,sway:true}),x,y,.3);}
// Layered borders reuse the same downloaded botanical family.
for(let i=0;i<75;i++){const side=i%2?-1:1,x=700+side*(570+G.rand()*80),y=440+G.rand()*470;if(G.inPond(x,y,15))continue;place(model(i%4?'plant_bush':'flower_purpleB',{height:i%4?.3+G.rand()*.35:.4,sway:true}),x,y);}
for(let i=0;i<95;i++){const x=200+G.rand()*1000,y=875+G.rand()*42;if(Math.abs(x-650)<65)continue;place(model(['flower_purpleA','flower_yellowA','flower_redA'][i%3],{height:.25+G.rand()*.23,sway:true}),x,y);}
// Distant downloaded rock silhouettes and forest create the backdrop without handmade objects.
for(let i=0;i<35;i++){const x=-60+i*4;const o=model(i%3?'tree_oak':'tree_detailed',{height:4+G.rand()*4,sway:true});o.position.set(x,0,-15-G.rand()*12);root.add(o);}
for(let i=0;i<12;i++){const o=model('stone_largeB',{width:8+G.rand()*5});o.position.set(-60+i*11,-1,-48-G.rand()*12);o.scale.y*=1.6;root.add(o);}
// Allowed pond surface shader: shore gradient, moving ripples, reflections and event rings.
const waterUniforms={uTime:windTime,uNight:{value:0},uSun:{value:new THREE.Vector3()},uRipples:{value:Array.from({length:8},()=>new THREE.Vector4(0,0,-100,0))}};
const waterMat=new THREE.ShaderMaterial({transparent:true,depthWrite:false,uniforms:waterUniforms,vertexShader:'varying vec2 vUv;varying vec3 vPos;void main(){vUv=uv;vPos=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vPos,1.);}',fragmentShader:`uniform float uTime;uniform float uNight;uniform vec3 uSun;uniform vec4 uRipples[8];varying vec2 vUv;varying vec3 vPos;
void main(){vec2 p=(vUv-.5)*2.;float a=atan(p.y,p.x);float edge=1.+.035*sin(a*5.)+.025*cos(a*3.);float d=length(p)/edge;if(d>1.)discard;
float rip=sin(vPos.x*6.+uTime*.8+sin(vPos.z*4.+uTime*.5))*.5+.5;float lines=pow(rip,18.);
for(int i=0;i<8;i++){float age=uTime-uRipples[i].z;float rr=length(vPos.xz-uRipples[i].xy);if(age>0.&&age<3.)lines+=exp(-pow((rr-age*.7)*18.,2.))*(1.-age/3.)*.8;}
vec3 c=mix(vec3(.43,.67,.59),vec3(.12,.36,.37),smoothstep(.0,1.,1.-d));c+=lines*.065;
float shine=pow(max(0.,sin(vPos.x*2.8+vPos.z*3.1+uTime*.7)),35.);c+=shine*vec3(.26,.24,.13);c=mix(c,c*vec3(.45,.66,.88),uNight*.88);float shore=smoothstep(1.,.82,d);gl_FragColor=vec4(c,.28+shore*.24);}`});
const floor=new THREE.Mesh(new THREE.PlaneGeometry(6.1,4.8),new THREE.MeshStandardMaterial({color:'#548c80',roughness:1}));floor.material.onBeforeCompile=s=>{s.uniforms.uTime=windTime;s.vertexShader='varying vec2 vFloor;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vFloor=position.xy;');s.fragmentShader='uniform float uTime;varying vec2 vFloor;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb+=pow(max(0.,sin(vFloor.x*9.+uTime)*sin(vFloor.y*11.-uTime*.7)),14.)*.19;');};floor.rotation.x=-Math.PI/2;floor.position.copy(logical(999,626,-.57));root.add(floor);
const water=new THREE.Mesh(new THREE.PlaneGeometry(6.24,4.92),waterMat);water.rotation.x=-Math.PI/2;water.position.copy(logical(999,626,.12));root.add(water);
// Only grass blades use generated mesh geometry; the instanced meadow bends around hens.
let grass;const henUniform={value:Array.from({length:7},()=>new THREE.Vector3(999,0,999))};
const grassMat=new THREE.MeshStandardMaterial({color:'#91ab70',side:THREE.DoubleSide,roughness:1});grassMat.onBeforeCompile=s=>{s.uniforms.uTime=windTime;s.uniforms.uHens=henUniform;s.vertexShader='uniform float uTime;uniform vec3 uHens[7];varying float vTip;\n'+s.vertexShader;s.vertexShader=s.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
 vTip=uv.y;vec3 anchor=(instanceMatrix*vec4(0.,0.,0.,1.)).xyz;float gust=sin(anchor.x*.7+anchor.z*.42+uTime*1.3)+.35*sin(anchor.x*1.9-uTime*2.2);transformed.x+=gust*uv.y*uv.y*.10;
 for(int i=0;i<7;i++){vec2 delta=anchor.xz-uHens[i].xz;float d=length(delta);if(d<.7&&d>.001)transformed.xz+=delta/d*(.7-d)*uv.y*.65;}`);s.fragmentShader='varying float vTip;\n'+s.fragmentShader;s.fragmentShader=s.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n diffuseColor.rgb*=mix(.68,1.16,vTip);');};
const blade=new THREE.PlaneGeometry(.035,.17,1,2);blade.translate(0,.085,0);grass=new THREE.InstancedMesh(blade,grassMat,28000);grass.receiveShadow=true;const dummy=new THREE.Object3D();let gi=0;
while(gi<28000){const central=gi<22000,x=central?(G.rand()+G.rand()+G.rand()-1.5)*25:-95+G.rand()*190,z=central?(G.rand()+G.rand()+G.rand()-1.5)*23:-24+G.rand()*70,lx=x*50+700,ly=z*50/1.65+650;if(G.inPond(lx,ly,10)||G.insideBed(lx,ly,8)||Math.abs(x-(-1.2+Math.sin(z*.29)*.55))<.9&&z>-6||lx>500&&lx<790&&ly<493||lx>233&&lx<445&&ly>744&&ly<850)continue;dummy.position.set(x,.006,z);dummy.rotation.y=G.rand()*6.28;dummy.scale.setScalar(.65+G.rand()*.85);dummy.updateMatrix();grass.setMatrixAt(gi++,dummy.matrix);}grass.instanceMatrix.needsUpdate=true;scene.add(grass);
// Animated model instances. SkeletonUtils preserves separate skeletons for every clone.
const animalObjects=new Map(),pickables=[];
function addAnimal(a,type,height){const o=place(model(type,{height,tint:type==='chicken'?['#fff5de','#d4ab86','#8b9690','#e4d1a7'][a.breed??0]:undefined}),a.x,a.y);o.userData.target=a;o.userData.type=type;animalObjects.set(a,o);pickables.push(o);return o;}
world.chickens.forEach(a=>addAnimal(a,'chicken',.7));world.koi.forEach(a=>addAnimal(a,'animal-fish',.48));Farm.animals.forEach(a=>addAnimal(a,a.kind==='cow'?'animal-cow':'horse',a.kind==='cow'?1.1:1.6));
const bees=[];for(let i=0;i<5;i++){const o=place(model('animal-bee',{width:.2}),350+i*145,600,1.3);play(o,'idle');bees.push(o);}
const birds=[];for(let i=0;i<7;i++){const o=model('animal-parrot',{height:.25,tint:'#a2afa6'});root.add(o);birds.push(o);}
const eggObjects=new Map();
// Allowed sky dome shader with clouds, sun/moon discs and stars.
const skyMat=new THREE.ShaderMaterial({side:THREE.BackSide,depthWrite:false,uniforms:{uTime:windTime,uHour:{value:12},uNight:{value:0},uSun:{value:new THREE.Vector3(-.4,.6,-.8)}},vertexShader:'varying vec3 vDir;void main(){vDir=position;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}',fragmentShader:`uniform float uTime;uniform float uHour;uniform float uNight;uniform vec3 uSun;varying vec3 vDir;
float hash(vec3 p){return fract(sin(dot(p,vec3(127.1,311.7,74.7)))*43758.5453);}void main(){vec3 d=normalize(vDir);float h=max(0.,d.y);float gold=exp(-pow((uHour-18.)/1.6,2.));vec3 top=mix(vec3(.57,.73,.76),vec3(.62,.47,.50),gold);vec3 horizon=mix(vec3(.85,.87,.71),vec3(.97,.71,.48),gold);vec3 c=mix(horizon,top,pow(h,.5));c=mix(c,mix(vec3(.20,.29,.41),vec3(.045,.09,.20),h),uNight);float disc=dot(d,normalize(uSun));c+=vec3(1.,.75,.35)*pow(max(0.,disc),700.)*(1.-uNight);c+=vec3(.7,.78,.91)*pow(max(0.,dot(d,normalize(vec3(-.5,.7,-.6)))),1900.)*uNight;
vec3 cell=floor(d*220.);float stars=step(.9975,hash(cell))*pow(max(0.,sin(uTime*.4+hash(cell)*8.)),.3);c+=stars*uNight*smoothstep(.1,.4,h)*.65;
float cl=sin(d.x*16.+uTime*.012+sin(d.z*11.))*sin(d.z*21.+uTime*.015);float cloud=smoothstep(.32,.75,cl)*smoothstep(.0,.2,h)*(1.-smoothstep(.5,.85,h));c=mix(c,vec3(.96,.93,.82)*(1.-uNight*.88),cloud*.3);gl_FragColor=vec4(c,1.);}`});const sky=new THREE.Mesh(new THREE.SphereGeometry(110,32,16),skyMat);scene.add(sky);
// Particles: ambient fireflies, smoke, petals and care bursts, no modeled props.
const maxParticles=650,pos=new Float32Array(maxParticles*3),colors=new Float32Array(maxParticles*3),sizes=new Float32Array(maxParticles);const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(pos,3));pg.setAttribute('color',new THREE.BufferAttribute(colors,3));pg.setAttribute('size',new THREE.BufferAttribute(sizes,1));const pm=new THREE.ShaderMaterial({transparent:true,depthWrite:false,vertexColors:true,uniforms:{uDpr:{value:Math.min(devicePixelRatio,2)}},vertexShader:'attribute float size;varying vec3 vColor;uniform float uDpr;void main(){vColor=color;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);gl_PointSize=size*uDpr;}',fragmentShader:'varying vec3 vColor;void main(){float d=length(gl_PointCoord-.5)*2.;if(d>1.)discard;gl_FragColor=vec4(vColor,pow(1.-d,1.5)*.65);}'});const particles=new THREE.Points(pg,pm);particles.frustumCulled=false;scene.add(particles);
let currentNight=0;
function lighting(){const h=clockHour(),night=THREE.MathUtils.smoothstep(h,18.4,21)*(h>12?1:0)+(h<6?1:0),gold=Math.exp(-(((h-18)/1.7)**2));currentNight=night;duskUniform.value=night;hemi.intensity=1.12-night*.42;hemi.color.set(night>.5?'#a4bce0':'#fff1d3');hemi.groundColor.set(night>.5?'#596b7d':'#697e50');sun.intensity=(3.1+gold*.65)*(1-night);sun.color.set(gold>.25?'#ffc487':'#fff0d4');const angle=(h-6)/14*Math.PI;sun.position.set(-Math.cos(angle)*22+Farm.pan/50,Math.max(3,Math.sin(angle)*26),12);sun.target.position.set(Farm.pan/50,0,0);moon.intensity=night*.85;lantern.intensity=night*(7+Math.sin(world.elapsed*5)*.2);for(const l of windowLights)l.intensity=night*2.2;renderer.toneMappingExposure=1.12+night*.12;scene.fog.color.set(night>.5?'#344a65':gold>.3?'#c7b09a':'#b6c9b0');skyMat.uniforms.uHour.value=h;skyMat.uniforms.uNight.value=night;skyMat.uniforms.uSun.value.copy(sun.position).normalize();waterUniforms.uNight.value=night;grade.uniforms.warm.value=gold;for(const l of windows)l.traverse(m=>{if(m.isMesh){if(!m.userData.lit){m.material=m.material.clone();m.userData.lit=true;}m.material.emissive.set('#ffbb60');m.material.emissiveIntensity=night*.8;}});}
function resize(){const aspect=innerWidth/innerHeight;let halfH=aspect<1?12.5/aspect:10.7,halfW=halfH*aspect;if(params.get('close')){halfH=params.get('close')==='house'?4.6:4;halfW=halfH*aspect;}Object.assign(camera,{left:-halfW,right:halfW,top:halfH,bottom:-halfH});camera.updateProjectionMatrix();renderer.setSize(innerWidth,innerHeight);composer.setPixelRatio(renderer.getPixelRatio());composer.setSize(innerWidth,innerHeight);view.w=innerWidth;view.h=innerHeight;view.scale=innerWidth/(halfW*100);view.dpr=renderer.getPixelRatio();}
const focus=new THREE.Vector3(),projection=new THREE.Vector3();
function cameraUpdate(){const close=params.get('close');if(close==='house')focus.copy(logical(630,440,1));else if(close==='pond')focus.copy(logical(999,626,.1));else if(close==='chickens')focus.copy(logical(620,760,.3));else focus.set(Farm.pan/50,0,-.5);camera.position.copy(focus).add(new THREE.Vector3(5,25,24.5));camera.lookAt(focus);camera.updateMatrixWorld();}
function screen(x,y,height=0){projection.copy(logical(x,y,height)).project(camera);return{x:(projection.x*.5+.5)*innerWidth,y:(-.5*projection.y+.5)*innerHeight};}
const needEls=new Map(),iconPaths={heart:'<path d="M20 28C-2 14 10 2 20 12c10-10 22 2 0 16" fill="#cf968b"/>',water:'<path d="M20 8C17 14 9 20 13 27c5 8 18 3 15-5-1-5-5-10-8-14" fill="#78a9b0"/>',food:'<path d="m13 28 15-17M18 25q-10-3-6-8 7 0 6 8m4-6q-2-9 5-10 4 5-5 10m-6 8q8 2 10-4-5-5-10 4" stroke="#b89c62" fill="#dbc487" stroke-width="2"/>'};
function bubbles(){for(const [n,e] of needEls)if(!world.needs.includes(n)){e.remove();needEls.delete(n);}for(const n of world.needs){let e=needEls.get(n);if(!e){e=document.createElement('button');e.className='need';e.setAttribute('aria-label',n.kind==='heart'?'Affection':n.kind==='water'?'Water':'Feed');e.innerHTML=`<svg viewBox="0 0 40 40"><circle cx="20" cy="20" r="18" fill="none" stroke="#d4d6b8" stroke-width="1.5"/><circle class="progress" cx="20" cy="20" r="18" fill="none" stroke="${n.kind==='heart'?'#cf968b':n.kind==='water'?'#78a9b0':'#b89c62'}" stroke-width="2" stroke-dasharray="113" transform="rotate(-90 20 20)"/>${iconPaths[n.kind]}</svg>`;e.onclick=()=>{G.startAudio();G.fulfillNeed(n);};document.querySelector('#needs').append(e);needEls.set(n,e);}const p=screen(n.target.x,n.target.y,n.target.breed!==undefined?1.35:n.target.koi?1.2:1.45);e.style.left=p.x+'px';e.style.top=(p.y+Math.sin(world.elapsed*2)*3)+'px';e.querySelector('.progress').style.strokeDashoffset=113*Math.min(.85,(world.elapsed-n.born)/100);}}
const raycaster=new THREE.Raycaster(),pointer=new THREE.Vector2(),plane=new THREE.Plane(new THREE.Vector3(0,1,0),0),hit=new THREE.Vector3();let down=null,lastWater=-100;
function care(e,continuous=false){pointer.set(e.clientX/innerWidth*2-1,-e.clientY/innerHeight*2+1);raycaster.setFromCamera(pointer,camera);const hits=raycaster.intersectObjects([...pickables,...plants,water],true);let obj=hits[0]?.object;while(obj&&!obj.userData.target)obj=obj.parent;let target=obj?.userData.target;raycaster.ray.intersectPlane(plane,hit);let x=hit.x*50+700,y=hit.z*50/1.65+650;if(target){x=target.x;y=target.y;}
 if(continuous){if(world.tool!=='water'||world.elapsed-lastWater<.18)return;lastWater=world.elapsed;}
 if(!continuous&&G.Farm.interact(x,y-(target?.kind?46*(.52+target.age*.48):0)))return;
 if(target&&world.chickens.includes(target)){if(world.tool==='grain'){G.scatterGrain(x,y);return;}target.pet=2;target.path=[];target.pause=2;G.burst(x,y-40);world.needs=world.needs.filter(n=>n.target!==target);return;}
 if(target&&world.plants.includes(target)){G.waterPlant(target);world.needs=world.needs.filter(n=>n.target!==target);return;}
 if(G.inPond(x,y,-12)){G.feedFish(x,y);return;}
 // Generous projected picking for tiny animals and flowers on portrait screens.
 let best=null,dist=30;for(const a of [...world.chickens,...world.plants]){const p=screen(a.x,a.y,a.breed!==undefined?.35:.45),d=Math.hypot(p.x-e.clientX,p.y-e.clientY);if(d<dist){best=a;dist=d;}}if(best){if(best.breed!==undefined){best.pet=2;G.burst(best.x,best.y-40);}else G.waterPlant(best);world.needs=world.needs.filter(n=>n.target!==best);return;}
 if(!continuous)G.scatterGrain(x,y);
}
canvas.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY,pan:Farm.targetPan,moved:false};canvas.setPointerCapture(e.pointerId);G.startAudio();});canvas.addEventListener('pointermove',e=>{if(!down)return;if(Math.abs(e.clientX-down.x)>10){down.moved=true;Farm.targetPan=THREE.MathUtils.clamp(down.pan-(e.clientX-down.x)/view.scale,-1450,1450);}if(!down.moved)care(e,true);});canvas.addEventListener('pointerup',e=>{if(down&&!down.moved)care(e);down=null;});canvas.addEventListener('pointercancel',()=>down=null);canvas.addEventListener('wheel',e=>{if(Math.abs(e.deltaX)>.5){e.preventDefault();Farm.targetPan=THREE.MathUtils.clamp(Farm.targetPan+e.deltaX/view.scale,-1450,1450);}},{passive:false});
function animateObjects(dt){const t=world.elapsed;for(const a of [...Farm.chicks,...Farm.animals])if(!animalObjects.has(a))addAnimal(a,a.kind==='horse'?'horse':a.kind==='cow'?'animal-cow':'animal-chick',a.kind==='horse'?1.6:a.kind==='cow'?1.1:.42);
 let i=0;for(const[a,o]of animalObjects){const fish=world.koi.includes(a),chicken=world.chickens.includes(a),moving=chicken?a.path.length:a.moving;let h=fish?-.41:0; o.position.copy(logical(a.x,a.y,h));o.visible=!(a.sheltered||a.mode==='waking'&&a.wakeDelay>0);if(a.sleeping){o.position.copy(logical(world.coop.x+(a.sleepSlot%4-1.5)*28,world.coop.y-35,0));o.scale.y=o.userData.baseScale*.65;}else{const size=a.age!==undefined?.52+a.age*.48:1,squash=a.pet?Math.sin(a.pet*12)*.06:0;o.scale.set(o.userData.baseScale*size*(1+squash),o.userData.baseScale*size*(1-squash),o.userData.baseScale*size);}
 const angle=fish?-a.angle+Math.PI/2:chicken?(a.path.length?Math.atan2(a.path[0].x-a.x,(a.path[0].y-a.y)*1.65):a.dir*Math.PI/2):a.dir*Math.PI/2;o.rotation.y+=Math.atan2(Math.sin(angle-o.rotation.y),Math.cos(angle-o.rotation.y))*(1-Math.exp(-dt*7));if(fish){o.rotation.z=Math.sin(t*3+a.phase)*.06;play(o,'walk');}else{play(o,a.sleeping?'idle':moving?'walk':a.mode==='feeding'||a.mode==='drinking'||a.eating?'eat':'idle');if(chicken&&a.mode==='feeding')play(o,'bite_front');}o.userData.mixer?.update(dt);if(chicken){henUniform.value[i++]?.copy(o.position);if(moving)o.position.y+=Math.abs(Math.sin(t*9+a.phase))*.025;}}
 plants.forEach((o,i)=>o.scale.setScalar(o.userData.baseScale*world.plants[i].growth));
 for(const[e,o]of eggObjects)if(!Farm.eggs.includes(e)){root.remove(o);eggObjects.delete(e);}for(const e of Farm.eggs)if(!eggObjects.has(e)){eggObjects.set(e,place(model('egg',{height:.23}),e.x,e.y));}
 bees.forEach((o,i)=>{o.position.copy(logical(350+i*145+Math.sin(t*.4+i)*35,600+Math.cos(t*.35+i)*40,1.1+Math.sin(t*2+i)*.15));o.userData.mixer?.update(dt);});birds.forEach((o,i)=>{const phase=t%100;o.visible=phase>14&&phase<52;o.position.set(-25+(phase-14)*1.35-Math.ceil(i/2)*.65,7+(i%2?.2:-.2)*Math.ceil(i/2),-8+i*.3);o.rotation.z=Math.sin(t*5+i)*.16;});
 for(let j=0;j<8;j++){const r=world.ripples[world.ripples.length-1-j];if(r){const p=logical(r.x,r.y);waterUniforms.uRipples.value[j].set(p.x,p.z,t-(3-r.life),0);}else waterUniforms.uRipples.value[j].z=-100;}
}
function particleUpdate(){const t=world.elapsed;let n=0;const c=new THREE.Color();function put(x,y,z,size,color){if(n>=maxParticles)return;pos[n*3]=x;pos[n*3+1]=y;pos[n*3+2]=z;sizes[n]=size;c.set(color);colors[n*3]=c.r;colors[n*3+1]=c.g;colors[n*3+2]=c.b;n++;}
 for(let i=0;i<30;i++){const u=(t*.12+i/30)%1;put(-.7+u*.7+Math.sin(t*.3+i)*.12,3.6+u*2.1,-8.45,5+u*13,'#bfc2b5');}
 put(lantern.position.x,lantern.position.y,lantern.position.z,18*currentNight,'#ffcf7a');
 for(let i=0;i<60;i++){const x=-12+(i*7.13)%25,z=-5+(i*3.71)%17;put(x+Math.sin(t*.4+i)*.3,.5+Math.sin(t*.6+i)*.3,z,currentNight*(2+Math.max(0,Math.sin(t*2+i))*5),'#f7da87');}
 for(let i=0;i<28;i++){const u=(t*.07+i/28)%1;put(-15+(i*7.19)%30+u*2,3-u*3,-7+(i*2.91)%19,2.5,'#dfb8aa');}
 for(const p of world.particles){const v=logical(p.x,p.y,.2+Math.max(0,1.8-p.life)*.35);put(v.x,v.y,v.z,p.kind==='heart'?8:4,p.kind==='water'?'#bce5dd':p.kind==='heart'?'#e49d9c':'#efd398');}
 for(const f of [...world.food,...world.fishFood]){const v=logical(f.x,f.y,.14);put(v.x,v.y,v.z,3,'#e0be77');}
 for(const w of world.watering)for(let j=0;j<9;j++){const v=logical(w.x-18+j*4,w.y,.2+((t*1.3+j*.11)%1)*.8);put(v.x,v.y,v.z,4,'#c1e6e0');}
 pg.setDrawRange(0,n);pg.attributes.position.needsUpdate=true;pg.attributes.color.needsUpdate=true;pg.attributes.size.needsUpdate=true;}
renderer.info.autoReset=false;
const frames=[],renderTimes=[];let last=0,qualityClock=0;
world.started=true;world.nextNeed=9;
if(params.get('needs')==='1')world.needs=[{target:world.chickens[1],kind:'heart',born:-1},{target:world.koiTarget,kind:'food',born:-1},{target:world.plants[8],kind:'water',born:-1}];
resize();cameraUpdate();qualitySet(quality);lighting();await renderer.compileAsync(scene,camera);renderer.render(scene,camera);
function tick(now){const raw=last?(now-last)/1000:0;last=now;const dt=Math.min(.05,raw);if(!document.hidden){const start=performance.now();renderer.info.reset();G.update(dt);Farm.update(dt);windTime.value=world.elapsed;lighting();cameraUpdate();animateObjects(dt);particleUpdate();bubbles();if(quality==='high')composer.render();else renderer.render(scene,camera);if(!window.Garden.ready){window.Garden.ready=true;document.body.classList.add('ready');}renderTimes.push(performance.now()-start);if(raw>0){frames.push(raw*1000);if(frames.length>1200)frames.shift();qualityClock+=raw;if(quality==='high'&&qualityClock>10&&frames.slice(-120).reduce((a,b)=>a+b,0)/Math.min(120,frames.length)>34)qualitySet('low',true);}}requestAnimationFrame(tick);}
window.Garden={world,Farm,view,ready:false,screen,setHour,setTime(t){world.forcedTime=t;world.time=t;},needs(){world.needs=[{target:world.chickens[1],kind:'heart',born:world.elapsed-1},{target:world.koiTarget,kind:'food',born:world.elapsed-1},{target:world.plants[8],kind:'water',born:world.elapsed-1}];},stats(){const sum=a=>a.reduce((x,y)=>x+y,0)/Math.max(1,a.length);return{averageFrameMs:sum(frames),p95FrameMs:[...frames].sort((a,b)=>a-b)[Math.floor(frames.length*.95)],cpuRenderMs:sum(renderTimes.slice(-600)),samples:frames.length,quality,fallback,grassCount:grass.count,dpr:renderer.getPixelRatio(),drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles,lantern:lantern.intensity,webgl:renderer.getContext().getParameter(renderer.getContext().VERSION)};},resetStats(){frames.length=0;renderTimes.length=0;},quality:q=>qualitySet(q),forceFallback(){qualitySet('low',true);},projectTarget(a){return screen(a.x,a.y,world.chickens.includes(a)?.35:.45);}};
addEventListener('resize',resize);requestAnimationFrame(tick);
