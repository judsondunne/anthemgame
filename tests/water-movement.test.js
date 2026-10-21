import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BALANCE as B } from '../src/config/balance.js';
import { waterAtWorld, waterAtLogical, brookCenter, brookSurface, brookDrinkingPoint } from '../src/sim/water.js';
import { createPlayerGeometry } from '../src/game/surfaces.js';
import { canMove } from '../src/sim/movement.js';
import { stepLivestockWater } from '../src/sim/wandering.js';
import { nextTimeAtHour } from '../src/sim/clock.js';

test('water volumes have deep centres, shallow banks and dry edges', () => {
  const p=B.waterBodies.pond;
  assert.equal(waterAtWorld(p.x,p.z).depth,p.maxDepth);
  assert.ok(waterAtWorld(p.x+p.rx*.99,p.z).depth<.1);
  assert.equal(waterAtWorld(p.x+p.rx*1.01,p.z),null);
  const z=-5,w=waterAtWorld(brookCenter(z),z);
  assert.equal(w.kind,'brook');assert.equal(w.surface,brookSurface(z));assert.ok(w.depth>1.5);
  const point=brookDrinkingPoint(z);assert.equal(waterAtLogical(point.x,point.y).kind,'brook');
});
test('downloaded rock tops support jumping while blocking a grounded capsule', () => {
  const world={heightAt:()=>0,colliders:[{type:'rock',x:20,z:20,radius:.6,baseY:0,top:.82},{type:'tree',x:23,z:20,radius:.4}],brook:{crossing:{x:46,z:8}}};
  const g=createPlayerGeometry({world,scene:new THREE.Group(),getState:()=>({beds:[]})});
  assert.equal(g.blocked(20,20,.26,0),true);
  assert.equal(g.blocked(20,20,.26,.65),false);
  assert.equal(g.supportAt(20,20,.65),.82);
  assert.equal(g.supportAt(20,20,0),0,'waist-high object cannot be stepped onto from ground');
  assert.equal(g.blocked(23,20,.26,2),true,'tree remains solid above low objects');
});
test('large livestock can enter brook water; chickens and closed fences stop them', () => {
  const z=-5,p=brookDrinkingPoint(z),s={animals:[],buildings:[],beds:[],fences:[]};
  const a={id:1,sp:'cow',age:1,x:p.x-60,y:p.y};
  assert.equal(canMove(s,a,p.x,p.y),true);
  assert.equal(canMove(s,{...a,sp:'chicken'},p.x,p.y),false);
  s.fences=[{id:1,gx:Math.floor(p.x/40),gy:Math.floor(p.y/(40/1.65)),axis:'v',gate:false}];
  const f=s.fences[0],x=f.gx*40,y=(f.gy+.5)*40/1.65;
  assert.equal(canMove(s,{...a,x:x-30,y},x+30,y),false);
});
test('livestock water trips drink in the brook and stay inside ordinary pens', () => {
  const s={seed:1247,time:nextTimeAtHour(0,10),animals:[],buildings:[],beds:[],fences:[]};
  const a={id:19,sp:'cow',state:'alive',age:1,x:1900,y:650,thirst:80};s.animals=[a];
  const home={x:1900,y:650};
  assert.equal(stepLivestockWater(s,a,1,home,{id:'closed'}),false,'a pen without brook access uses its trough');
  const b={...a,id:20};s.animals=[b];stepLivestockWater(s,b,1,home,null);
  // Follow the deterministic trip until the animal has visibly reached water.
  for(let i=0;i<90;i++)stepLivestockWater(s,b,1,home,null);
  assert.ok(b.thirst<80,'the water visit actually restores thirst');
});
