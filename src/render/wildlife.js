// Three.js views consume the independent ambient wildlife state machine.
import * as THREE from 'three';
import { model, play, batchFlatRig } from '../../assets.js';
import { createWildlifeState } from '../game/wildlife-state.js';
import { BALANCE as B } from '../config/balance.js';
import { waterAtWorld } from '../sim/water.js';
import { fenceBlocked, penAt } from '../sim/fences.js';
import { OBSTACLES, placedFootprints, cellRect } from '../sim/layout.js';
const logical=(x,z)=>({x:x*50+700,y:z*50/1.65+650});
export function createWildlife({scene,cameraControl,world,game,getQuality=()=> 'high',onWater}){
  const group=new THREE.Group();group.name='Quiet woodland wildlife';scene.add(group);
  const state=createWildlifeState(game.state.seed,game.state.time),views=new Map();let accumulator=0,elapsed=0;
  function canMove(a,x,z){
    if(Math.abs(x)>B.world.radius-4||Math.abs(z)>B.world.radius-4)return false;
    const radius=B.wildlife.radii[a.kind];
    if(world.isBlocked(x,z,radius,world.heightAt(x,z)))return false;
    if(a.kind==='bunny'&&waterAtWorld(x,z))return false;
    const p=logical(x,z),from=logical(a.x,a.z),s=game.state;
    if(fenceBlocked(s,from.x,from.y,p.x,p.y)||penAt(s,p.x,p.y))return false;
    // Farm buildings, planted beds and pond are not wildlife routes.
    for(const o of OBSTACLES){if(o.kind==='rect'&&p.x>o.x0-15&&p.x<o.x1+15&&p.y>o.y0-10&&p.y<o.y1+10)return false;if(o.kind==='ellipse'&&Math.hypot((p.x-o.x)/o.rx,(p.y-o.y)/o.ry)<1.05)return false;}
    for(const f of placedFootprints(s)){const r=cellRect(f.gx,f.gy,f.w,f.h);if(p.x>r.x0-12&&p.x<r.x1+12&&p.y>r.y0-8&&p.y<r.y1+8)return false;}
    return true;
  }
  // Recover seeded spawn points that land on a trunk, rock or player pen.
  for(const a of state.animals)if(!canMove(a,a.x,a.z))for(let ring=1;ring<12;ring++){let found=false;for(let i=0;i<12;i++){const x=a.home.x+Math.cos(i*Math.PI/6)*ring,z=a.home.z+Math.sin(i*Math.PI/6)*ring;if(canMove(a,x,z)){a.x=x;a.z=z;a.home={x,z};found=true;break;}}if(found)break;}
  function update(dt){
    accumulator+=dt;if(accumulator<1/B.wildlife.activeHz&&dt>0)return;
    const step=accumulator;accumulator=0;elapsed+=step;
    const snap=cameraControl.snapshot(),player=cameraControl.isFirstPerson?{x:cameraControl.player.x,z:cameraControl.player.z}:null,origin=player??{x:snap.focus[0],z:snap.focus[2]};
    const active=state.update(step,{origin,player,predators:game.state.predators.map(p=>({x:(p.x-700)/50,z:(p.y-650)*1.65/50})),hour:game.clock.hour,quality:getQuality(),canMove,waterAt:waterAtWorld,heightAt:world.heightAt});
    const ids=new Set(active.map(a=>a.id));
    for(const[id,o]of views)if(!ids.has(id)){o.userData.mixer?.stopAllAction();o.removeFromParent();views.delete(id);}
    for(const a of active){let o=views.get(a.id);if(!o){o=model('wild-'+a.kind,{height:B.wildlife.modelHeight[a.kind],tint:a.kind==='bunny'?'#e7d6b9':a.kind==='elk'?'#d9c3a0':'#e4cfad'});if(a.kind!=='bunny')batchFlatRig(o);group.add(o);views.set(a.id,o);}
      o.position.set(a.x,a.y+(a.kind==='bunny'&&a.moving?Math.max(0,Math.sin(a.phase*12))*B.wildlife.hopHeight:0),a.z);
      const heading=Math.PI/2-a.heading;o.rotation.y+=Math.atan2(Math.sin(heading-o.rotation.y),Math.cos(heading-o.rotation.y))*(1-Math.exp(-step*6));
      play(o,a.moving?(a.state==='flee'?(a.kind==='bunny'?'run':'gallop'):'walk'):a.kind==='bunny'?'eat':a.state==='graze'||a.drinking?'eating':'idle');
      o.userData.mixer?.update(step);o.traverse(m=>{if(m.isMesh)m.castShadow=getQuality()!=='low';});
      if(a.wet&&(!o.userData.wasWet||elapsed-(o.userData.lastRipple??0)>B.movement.rippleInterval*2)){const water=waterAtWorld(a.x,a.z);if(water)onWater?.(a.x,a.z,water.surface,!o.userData.wasWet);o.userData.lastRipple=elapsed;}
      o.userData.wasWet=a.wet;
    }
  }
  update(0);
  return {group,update,views,state,snapshot(){return {active:views.size,cap:getQuality()==='low'?B.wildlife.lowCount:B.wildlife.highCount,animals:state.animals.filter(a=>a.active).map(({id,kind,x,y,z,state,wet,moving})=>({id,kind,x,y,z,state,wet,moving}))};}};
}
