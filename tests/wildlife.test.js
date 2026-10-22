import test from 'node:test';
import assert from 'node:assert/strict';
import { createWildlifeState } from '../src/game/wildlife-state.js';
import { BALANCE as B } from '../src/config/balance.js';
const context={origin:{x:43,z:-28},hour:12,canMove:()=>true,waterAt:()=>null,heightAt:()=>0};
test('ambient wildlife spawns deterministically from seed/time and respects quality caps',()=>{
  const a=createWildlifeState(81,0),b=createWildlifeState(81,0);
  assert.deepEqual(a.animals,b.animals);assert.ok(a.animals.some(a=>a.kind==='deer'));assert.ok(a.animals.some(a=>a.kind==='elk'));assert.ok(a.animals.some(a=>a.kind==='bunny'));
  assert.equal(a.update(.1,{...context,quality:'low'}).length,B.wildlife.lowCount);
  assert.ok(a.update(.1,{...context,quality:'high'}).length<=B.wildlife.highCount);
  assert.equal(a.update(.1,{...context,origin:{x:1000,z:1000}}).length,0);
});
test('wildlife flees both the player and predators using the configured speed',()=>{
  for(const threat of['player','predators']){
    const sim=createWildlifeState(81,0),a=sim.animals[0];a.x=43;a.z=-28;a.home={x:a.x,z:a.z};
    const near={x:44,z:-28},ctx={...context,[threat]:threat==='player'?near:[near]};
    sim.update(1,ctx);assert.equal(a.state,'flee');assert.ok(a.x<43);assert.ok(Math.abs(Math.hypot(a.x-43,a.z+28)-B.wildlife.fleeSpeed)<1e-6);
  }
});
test('movement obeys injected fences/solids and deer visit water at dawn',()=>{
  const sim=createWildlifeState(81,0),a=sim.animals.find(a=>a.kind==='deer');a.x=43;a.z=-28;a.home={x:a.x,z:a.z};a.decision=0;
  sim.update(1,{...context,hour:6,canMove:()=>false});assert.equal(a.x,43);assert.equal(a.z,-28);assert.equal(a.state,'drink');
  assert.ok(Number.isFinite(a.target.x)&&Number.isFinite(a.target.z));
  a.target={x:a.x,z:a.z};a.decision=1;
  sim.update(.1,{...context,hour:6,waterAt:()=>({surface:1,bottom:-1})});assert.equal(a.wet,true);assert.ok(a.y<1&&a.y>-1);
});
