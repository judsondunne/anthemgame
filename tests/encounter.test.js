import test from 'node:test';
import assert from 'node:assert/strict';
import { encounterAt } from '../src/game/encounter.js';
import { NIGHT } from '../src/config/night.js';
test('suspense flickers twice then waits two REAL seconds before a short lunge',()=>{
 assert.equal(encounterAt(.10).light,.035);assert.equal(encounterAt(.2).light,1);assert.equal(encounterAt(.32).light,.035);
 assert.equal(encounterAt(NIGHT.suspense.flickerSeconds).phase,'waiting');
 assert.equal(encounterAt(NIGHT.suspense.flickerSeconds+1.999).phase,'waiting');
 assert.equal(encounterAt(NIGHT.suspense.flickerSeconds+2.01).phase,'lunge');
 assert.equal(encounterAt(3).phase,'recover');assert.equal(encounterAt(4).done,true);
});
test('ordinary encounter skips flicker and lunge and retreats immediately',()=>{
 assert.deepEqual(encounterAt(0,false),{phase:'retreat',light:1,lunge:0,done:true});
});
