// The cottage is assembled exclusively from downloaded Kenney / Quaternius
// modules. Box records below are collision data, never generated prop geometry.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { model, ownMaterials } from '../../assets.js';
import { BALANCE as B } from '../config/balance.js';

function fit(name, width, height, depth, tint) {
  const g = model(name, { raw: true, tint });
  const box = new THREE.Box3().setFromObject(g), size = box.getSize(new THREE.Vector3());
  const inner = g.children[0];
  inner.position.sub(new THREE.Vector3((box.min.x + box.max.x) / 2, box.min.y, (box.min.z + box.max.z) / 2));
  g.scale.set(width / size.x, height / size.y, depth / size.z);
  return g;
}
function batch(group) {
  group.updateMatrixWorld(true);
  const inverse = group.matrixWorld.clone().invert(), buckets = new Map();
  group.traverse(mesh => {
    if (!mesh.isMesh || Array.isArray(mesh.material) || mesh.isSkinnedMesh) return;
    for (let p = mesh.parent; p && p !== group; p = p.parent) if (p.userData.hinged) return;
    const m = mesh.material, key = [m.color.getHex(),m.map?.uuid,m.roughness,m.name,m.customProgramCacheKey(),Object.keys(mesh.geometry.attributes).sort().join(',')].join('|');
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key).push(mesh);
  });
  for (const meshes of buckets.values()) {
    if (meshes.length < 2) continue;
    const copies = meshes.map(m => m.geometry.clone().applyMatrix4(inverse.clone().multiply(m.matrixWorld)));
    const geo = mergeGeometries(copies, false);
    if (geo) { const mesh = new THREE.Mesh(geo, meshes[0].material); mesh.castShadow = mesh.receiveShadow = true; group.add(mesh); meshes.forEach(m => m.removeFromParent()); }
    copies.forEach(g => g.dispose());
  }
}

export function createCottage(lanterns = []) {
  const cfg = B.cottage;
  const g = new THREE.Group(); g.name = 'Furnished garden cottage'; g.userData.dynamicArchitecture = true;
  const shell = new THREE.Group(), front = new THREE.Group(), roof = new THREE.Group(), furnishing = new THREE.Group();
  g.add(shell, front, roof, furnishing);
  const boxes = [], localSurfaces = [], lamps = [];
  const floorY = cfg.floor, half = cfg.halfWidth, depth = cfg.depth, wallHeight = cfg.wallHeight;
  function put(name, x, y, z, width, height, length, rotation = 0, parent = shell, tint) {
    const o = fit(name, width, height, length, tint); o.position.set(x, y, z); o.rotation.y = rotation; parent.add(o); return o;
  }
  const block = (x0,x1,z0,z1,y=wallHeight,baseY=floorY,type='wall') => { const b={x0,x1,z0,z1,y,baseY,type};boxes.push(b);return b; };
  function furniture(name,x,z,width,heading=0,solid=true,height=null) {
    const o=model('interior-'+name,{width});o.position.set(x,floorY,z);o.rotation.y=heading;furnishing.add(o);
    if(height){const size=new THREE.Box3().setFromObject(o).getSize(new THREE.Vector3());o.scale.y*=height/size.y;}
    if(solid){o.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(o);block(box.min.x,box.max.x,box.min.z,box.max.z,box.max.y,box.min.y,'furniture');localSurfaces.push(boxes.at(-1));}
    return o;
  }
  // Narrow original planks form a detailed, continuous timber floor.
  // The downloaded solid floor module backs the separate decorative planks so
  // their authored slat gaps never reveal outdoor grass inside the rooms.
  put('interior-floorFull',0,floorY-.08,-depth/2,half*2,.04,depth,0,shell,'#a99472');
  for(let x=-half+.52;x<half;x+=1.03)for(let z=-depth+.45;z<.05;z+=.9)put('planks',x,floorY-.06,z,1.035,.06,.905);
  // Each wall is an original bevelled timber/plaster kit module.
  for(const side of [-1,1])for(let i=0;i<3;i++){
    const z=-depth+(i+.5)*depth/3;
    put(i===1?'wall-window-glass':'wall',side*half,floorY,z,.18,wallHeight,depth/3,0,shell,'#e2dcc5');
  }
  for(const x of [-half/2,half/2])put('wall-window-shutters',x,floorY,-depth,.18,wallHeight,half,Math.PI/2,shell,'#d7d4bb');
  const gap=cfg.doorWidth;
  for(const side of [-1,1])put('wall-window-shutters',side*(half+gap/2)/2,floorY,.02,.18,wallHeight,half-gap/2,Math.PI/2,front,'#e6ddc4');
  const door = put('interior-doorwayFront',0,floorY,.025,gap,wallHeight*.94,.19,0,front,'#bba77f');
  door.userData.hinged=true;
  const hinge=door.getObjectByName('door');
  block(-half-.12,-half+.12,-depth-.12,.12);block(half-.12,half+.12,-depth-.12,.12);block(-half,half,-depth-.12,-depth+.12);
  block(-half,-gap/2,-.12,.15);block(gap/2,half,-.12,.15);
  // Bedroom is a real rear room, with a clear interior doorway.
  put('wall-wood',.22,floorY,-4.2,.1,wallHeight,2.4,0,shell,'#d7c9ad');
  put('wall-wood',2.48,floorY,-3.0,.1,wallHeight,1.3,Math.PI/2,shell,'#d7c9ad');
  put('wall-wood',.45,floorY,-3.0,.1,wallHeight,.45,Math.PI/2,shell,'#d7c9ad');
  block(.15,.3,-depth,-3.0);block(1.82,half,-3.08,-2.92);block(.22,.67,-3.08,-2.92);
  // Steep gable, original dormers, veranda and timber trim suggest a small
  // Victorian cottage using the established stylized architectural family.
  put('roof-gable-detail',0,floorY+wallHeight-.03,-depth/2,half*2+.65,2.15,depth+.55,0,roof,'#91a499');
  put('interior-floorFull',0,floorY+wallHeight-.05,-depth/2,half*2,.08,depth,0,roof,'#e4dcc5');
  for(const side of [-1,1])put('roof-window',side*1.45,floorY+wallHeight+.55,-1.14,.82,.95,.85,Math.PI/2,roof);
  put('chimney',-1.65,floorY+wallHeight+1.1,-4.25,.58,1.65,.72,0,roof);
  for(const x of [-half,half])for(const z of [-depth,.02])put('pillar-wood',x,floorY-.08,z,.15,wallHeight+.15,.15);
  for(const x of [-2.3,0,2.3])put('wall-detail-horizontal',x,.04,.0,.13,.23,2.2,Math.PI/2,front);
  for(let i=-1;i<=1;i++)put('planks',i*1.75,.015,.72,1.76,.075,1.42);
  for(const x of [-2.5,2.5])put('pillar-wood',x,.04,1.25,.16,2.1,.16,0,front);
  put('roof-gable',0,2.13,.72,5.8,.67,1.75,0,roof);
  put('stairs-wood',0,-.015,1.56,1.2,.18,.8,Math.PI/2);
  for(const x of [-1.85,1.85])put('balcony-wall-fence',x,.09,1.32,.14,.65,1.15,Math.PI/2,front);
  localSurfaces.push({x0:-2.65,x1:2.65,z0:0,z1:1.43,y:.10,baseY:0,type:'porch'},{x0:-.64,x1:.64,z0:1.4,z1:1.95,y:.09,baseY:0,type:'stairs'});
  // Living room leaves a central walking corridor from porch to kitchen.
  furniture('loungeSofa',-1.72,-4.35,1.95,0,true,.95);
  furniture('loungeChair',-2.28,-2.26,.82,Math.PI/2,true,.9);
  const rug=furniture('rugRounded',-1.55,-3.15,2.15,0,false);rug.position.y+=.008;
  furniture('tableCoffee',-1.45,-3.13,1.05,0,true,.48);
  furniture('bookcaseOpen',-2.7,-4.96,1.15,0,true,1.85);
  furniture('fireplace',-2.77,-.94,1.28,Math.PI/2,true,1.2);
  furniture('lampRoundFloor',-2.65,-3.45,.42,0,false);
  furniture('books',-1.48,-3.12,.31,0,false).position.y+=.48;
  furniture('pillow',-1.62,-4.22,.42,0,false).position.y+=.46;
  // Kitchen: continuous counter, stove, sink, shelves, round dining table.
  for(const [name,z]of[['kitchenCabinet',-.58],['kitchenStove',-1.35],['kitchenSink',-2.16]])furniture(name,2.7,z,.78,-Math.PI/2,true,.91);
  const upper=furniture('kitchenCabinetUpperDouble',2.81,-1.55,1.65,-Math.PI/2,false);upper.position.y=1.6;
  furniture('tableRound',1.1,-1.25,.85,0,true,.78);
  furniture('chairCushion',.65,-.6,.43,Math.PI/5,true,.83);
  furniture('chairCushion',1.48,-1.97,.43,Math.PI,true,.83);
  // Bedroom has a bed, nightstand, reading lamp, wardrobe and dresser.
  furniture('bedDouble',1.56,-4.58,1.48,0,true,.72);
  const nightstand=furniture('cabinetBedDrawer',2.69,-4.73,.55,0,true,.63);
  const bedLamp=furniture('lampRoundTable',2.7,-4.72,.32,0,false);bedLamp.position.y+=.63;
  furniture('bookcaseClosedDoors',2.76,-3.46,.68,-Math.PI/2,true,1.8);
  furniture('sideTableDrawers',.62,-4.94,.64,0,true,.9);
  // Text-free framed decor uses an original downloaded mirror frame.
  const art=furniture('bathroomMirror',-1.4,-5.23,.74,0,false);art.position.y=1.23;
  art.traverse(m=>{if(m.isMesh){m.material=m.material.clone();if(/mirror|glass/i.test(m.material.name)){m.material.color.set('#9cbaad');m.material.metalness=.2;}}});
  for(const side of [-1,1]){const curtain=furniture('curtains',side*2.98,-2.65,1.15,side*Math.PI/2,false);curtain.position.y=1.1;}
  for(const[x,z]of[[-2.65,-.35],[.42,-5.05]])furniture('pottedPlant',x,z,.42,0,false);
  // An ornamental clock: an existing round frame, with shader-only symbol face.
  const clock=furniture('bathroomMirror',2.0,-.105,.42,Math.PI,false);clock.position.y=1.82;
  clock.traverse(mesh=>{if(!mesh.isMesh)return;mesh.material=mesh.material.clone();if(mesh.material.name!=='glass')return;
    mesh.geometry.computeBoundingBox();const box=mesh.geometry.boundingBox,center=box.getCenter(new THREE.Vector3()),size=box.getSize(new THREE.Vector3());
    mesh.material.color.set('#f5ead0');mesh.material.transparent=false;mesh.material.opacity=1;
    mesh.material.onBeforeCompile=shader=>{shader.uniforms.clockCenter={value:new THREE.Vector2(center.x,center.y)};shader.uniforms.clockScale={value:new THREE.Vector2(size.x*.5,size.y*.5)};shader.vertexShader='varying vec2 clockPosition;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\n clockPosition=position.xy;');shader.fragmentShader='varying vec2 clockPosition;uniform vec2 clockCenter,clockScale;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      vec2 cp=(clockPosition-clockCenter)/clockScale;float r=length(cp),angle=atan(cp.x,cp.y);float marks=(1.-smoothstep(.04,.10,abs(sin(angle*6.))))*smoothstep(.72,.77,r)*(1.-smoothstep(.87,.91,r));
      float minute=(1.-smoothstep(.035,.055,abs(cp.x)))*step(0.,cp.y)*(1.-step(.59,cp.y));vec2 hand=mat2(.707,-.707,.707,.707)*cp;float hour=(1.-smoothstep(.045,.07,abs(hand.x)))*step(0.,hand.y)*(1.-step(.39,hand.y));float centerDot=1.-smoothstep(.06,.1,r);
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.19,.26,.21),max(max(marks,minute),max(hour,centerDot)));
    `);};mesh.material.customProgramCacheKey=()=> 'icon-clock-dial-v1';
  });
  const porchLamp=put('lantern',1.0,1.65,.30,.27,.45,.29,0,front);lanterns.push(porchLamp);g.userData.lantern=porchLamp;
  for(const[x,y,z,power,range]of[[-1.6,1.85,-3.2,1.25,5],[2.5,1.6,-1.45,.8,3.7],[2.6,1.23,-4.6,.65,3.1]]){const l=new THREE.PointLight('#ffdb9c',power,range,1.5);l.position.set(x,y,z);g.add(l);lamps.push({light:l,power});}
  const fire=new THREE.PointLight('#ffc064',.55,3.2,1.8);fire.position.set(-2.6,.57,-.94);g.add(fire);
  const windowSun=new THREE.SpotLight('#ffe4b1',.8,6,.52,.85,1.4);windowSun.position.set(-3.0,2.2,-2.65);windowSun.target.position.set(-.4,.13,-2.2);g.add(windowSun,windowSun.target);
  [shell,front,roof,furnishing].forEach(batch);
  for(const part of [front,roof]){ownMaterials(part);part.traverse(m=>{if(m.isMesh){m.material.transparent=true;m.material.depthWrite=true;}});}
  let open=true,progress=1,cut=0,elapsed=0;
  if(hinge)hinge.rotation.y=-Math.PI*.48;
  const local=new THREE.Vector3(),worldPoint=new THREE.Vector3(),boxPoint=new THREE.Vector3();
  const localPoint=(x,z)=>{g.updateMatrixWorld();local.set(x,g.position.y,z);return g.worldToLocal(local);};
  const worldBox=b=>{g.updateMatrixWorld();const a=g.localToWorld(new THREE.Vector3(b.x0,b.baseY,b.z0)),v=g.localToWorld(new THREE.Vector3(b.x1,b.y,b.z1));return {...b,x0:a.x,x1:v.x,z0:a.z,z1:v.z,y:v.y,baseY:a.y};};
  const api={
    group:g, rooms:['living','kitchen','bedroom'],
    contains(x,z){const p=localPoint(x,z);return p.x>-half&&p.x<half&&p.z>-depth&&p.z<.10;},
    floorAt(x,z){return api.contains(x,z)?g.position.y+floorY*g.scale.y:null;},
    blocked(x,z,radius,feetY){const p=localPoint(x,z),r=radius/g.scale.x,feet=(feetY-g.position.y)/g.scale.y;for(const b of boxes){if(feet>=b.y-.04)continue;if(p.x>b.x0-r&&p.x<b.x1+r&&p.z>b.z0-r&&p.z<b.z1+r)return true;}return progress<.65&&Math.abs(p.x)<gap/2+r&&p.z>-.13-r&&p.z<.16+r&&feet<wallHeight;},
    get surfaces(){return localSurfaces.map(worldBox);},
    get door(){g.updateMatrixWorld();const p=g.localToWorld(new THREE.Vector3(0,floorY+1,.15));return {x:p.x,y:p.y,z:p.z};},
    get doorOpen(){return open;},get doorProgress(){return progress;},
    toggleDoor(){open=!open;return open;},
    update(dt,{cameraControl,night=0}={}){
      elapsed+=dt;progress+=(Number(open)-progress)*(1-Math.exp(-dt*cfg.doorSpeed));if(hinge)hinge.rotation.y=-Math.PI*.48*progress;
      const player=cameraControl?.player,inside=player&&api.contains(player.x,player.z);
      const snap=cameraControl?.snapshot?.(),focus=snap?.focus;
      const focused=!cameraControl?.isFirstPerson&&focus&&api.contains(focus[0],focus[2])&&(snap.distance??50)<cfg.cutawayDistance;
      const target=!cameraControl?.isFirstPerson&&(inside||focused)?1:0;cut+=(target-cut)*(1-Math.exp(-dt*4));
      for(const part of [roof,front]){part.visible=cut<.98;part.traverse(m=>{if(m.isMesh){m.material.opacity=1-cut;m.material.depthWrite=cut<.2;m.castShadow=cut<.5;}});}
      for(const l of lamps)l.light.intensity=l.power*(cfg.lightDay+(cfg.lightNight-cfg.lightDay)*night);
      fire.intensity=(.4+night*.4)*(1+Math.sin(elapsed*7.1)*.1+Math.sin(elapsed*13.2)*.05);windowSun.intensity=(1-night)*.75;
      g.userData.inside=!!inside;
    },
    snapshot(){return {doorOpen:open,doorProgress:progress,cutaway:cut,rooms:3,furniture:27,inside:g.userData.inside??false};}
  };
  g.userData.cottage=api;g.userData.depth=depth;
  return g;
}
