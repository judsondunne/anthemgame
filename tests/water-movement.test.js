import test from 'node:test';
import assert from 'node:assert/strict';
import { BALANCE as B } from '../src/config/balance.js';
import { waterAtWorld, waterAtLogical, brookCenter, brookSurface, brookDrinkingPoint } from '../src/sim/water.js';
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
