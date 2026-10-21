import test from 'node:test';import assert from 'node:assert/strict';
import {S,B,fresh} from './helpers.js';
test('chickens remain outside until the dusk coop button is used, then visibly settle inside',()=>{
 const s=fresh();S.advanceToHour(s,19,{offline:true});S.tick(s,15);assert.ok(s.animals.every(a=>!a.indoors));
 assert.ok(S.callChickensIn(s).ok);S.tick(s,50);assert.ok(s.animals.every(a=>a.indoors));
 const copy=S.loadText(S.serialize(s));assert.ok(copy.ok);assert.ok(copy.state.animals.every(a=>a.indoors&&a.shelterRequested));
 S.advanceToHour(s,7);S.tick(s,40);assert.ok(s.animals.every(a=>!a.indoors&&!a.shelterRequested));
});
test('daylight coop call is refused without changing animals',()=>{const s=fresh();assert.equal(S.callChickensIn(s).reason,'daylight');assert.ok(s.animals.every(a=>!a.shelterRequested));});
test('species sized body collision stops buildings and separates overlapping livestock',()=>{
 const s=fresh();s.animals=[];const a=S.spawnAnimal(s,'cow','f'),b=S.spawnAnimal(s,'horse','f');a.x=600;a.y=700;b.x=610;b.y=700;
 for(let i=0;i<8;i++)S.separateAnimals(s);assert.ok(Math.hypot(a.x-b.x,(a.y-b.y)*1.65)>=B.animals.radius.cow+B.animals.radius.horse);
 a.x=470;a.y=550;assert.equal(S.canMove(s,a,480,530),false,'cow body cannot enter house edge');
});
test('the same downloaded tree/rock collider data blocks livestock without entering save documents',()=>{const s=fresh();s.animals=[];const a=S.spawnAnimal(s,'cow','f');a.x=550;a.y=700;S.setWorldColliders(s,[{x:600,y:700,r:25}]);assert.equal(S.canMove(s,a,590,700),false);assert.equal(S.canMove(s,a,540,700),true);assert.equal('worldCollision' in S.toDoc(s),false);});
