import { itemIcon, ICONS } from '../ui/icons.js';
import * as THREE from 'three';
import { model,ownMaterials } from '../../assets.js';
// A dedicated depth-cleared viewmodel pass: downloaded props stay sharply lit,
// large and readable without intersecting the world or clipping through a wall.
function printedBag(root,key){
 const seed=key.startsWith('seed_'),crop=key.slice(5),canvas=document.createElement('canvas');canvas.width=512;canvas.height=768;const ctx=canvas.getContext('2d'),texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=8;
 // Labels are icon seals only, including on the held 3D bag itself.
 ctx.fillStyle='#f2e5c4';ctx.fillRect(0,0,512,768);ctx.strokeStyle='#bcaa7f';ctx.lineWidth=9;ctx.strokeRect(24,24,464,720);ctx.fillStyle='#60795b';ctx.fillRect(38,38,436,145);
 ctx.fillStyle='#fff6df';for(const x of [216,256,296]){ctx.beginPath();ctx.arc(x,110,10,0,Math.PI*2);ctx.fill();}
 ctx.fillStyle='#e2d5ae';ctx.beginPath();ctx.ellipse(256,425,180,180,0,0,Math.PI*2);ctx.fill();
 ctx.strokeStyle='#79866a';ctx.lineWidth=4;ctx.beginPath();ctx.moveTo(165,664);ctx.lineTo(347,664);ctx.stroke();
 const raw=seed?itemIcon(crop):itemIcon(key==='feed_chicken'?'animal_chicken_f':key==='feed_cow'?'animal_cow_f':'animal_horse_f');
 const img=new Image();img.onload=()=>{ctx.drawImage(img,106,275,300,300);texture.needsUpdate=true;};
 const source=raw.match(/src="([^"]+)"/);img.src=source?source[1]:'data:image/svg+xml;charset=utf-8,'+encodeURIComponent(raw.replace('<svg ','<svg xmlns="http://www.w3.org/2000/svg" width="300" height="300" '));

 root.traverse(mesh=>{if(!mesh.isMesh)return;mesh.geometry.computeBoundingBox();const b=mesh.geometry.boundingBox,low=seed?new THREE.Vector2(b.min.z,b.min.x):new THREE.Vector2(b.min.x,b.min.y),extent=seed?new THREE.Vector2(b.max.z-b.min.z,b.max.x-b.min.x):new THREE.Vector2(b.max.x-b.min.x,b.max.y-b.min.y);const m=mesh.material;
 m.onBeforeCompile=shader=>{shader.uniforms.uHeldPrint={value:texture};shader.uniforms.uPrintOrigin={value:low};shader.uniforms.uPrintExtent={value:extent};shader.vertexShader='varying vec3 vPrintPosition;varying vec3 vPrintNormal;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n vPrintPosition=position;vPrintNormal=normal;');shader.fragmentShader='uniform sampler2D uHeldPrint;uniform vec2 uPrintOrigin,uPrintExtent;varying vec3 vPrintPosition;varying vec3 vPrintNormal;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
 vec2 labelUV=(${seed?'vPrintPosition.zx':'vPrintPosition.xy'}-uPrintOrigin)/uPrintExtent;
 
 float face=smoothstep(.5,.8,abs(vPrintNormal.${seed?'y':'z'}));float border=smoothstep(.025,.075,min(min(labelUV.x,1.-labelUV.x),min(labelUV.y,1.-labelUV.y)));
 diffuseColor.rgb=mix(diffuseColor.rgb,texture2D(uHeldPrint,clamp(labelUV,0.,1.)).rgb,face*border*.98);
 `);};m.customProgramCacheKey=()=>seed?'printed-seed-pouch-v1':'printed-feed-sack-v1';
 });
}

export function createHeldItem({renderer,hud,game,cameraControl,getNight=()=>game.clock.night?1:0}){
 const scene=new THREE.Scene(),camera=new THREE.PerspectiveCamera(34,1,.01,30),pivot=new THREE.Group(),cache=new Map();let shown='',object=null,phase=0;
 camera.position.set(0,.18,4.1);camera.lookAt(0,0,0);const ambient=new THREE.HemisphereLight('#fff8df','#536a53',2.4);scene.add(ambient);const key=new THREE.DirectionalLight('#fff0d0',3.6);key.position.set(-2,4,5);scene.add(key);const rim=new THREE.DirectionalLight('#d1e7ec',2.2);rim.position.set(3,1,-2);scene.add(rim,pivot);
 const crops={daisy:'flower_yellowA',wheat:'crops_wheatStageB',tulip:'flower_redA',cabbage:'cabbage',sunflower:'flower_yellowC',lavender:'flower_purpleB'};
 function make(k){const g=new THREE.Group();let name=k==='can'?'watering-can':k==='flashlight'?'hand-flashlight':k==='egg'?'egg':k==='milk'?'carton-small':k==='hay'?'hay-bale':k==='fence'?'fence_simple':k==='gate'?'fence-gate':k==='fish'?'bowl-cereal':k.startsWith('feed_')?'feed-sack':k.startsWith('seed_')?'seed-sack':crops[k];
  if(!name)return null;const o=model(name,{raw:true});g.add(o);ownMaterials(o);const box=new THREE.Box3().setFromObject(o),size=box.getSize(new THREE.Vector3());o.position.sub(box.getCenter(new THREE.Vector3()));
  g.rotation.set(k.startsWith('seed_')?Math.PI/2-.25:k==='flashlight'?.55:0,k.startsWith('seed_')?Math.PI/2-.18:k==='can'?-.7:k==='flashlight'?-.35:.3,k==='can'?-.17:k==='flashlight'?-.28:-.12);
  const rotated=new THREE.Box3().setFromObject(g).getSize(new THREE.Vector3());g.scale.setScalar(2.1/Math.max(rotated.x,rotated.y,rotated.z));
  g.traverse(m=>{if(m.isMesh){m.castShadow=false;m.receiveShadow=false;m.material.roughness=k==='can'||k==='flashlight'?.38:.78;if(k==='can')m.material.color.set('#94bcb6');if(k==='flashlight'){m.material.metalness=.24;if(/handle/i.test(m.material.name))m.material.color.set('#b39a6b');else if(/glasse/i.test(m.material.name)){m.material.color.set('#e8dfb5');m.material.emissive.set('#ffdfa0');m.material.emissiveIntensity=.5;}else if(!/button/i.test(m.material.name))m.material.color.set('#44675d');}}});if(k.startsWith('seed_')||k.startsWith('feed_'))printedBag(o,k);return g;}
 function render(dt){const k=hud.selected;if(k!==shown){object?.removeFromParent();shown=k;if(!cache.has(k))cache.set(k,make(k));object=cache.get(k);if(object)pivot.add(object);}
  if(!cameraControl.isFirstPerson||!object||hud.inventoryOpen||document.querySelector('#shop.open')||document.body.classList.contains('wolf-lunge'))return;
  const night=getNight();ambient.intensity=2.4-night*1.8;key.intensity=3.6-night*2.4;rim.intensity=2.2-night*.8;
  phase+=dt;const speed=Math.hypot(cameraControl.player.vx,cameraControl.player.vz);pivot.position.set(Math.sin(phase*1.1)*.018,Math.sin(phase*1.8)*.025+Math.sin(phase*7)*Math.min(.025,speed*.006),0);pivot.rotation.z=Math.sin(phase)*.018;
  const mobile=innerWidth<700,w=mobile?Math.min(210,innerWidth*.48):Math.min(460,innerWidth*.32),h=mobile?240:Math.min(410,innerHeight*.46),x=innerWidth-w-(mobile?0:14),y=mobile?95:96;
  camera.aspect=w/h;camera.updateProjectionMatrix();const clear=renderer.autoClear;renderer.autoClear=false;renderer.setViewport(x,y,w,h);renderer.setScissor(x,y,w,h);renderer.setScissorTest(true);renderer.clearDepth();renderer.render(scene,camera);renderer.setScissorTest(false);renderer.setViewport(0,0,innerWidth,innerHeight);renderer.autoClear=clear;
 }
 return {render,scene,camera,snapshot:()=>({item:shown,model:object?.children[0]?.userData.asset,visible:cameraControl.isFirstPerson&&!!object})};
}
