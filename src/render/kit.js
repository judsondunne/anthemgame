// Kitbashed architecture. Every solid here is a downloaded Fantasy Town /
// Nature / Graveyard module; nothing is hand-modelled.
import * as THREE from "three";
import { model } from "../../assets.js";
import { createCottage } from "./cottage.js";

export function piece(name, parent, x, y, z, sx = 1, sy = sx, sz = sx, rot = 0, tint) {
  const o = model(name, { raw: true, tint });
  o.position.set(x, y, z);
  o.scale.set(sx, sy, sz);
  o.rotation.y = rot;
  parent.add(o);
  return o;
}

// Open-front raised henhouse. Downloaded timber, deck, roof and ramp modules
// expose the warm roost, so sleeping chickens remain visible from outside.
export function chickenCoop(lanterns=[]) {
 const g=new THREE.Group();g.name='Timber henhouse with nesting hatch';g.userData.dynamicArchitecture=true;
 const add=(name,opts,x,y,z,ry=0)=>{const o=model(name,opts);o.position.set(x,y,z);o.rotation.y=ry;g.add(o);return o;};
 // The original downloaded ChickenCoop supplies all planks, roof, feet, trims
 // and ramp geometry. Nesting and the moving hatch reuse downloaded modules.
 const body=add('farm-coop',{width:4.2,recolor:{White:'#e6dbc1',LightRed:'#c4ac84',DarkRed:'#a68d69',Brown:'#927957',RoofBlack:'#708b7c'}},0,0,-1.1);
 const nest=add('interior-bookcaseOpen',{width:1.36},-1.27,.42,-.49,Math.PI/2);nest.scale.y*=.45;nest.scale.z*=1.2;
 for(const z of [-.9,-.4]){const hay=add('hay-bale',{width:.48},-1.31,.48,z);hay.scale.y*=.35;}
 // A timber door with an authored hinge, scaled to a hen-sized hatch.
 const hatch=add('interior-doorwayFront',{height:.93},0,.39,.21);
 hatch.scale.x*=1.4;hatch.userData.hinged=true;
 const hinge=hatch.getObjectByName('door');
 const ramp=add('stairs-wood',{width:.92},0,0,.69,Math.PI/2);ramp.scale.y*=.55;ramp.scale.z*=1.18;
 for(const x of [-1.55,1.55]){const fence=add('fence_simple',{width:1.1},x,0,.8,Math.PI/2);fence.scale.y*=.75;}
 for(const x of [-.56,.56]){const rail=add('pillar-wood',{height:1.45},x,.58,-1.12);rail.rotation.z=Math.PI/2;}
 const lamp=add('lantern',{height:.36},1.43,1.17,-.01);lanterns.push(lamp);g.userData.lantern=lamp;
 g.userData.setDoorOpen=(open,progress=Number(open))=>{if(hinge)hinge.rotation.y=-Math.PI*.49*progress;g.userData.doorOpen=!!open;g.userData.doorProgress=progress;};
 g.userData.setDoorOpen(true,1);g.userData.depth=3.6;g.userData.coop=true;return g;
}

// Detailed source buildings retain their downloaded tiles, timber joints,
// bevels and planks. Existing downloaded porch/window modules keep the farm's
// familiar front entrance and warm, visible windows.
function cottage(lanterns=[]){return createCottage(lanterns);}
function livestockHouse(type,lanterns=[]){
 const g=new THREE.Group(),stable=type==='stable',body=model('farm-barn',{width:4.75,recolor:stable?{DarkRed:'#819985',LightRed:'#9eb09a',White:'#e1d9bb',Brown:'#977958',RoofBlack:'#62796d'}:{DarkRed:'#b67866',LightRed:'#d49b82',White:'#e3d9bd',Brown:'#967452',RoofBlack:'#5b6d65'}});
 const size=new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());body.scale.z*=3.8/size.z;body.position.z=-1.9;g.add(body);
 const lamp=model('lantern',{height:.43});lamp.position.set(1.7,1.2,.08);g.add(lamp);lanterns.push(lamp);g.userData.lantern=lamp;g.userData.depth=3.8;
 for(const[x,z]of[[-2.0,-.85],[1.9,-1.4]]){const hay=model('hay-bale',{width:.7});hay.position.set(x,.05,z);g.add(hay);}
 if(stable){for(const x of [-1.65,1.65]){const f=model('fence_simple',{width:1.3});f.position.set(x,0,.12);g.add(f);}}else{const cart=model('cart',{width:.8});cart.position.set(-2.2,0,-1.3);g.add(cart);}
 return g;
}
export function building({coop=false,barn=false}={},lanterns=[]){return coop?chickenCoop(lanterns):barn?livestockHouse('barn',lanterns):cottage(lanterns);}
export const BUILDINGS={
 coop(){const g=chickenCoop();g.scale.setScalar(.8);g.userData.baseScale=.8;return g;},
 barn(){return livestockHouse('barn');},
 stable(){return livestockHouse('stable');},
};

export function stall() {
  const g = new THREE.Group();
  const s = model("stall-red", { width: 2.2 });
  s.rotation.y = 0.12;
  g.add(s);
  for (const [x, z] of [
    [-0.55, 0.25],
    [0.05, 0.35],
  ]) {
    const crate = model("hay-bale", { width: 0.5 });
    crate.position.set(x + 1.25, 0, z);
    g.add(crate);
  }
  return g;
}
