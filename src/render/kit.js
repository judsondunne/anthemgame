// Kitbashed architecture. Every solid here is a downloaded Fantasy Town /
// Nature / Graveyard module; nothing is hand-modelled.
import * as THREE from "three";
import { model } from "../../assets.js";

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
function cottage(lanterns=[]){
 const g=new THREE.Group(),body=model('farm-cottage',{width:5.4,recolor:{Main:'#769184',Walls:'#c5c8ad',Stone:'#929888',Wood:'#947552',Wood_Light:'#b39a71'}});
 const size=new THREE.Box3().setFromObject(body).getSize(new THREE.Vector3());body.scale.z*=4.1/size.z;body.position.z=-2.05;g.add(body);
 for(const x of [-1.4,1.4])piece('wall-window-shutters',g,x,.28,-.42,.96,1.5,1.12,-Math.PI/2);
 piece('wall-door',g,0,.06,-.51,1.1,1.92,1.25,-Math.PI/2);
 for(let i=-1;i<=1;i++)piece('planks',g,i*1.7,.02,.65,1.7,.9,1.4);
 for(const x of [-2.25,2.25])piece('pillar-wood',g,x,.04,1.18,1.1,1.5,1.1);
 piece('roof-gable',g,0,1.5,.85,.82,.5,5.1,Math.PI/2);
 piece('stairs-wood',g,0,-.02,1.6,.55,.2,1.3,Math.PI/2);
 for(const x of [-1.75,1.75]){piece('balcony-wall-fence',g,x,.05,1.13,1,.65,1.1,-Math.PI/2);const pot=model('pot_small',{height:.34});pot.position.set(x,.67,1.21);g.add(pot);const plant=model('forest_flowers',{height:.48});plant.position.set(x,.92,1.21);g.add(plant);}
 const chimney=model('chimney',{height:1.05});chimney.position.set(1.2,2.65,-2.3);g.add(chimney);
 const lamp=model('lantern',{height:.45});lamp.position.set(1.82,1.2,.25);g.add(lamp);lanterns.push(lamp);g.userData.lantern=lamp;g.userData.depth=4.1;return g;
}
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
