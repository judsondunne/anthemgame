import * as THREE from 'three';
import {loadAssets,model,play,windTime} from '../../assets.js';
import {createWorld} from '../../src/render/world.js';
import {createAnimalRenderer,HEN_COATS} from '../../src/render/animals.js';
await loadAssets();
const renderer=new THREE.WebGLRenderer({canvas:document.querySelector('canvas'),antialias:true,preserveDrawingBuffer:true});
renderer.setPixelRatio(1);renderer.setSize(innerWidth,innerHeight);renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.15;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const params=new URLSearchParams(location.search),kind=params.get('kind')??'chicken';
const scenes=[],cameras=[];const subjects=[];let columns=5;let poseRenderer=null;
function lit(){const s=new THREE.Scene();s.background=new THREE.Color('#cbd7b9');s.add(new THREE.HemisphereLight('#fff4d7','#687b55',2));const sun=new THREE.DirectionalLight('#fff1d1',3.2);sun.position.set(-10,18,10);sun.castShadow=true;sun.shadow.mapSize.set(1024,1024);sun.shadow.camera.left=-8;sun.shadow.camera.right=8;sun.shadow.camera.top=8;sun.shadow.camera.bottom=-8;sun.shadow.bias=-.0002;s.add(sun);return s;}
if(kind==='world'){
const s=lit(),c=new THREE.PerspectiveCamera(55,innerWidth/innerHeight,.05,300);c.position.set(31,9,25);c.lookAt(49,0,0);const world=createWorld({scene:s,camera:c});scenes.push(s);cameras.push(c);window.review={world,scene:s,camera:c,renderer,setCamera:(position,target)=>{c.position.fromArray(position);c.lookAt(...target);}};
} else if(kind==='poses') {
const agents=Array.from({length:5},(_,i)=>({x:(i-2)*1.5,y:0,kind:'chicken',sex:'f',breed:0,path:i===1?[{x:i,y:10}]:[],mode:i===2?'feeding':'idle',sleeping:i===3,dead:i===4,diedRecently:true,phase:i,dir:0,age:1,simMotion:true,moving:i===1,heading:Math.PI/2,sleepSlot:0,home:{x:(i-2)*1.5,y:0}}));
const s=lit(),c=new THREE.OrthographicCamera(-4.5,4.5,2.6,-2.6,.01,100);c.position.set(3,3.5,7);c.lookAt(0,.4,0);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#8fa772',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;s.add(ground);
const world={elapsed:0,chickens:agents,koi:[],coop:{x:0,y:0}},Farm={animals:[]};poseRenderer=createAnimalRenderer({group:s,world,Farm,logical:(x,y,h)=>new THREE.Vector3(x,h,y),henUniform:{value:[]},burst:()=>{}});
scenes.push(s);cameras.push(c);window.review={subjects,scenes,cameras,renderer,world,agents,poseRenderer};
} else {
const names=['chicken','hen','chick','chicken-pixor','animal-chick'];
const variants=kind==='variants'?[...HEN_COATS.map(recolor=>['chicken-pixor',recolor]),['baby',null],['rooster',null]]:names.map(n=>[n,null]);
columns=variants.length;
for(let row=0;row<2;row++)for(let col=0;col<columns;col++){
const [name,recolor]=variants[col],s=lit();s.background=new THREE.Color(row?'#bccc9d':'#bdcda9');
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#8fa772',roughness:1}));ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;s.add(ground);
const baby=name==='baby',rooster=name==='rooster';const useName=baby||rooster?'chicken-pixor':name;
const colors=baby?{'Brown fur':'#f0d78e','Bread crust':'#e3bf70',Beak:'#d8a356'}:rooster?{'Brown fur':'#a76543','Bread crust':'#536f65','Comb red':'#c46656',Beak:'#e3bd72'}:recolor;
const o=model(useName,{height:baby?.34:rooster?.82:name.includes('chick')&&name!=='chicken'&&name!=='chicken-pixor'?.38:.72,...(colors?{recolor:colors}:{})});
if(baby)o.traverse(m=>{if(m.name==='Hen_comb'||m.name==='Hen comb')m.visible=false;});
if(rooster)o.traverse(m=>{if(m.name==='Hen_comb'||m.name==='Hen comb')m.scale.y=1.3;if(m.name==='Hen_tail'||m.name==='Hen tail')m.scale.set(1.2,1.25,1.25);});
o.rotation.y=-.48;s.add(o);subjects.push(o);play(o,'idle');
const span=row?1.24:5.3,c=new THREE.OrthographicCamera(-span/2,span/2,span*.75,-span*.75,.01,100);c.position.set(2.6,2.2,4.2);c.lookAt(0,.35,0);scenes.push(s);cameras.push(c);
}
window.review={subjects,scenes,cameras,renderer,setPose:(pose)=>subjects.forEach(o=>{play(o,pose);o.userData.mixer?.update(.4);})};
}
let last=performance.now();function frame(now){const dt=Math.min(.05,(now-last)/1000);last=now;windTime.value=now/1000;renderer.setScissorTest(true);
if(kind==='world'){renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setScissor(0,0,innerWidth,innerHeight);review.world.update(dt);renderer.render(scenes[0],cameras[0]);}
else if(kind==='poses'){review.world.elapsed+=dt;poseRenderer.update(dt);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.setScissor(0,0,innerWidth,innerHeight);renderer.render(scenes[0],cameras[0]);}
else for(let i=0;i<columns*2;i++){const col=i%columns,row=Math.floor(i/columns),w=innerWidth/columns,h=innerHeight/2;renderer.setViewport(col*w,(1-row)*h,w,h);renderer.setScissor(col*w,(1-row)*h,w,h);subjects[i].userData.mixer?.update(dt);renderer.render(scenes[i],cameras[i]);}
window.artReady=true;if(!window.pauseArt)requestAnimationFrame(frame);}requestAnimationFrame(frame);
