// Ephemeral deterministic wildlife. No Three.js objects or save mutations.
import { BALANCE as B } from '../config/balance.js';
import { brookCenter, brookHalfWidth } from '../sim/water.js';
const random=seed=>{let s=seed>>>0;return()=>{s=(Math.imul(s,1664525)+1013904223)>>>0;return s/4294967296;};};
const dist=(a,b)=>Math.hypot(a.x-b.x,a.z-b.z);
// Habitat layout gives clearings, both brook banks and all four forest edges
// residents. Bunnies alone come to the garden's outer meadow.
const habitats=[[43,-28],[51,-31],[39,-23],[48,26],[-42,-26],[-43,27],[17,-29],[-18,29],[18,19],[-14,-20],[64,-45],[-62,45]];
export function createWildlifeState(seed,time=0) {
  const cfg=B.wildlife,rng=random(seed+Math.floor(time/cfg.seedEpochSeconds)),animals=[];
  for(let i=0;i<cfg.candidateCount;i++){
    const kind=i%4===3?'bunny':i%4===1?'elk':'deer',h=habitats[i%habitats.length],angle=rng()*Math.PI*2,radius=rng()*cfg.habitatRadius;
    const x=h[0]+Math.cos(angle)*radius,z=h[1]+Math.sin(angle)*radius;
    animals.push({id:i,kind,x,z,home:{x,z},heading:rng()*Math.PI*2,target:null,phase:rng()*Math.PI*2,decision:rng()*cfg.repathSeconds,state:'graze',moving:false,active:false,wet:false});
  }
  // Two quiet meadow visitors make bunnies discoverable at the farm boundary.
  for(const [i,x]of[[3,12],[7,-13]]){const a=animals[i];a.x=x;a.z=cfg.bunnyEdge;a.home={x:a.x,z:a.z};}
  function update(dt,{origin,player,predators=[],hour,quality='high',canMove,waterAt,heightAt}={}){
    const cap=quality==='low'?cfg.lowCount:cfg.highCount;
    const nearby=animals.filter(a=>dist(a,origin)<(a.active?cfg.despawnDistance:cfg.activeDistance)).sort((a,b)=>dist(a,origin)-dist(b,origin));
    const enabled=new Set(nearby.slice(0,cap));
    const drink=(hour>=cfg.drinkHours[0]&&hour<=cfg.drinkHours[1])||(hour>=cfg.drinkHours[2]&&hour<=cfg.drinkHours[3]);
    for(const a of animals){
      a.active=enabled.has(a);if(!a.active)continue;
      a.phase+=dt;a.decision-=dt;
      const threat=[...(player?[{...player,range:cfg.fleeDistance}]:[]),...predators.map(p=>({...p,range:cfg.predatorFleeDistance}))].filter(p=>dist(p,a)<p.range).sort((p,q)=>dist(p,a)-dist(q,a))[0];
      if(threat){const angle=Math.atan2(a.z-threat.z,a.x-threat.x);a.target={x:a.x+Math.cos(angle)*cfg.habitatRadius,z:a.z+Math.sin(angle)*cfg.habitatRadius};a.state='flee';a.decision=cfg.repathSeconds;}
      else if(a.decision<=0||!a.target){
        a.decision=cfg.repathSeconds*(.75+rng()*.5);
        if(drink&&a.kind!=='bunny'&&a.home.x>25){const z=a.home.z+Math.sin(a.phase*.14)*3;const bank=a.home.x<brookCenter(z)?-1:1;a.target={x:brookCenter(z)+bank*brookHalfWidth(z)*.72,z};a.state='drink';}
        else if(rng()<.4){a.target={x:a.x,z:a.z};a.state='graze';a.decision=cfg.grazeSeconds;}
        else{const angle=rng()*Math.PI*2,radius=rng()*cfg.habitatRadius;a.target={x:a.home.x+Math.cos(angle)*radius,z:a.home.z+Math.sin(angle)*radius};a.state='wander';}
      }
      const d=dist(a,a.target),speed=a.state==='flee'?cfg.fleeSpeed:cfg.wanderSpeed*(a.kind==='bunny'?1.2:1),amount=Math.min(d,speed*dt);
      a.moving=false;
      if(d>.1&&amount>0){const heading=Math.atan2(a.target.z-a.z,a.target.x-a.x),sign=a.id%2?1:-1;
        for(const turn of[0,sign*.65,-sign*.65,sign*1.3,-sign*1.3]){
          const x=a.x+Math.cos(heading+turn)*amount,z=a.z+Math.sin(heading+turn)*amount;
          if(!canMove(a,x,z))continue;a.x=x;a.z=z;a.heading=heading+turn;a.moving=true;break;
        }
        if(!a.moving)a.decision=0;
      }
      const water=waterAt(a.x,a.z);a.wet=!!water;
      a.y=water&&a.kind!=='bunny'?Math.max(water.bottom,water.surface-(a.kind==='elk'?.9:.68)):heightAt(a.x,a.z);
      a.drinking=a.state==='drink'&&d<.5;
      if(a.state==='flee'&&!threat&&d<.2)a.decision=0;
    }
    return animals.filter(a=>a.active);
  }
  return {animals,update};
}
