import test from 'node:test';import assert from 'node:assert/strict';
import {S,B,fresh} from './helpers.js';
test('chickens automatically settle inside at dusk, close the door and emerge at dawn',()=>{
 const s=fresh();S.advanceToHour(s,18,{offline:true});S.tick(s,45);assert.ok(s.animals.every(a=>a.indoors));
 S.advanceToHour(s,21);assert.ok(s.animals.every(a=>a.sleeping&&S.chickenSheltered(s,a)));assert.equal(S.coopState(s).doorOpen,false);assert.equal(S.coopState(s).doorProgress,0);
 const copy=S.loadText(S.serialize(s));assert.ok(copy.ok);assert.ok(copy.state.animals.every(a=>a.indoors&&a.shelterRequested));
 S.advanceToHour(s,7);S.tick(s,40);assert.ok(s.animals.every(a=>!a.indoors&&!a.shelterRequested));
 assert.equal(S.coopState(s).doorOpen,true);assert.equal(S.coopState(s).doorProgress,1);
});
test('daylight coop call is refused without changing animals',()=>{const s=fresh();assert.equal(S.callChickensIn(s).reason,'daylight');assert.ok(s.animals.every(a=>!a.shelterRequested));});
test('species sized body collision stops buildings and separates overlapping livestock',()=>{
 const s=fresh();s.animals=[];const a=S.spawnAnimal(s,'cow','f'),b=S.spawnAnimal(s,'horse','f');a.x=600;a.y=700;b.x=610;b.y=700;
 for(let i=0;i<8;i++)S.separateAnimals(s);assert.ok(Math.hypot(a.x-b.x,(a.y-b.y)*1.65)>=B.animals.radius.cow+B.animals.radius.horse);
 a.x=470;a.y=550;assert.equal(S.canMove(s,a,480,530),false,'cow body cannot enter house edge');
});
test('the same downloaded tree/rock collider data blocks livestock without entering save documents',()=>{const s=fresh();s.animals=[];const a=S.spawnAnimal(s,'cow','f');a.x=550;a.y=700;S.setWorldColliders(s,[{x:600,y:700,r:25}]);assert.equal(S.canMove(s,a,590,700),false);assert.equal(S.canMove(s,a,540,700),true);assert.equal('worldCollision' in S.toDoc(s),false);});

test('legacy hens inside the solid coop footprint recover and resume daytime roaming',()=>{const s=fresh();for(const a of s.animals){a.x=320;a.y=800;a.indoors=false;}S.tick(s,1);for(const a of s.animals)assert.equal(S.groundBlocked(s,a.x,a.y,a),false);const before=s.animals.map(a=>({x:a.x,y:a.y}));S.tick(s,6);assert.ok(s.animals.some((a,i)=>Math.hypot(a.x-before[i].x,(a.y-before[i].y)*1.65)>15));});
test('dawn after fractional tick accumulation is daytime and clears danger',()=>{const s=fresh();s.time=1880.123456789;const t=S.clock.nextTimeAtHour(s.time,6);assert.equal(S.clock.isNightAt(t),false);});

test('chickens can leave and enter their coop again on consecutive days',()=>{const s=fresh();for(let day=0;day<3;day++){S.advanceToHour(s,19,{offline:true});S.callChickensIn(s);S.tick(s,55);assert.ok(s.animals.every(a=>a.indoors));S.advanceToHour(s,7,{offline:true});S.tick(s,45);assert.ok(s.animals.every(a=>!a.indoors&&!a.leavingCoop&&!a.enteringCoop));const before=s.animals.map(a=>({x:a.x,y:a.y}));S.tick(s,8);assert.ok(s.animals.some((a,i)=>Math.hypot(a.x-before[i].x,(a.y-before[i].y)*1.65)>10));}});

test('late hens can enter after dusk, capacity overflow roosts outside and eggs stay by nests',()=>{
 const s=fresh();for(let i=0;i<4;i++)S.spawnAnimal(s,'chicken','f');
 s.time=S.clock.nextTimeAtHour(0,21);s.predatorSchedule.lastNight=S.clock.dayIndex(s.time);
 for(const a of s.animals){a.x=330+(a.id%2)*32;a.y=910;}
 S.tick(s,90);
 assert.equal(s.animals.filter(a=>a.indoors).length,B.species.chicken.baseCapacity);
 assert.equal(s.animals.filter(a=>a.overflowRoost&&!a.indoors).length,2);
 assert.equal(S.coopState(s).doorOpen,false);
 assert.ok(s.pickups.filter(p=>p.kind==='egg').every(p=>p.nest&&p.coopId===null));
 const copy=S.loadText(S.serialize(s));assert.ok(copy.ok);assert.deepEqual(copy.state.coops,s.coops);
 assert.deepEqual(copy.state.animals.map(a=>a.indoors),s.animals.map(a=>a.indoors));
});

test('schema three migrates indoor residents and opens doors at dawn without losing the farm',()=>{
 const s=fresh();s.time=S.clock.nextTimeAtHour(0,22);s.animals[0].indoors=true;
 const old=S.toDoc(s);old.schemaVersion=3;delete old.coops;
 const back=S.loadObject(old);assert.ok(back.ok);assert.equal(back.state.schemaVersion,4);
 assert.equal(back.state.animals[0].indoors,true);assert.equal(S.coopState(back.state).doorOpen,false);
 assert.deepEqual(S.toDoc(S.loadText(S.serialize(back.state)).state),S.toDoc(back.state));
});

test('all sixteen housed hens reach their own roosts and every coop closes',()=>{
 const s=fresh();s.money=1e6;
 for(let i=0;i<2;i++){const at=S.layout.bestSpot(s,'coop');assert.ok(at);S.buy(s,'kit_coop');assert.ok(S.place(s,'kit_coop',at.gx,at.gy).ok);}
 while(S.buy(s,'animal_chicken_f').ok){}
 s.time=S.clock.nextTimeAtHour(0,18);S.tick(s,120);
 assert.equal(s.animals.length,16);assert.ok(s.animals.every(a=>a.indoors));
 assert.ok(Object.values(s.coops).every(c=>!c.doorOpen&&c.doorProgress===0));
});

test('legacy coop whose door was packed against the starter coop moves to a usable nearby slot',()=>{
 const s=fresh();s.buildings.push({id:s.nextId++,type:'coop',gx:6,gy:26});
 const doc=S.toDoc(s);doc.schemaVersion=3;delete doc.coops;
 const back=S.loadObject(doc);assert.ok(back.ok);assert.equal(back.state.buildings.length,1);assert.equal(back.state.money,s.money);
 const b=back.state.buildings[0];assert.ok(b.gx!==6||b.gy!==26);
 assert.ok(S.layout.checkPlacement({...back.state,buildings:[]},'coop',b.gx,b.gy).ok);
 assert.deepEqual(S.toDoc(S.loadText(S.serialize(back.state)).state),S.toDoc(back.state));
});
