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
 const g=new THREE.Group();
 const add=(name,opts,x,y,z,ry=0)=>{const o=model(name,opts);o.position.set(x,y,z);o.rotation.y=ry;g.add(o);return o;};
 const deck=add('planks',{width:3.9},0,.43,-1.1);deck.scale.z*=.66;
 for(const x of [-1.55,1.55])for(const z of [-2.1,-.2])add('pillar-wood',{height:.55},x,0,z);
 // Back and side planks: no cottage porch, chimney, windows or human front door.
 for(const x of [-.84,.84])piece('wall-wood',g,x,.46,-2.2,1.68,1.25,1.2,Math.PI/2,'#d7c2a0');
 for(const side of [-1,1])piece('wall-wood-half',g,side*1.64,.46,-1.3,1.8,1.4,1.8,side>0?0:Math.PI,'#d7c2a0');
 piece('roof-gable',g,0,1.66,-1.25,2.0,1.05,3.9,Math.PI/2,'#a0b0a0');
 for(const x of [-1.5,1.5])add('pillar-wood',{height:1.15},x,.46,-.15);
 const ramp=add('stairs-wood',{width:.93},0,0,.45,Math.PI/2);ramp.scale.y*=.45;ramp.scale.z*=1.2;
 for(const x of [-1.06,1.06]){const hay=add('hay-bale',{width:.72},x,.46,-1.55);hay.scale.y*=.55;}
 for(const x of [-1.36,-.45,.45,1.36])add('fence_simple',{width:.92},x,0,1.12);
 for(const x of [-1.8,1.8])add('fence_simple',{width:1.25},x,0,.57,Math.PI/2);
 // Low roost rails are original downloaded poles, never generated prop geometry.
 for(const z of [-.72,-1.35]){const rail=add('pillar-wood',{height:2.6},1.3,.65,z);rail.rotation.z=Math.PI/2;}
 const lamp=add('lantern',{height:.37},1.53,1.05,-.05);lanterns.push(lamp);g.userData.lantern=lamp;g.userData.depth=3.5;g.userData.coop=true;return g;
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
