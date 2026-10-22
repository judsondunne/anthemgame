// Shared logical-coordinate steering. Solid fences, buildings and deep pond
// water are respected by both livestock and predators.
import { BALANCE as B } from '../config/balance.js';
import { activeObstacles, hitObstacle, placedFootprints, cellRect, CELL_X, CELL_Y } from './layout.js';
import { fenceBlocked } from './fences.js';
import { coopEntryAllowed } from './shelter.js';
import { worldCollisionAt } from './world-collision.js';
import { WORLD } from '../config/world.js';
import { waterAtLogical } from './water.js';

export function deepWaterAt(x, y) {
  const wx = (x - 700) / 50, wz = (y - 650) * 1.65 / 50;
  const streamX = WORLD.brook.x + Math.sin(wz * 0.045) * WORLD.brook.meander + Math.sin(wz * 0.115) * 1.9;
  const halfWidth = WORLD.brook.halfWidth + 0.30 * Math.sin(wz * 0.09 + 2);
  return Math.abs(wz - WORLD.brook.crossingZ) > WORLD.brook.crossingHalfDepth && Math.abs(wx - streamX) < halfWidth;
}

export function groundBlocked(s, x, y, animal=null) {
  const radius=animal ? (B.animals.radius[animal.sp]??12)*(animal.age<1?.65:1) : 0;
  const coop=animal&&coopEntryAllowed(s,animal,x,y);
  const z = B.fences.bounds;
  if (x < z.gx0 * CELL_X || x > z.gx1 * CELL_X || y < z.gy0 * CELL_Y || y > z.gy1 * CELL_Y) return true;
  const canSwim = ['cow', 'horse', 'deer', 'elk'].includes(animal?.sp);
  if ((deepWaterAt(x, y) && !canSwim) || (animal?.sp === 'chicken' && waterAtLogical(x, y)) || worldCollisionAt(s,x,y,radius)) return true;
  if (activeObstacles(s).some(o => {
    if(o.kind==='path')return false;
    if(coop&&o.kind==='rect'&&o.x0===220&&coop.id===null)return false;
    if(o.kind==='rect')return x>o.x0-radius&&x<o.x1+radius&&y>o.y0-radius/1.65&&y<o.y1+radius/1.65;
    if(o.kind==='circle')return Math.hypot(x-o.x,(y-o.y)*1.65)<o.r+radius;
    return hitObstacle(o,x,y);
  })) return true;
  return placedFootprints(s).some(f => {
    if(coop&&f.id===coop.id)return false;
    const r = cellRect(f.gx, f.gy, f.w, f.h);
    return x > r.x0 - radius - 2 && x < r.x1 + radius + 2 && y > r.y0 - radius/1.65 - 2 && y < r.y1 + radius/1.65 + 2;
  });
}
export function canMove(s, a, x, y) {
  if (fenceBlocked(s, a.x, a.y, x, y)) return false;
  const n = Math.max(1, Math.ceil(Math.hypot(x - a.x, y - a.y) / 8));
  for (let i = 1; i <= n; i++) if (groundBlocked(s, a.x + (x - a.x) * i / n, a.y + (y - a.y) * i / n,a)) return false;
  return true;
}
export function moveToward(s, a, target, speed, h, { avoidAnimals = false } = {}) {
  const dx = target.x - a.x, dy = (target.y - a.y) * 1.65;
  const dist = Math.hypot(dx, dy), amount = Math.min(dist, Math.max(0, speed * h));
  if (dist < 0.001 || !amount) return false;
  const angle = Math.atan2(dy, dx);
  const side = a.id % 2 ? 1 : -1;
  for (const offset of [0, side * 0.65, -side * 0.65, side * 1.25, -side * 1.25, side * 1.8]) {
    const x = a.x + Math.cos(angle + offset) * amount, y = a.y + Math.sin(angle + offset) * amount / 1.65;
    if (!canMove(s, a, x, y)) continue;
    if (avoidAnimals && s.animals.some(q => q !== a && q.state === 'alive' && !q.indoors && Math.hypot(q.x - x, (q.y - y) * 1.65) < (B.animals.radius[q.sp]??12)*(q.age<1?.65:1)+(B.animals.radius[a.sp]??12)*(a.age<1?.65:1)+B.animals.separation)) continue;
    a.x = x; a.y = y; a.heading = angle + offset;
    return true;
  }
  return false;
}

export function separateAnimals(s){
 for(let pass=0;pass<2;pass++)for(let i=0;i<s.animals.length;i++)for(let j=i+1;j<s.animals.length;j++){
 const a=s.animals[i],b=s.animals[j];if(a.state!=='alive'||b.state!=='alive'||a.indoors||b.indoors)continue;
 const radius=q=>(B.animals.radius[q.sp]??12)*(q.age<1?.65:1),limit=radius(a)+radius(b)+B.animals.separation;
 let dx=b.x-a.x,dy=(b.y-a.y)*1.65,d=Math.hypot(dx,dy);if(d>=limit)continue;if(d<.001){dx=a.id%2?1:-1;dy=.35;d=Math.hypot(dx,dy);}const push=(limit-d)*.52;
 for(const[q,sign]of[[a,-1],[b,1]]){const x=q.x+sign*dx/d*push,y=q.y+sign*dy/d*push/1.65;if(canMove(s,q,x,y)){q.x=x;q.y=y;}}
 }
}

// Old saves and newly placed colliders may contain a body inside solid ground.
// Find the nearest clear, same-pen point once instead of trapping it forever.
export function recoverAnimal(s,a){
 if(!groundBlocked(s,a.x,a.y,a))return false;
 const origin={x:a.x,y:a.y};
 for(let ring=1;ring<=32;ring++)for(let i=0;i<24;i++){const angle=i*Math.PI/12,x=origin.x+Math.cos(angle)*ring*8,y=origin.y+Math.sin(angle)*ring*8/1.65;
  if(groundBlocked(s,x,y,a)||fenceBlocked(s,origin.x,origin.y,x,y))continue;
  if(s.animals.some(q=>q!==a&&q.state==='alive'&&!q.indoors&&Math.hypot(q.x-x,(q.y-y)*1.65)<(B.animals.radius[q.sp]??12)+(B.animals.radius[a.sp]??12)+B.animals.separation))continue;
  a.x=x;a.y=y;a.heading=angle;return true;
 }return false;
}

// Short local A* routes let a called bird go around the coop and nearby pots,
// instead of repeatedly steering into a narrow blocked corner. Route caches
// are transient; only deterministic positions belong in the save document.
const routes=new WeakMap();
function localRoute(s,a,target){
 const step=B.movement.routeStep,origin={x:a.x,y:a.y},nodes=new Map(),heap=[];
 const key=(x,y)=>`${x},${y}`,point=(x,y)=>({x:origin.x+x*step,y:origin.y+y*step/1.65});
 const heuristic=(x,y)=>Math.hypot(origin.x+x*step-target.x,(origin.y+y*step/1.65-target.y)*1.65)/step;
 const push=n=>{heap.push(n);let i=heap.length-1;while(i){const p=(i-1)>>1;if(heap[p].f<=n.f)break;heap[i]=heap[p];i=p;}heap[i]=n;};
 const pop=()=>{const n=heap[0],last=heap.pop();if(heap.length){let i=0;while(i*2+1<heap.length){let c=i*2+1;if(c+1<heap.length&&heap[c+1].f<heap[c].f)c++;if(heap[c].f>=last.f)break;heap[i]=heap[c];i=c;}heap[i]=last;}return n;};
 const passable=new Map();const free=(x,y)=>{const k=key(x,y);if(!passable.has(k)){const p=point(x,y);passable.set(k,!groundBlocked(s,p.x,p.y,a));}return passable.get(k);};
 const start={x:0,y:0,g:0,f:heuristic(0,0),parent:null};nodes.set('0,0',start);push(start);
 let goal=null,best=start,visited=0,complete=false;
 while(heap.length&&visited++<B.movement.routeNodes){const n=pop();if(n.closed)continue;n.closed=true;if(heuristic(n.x,n.y)<heuristic(best.x,best.y))best=n;const from=point(n.x,n.y);if(heuristic(n.x,n.y)<1.25&&canMove(s,{...a,...from},target.x,target.y)){goal=n;complete=true;break;}
  for(const[dx,dy]of[[1,0],[0,1],[-1,0],[0,-1],[1,1],[-1,1],[-1,-1],[1,-1]]){const x=n.x+dx,y=n.y+dy;if(Math.abs(x)>B.movement.routeWindow||Math.abs(y)>B.movement.routeWindow)continue;const k=key(x,y),old=nodes.get(k),g=n.g+Math.hypot(dx,dy);if(old&&(old.closed||old.g<=g))continue;const to=point(x,y);if(!free(x,y)||(dx&&dy&&(!free(n.x+dx,n.y)||!free(n.x,n.y+dy)))||fenceBlocked(s,from.x,from.y,to.x,to.y))continue;const v={x,y,g,f:g+heuristic(x,y),parent:n};nodes.set(k,v);push(v);}
 }
 if(!goal&&heuristic(best.x,best.y)<heuristic(0,0)-1)goal=best;
 if(!goal)return null;const path=complete?[target]:[];while(goal?.parent){path.push(point(goal.x,goal.y));goal=goal.parent;}return path.reverse();
}
export function navigateToward(s,a,target,speed,h,options={}){
 const key=`${target.x.toFixed(1)},${target.y.toFixed(1)},${s.fences?.length},${s.buildings?.length},${!!a.enteringCoop}`;let route=routes.get(a);
 if(route?.key!==key){route={key,path:null,blocked:0,attempted:false,bestDistance:Infinity,stagnant:0};routes.set(a,route);}
 const distance=Math.hypot(a.x-target.x,(a.y-target.y)*1.65);
 if(distance<route.bestDistance-1){route.bestDistance=distance;route.stagnant=0;}else route.stagnant+=h;
 // Side steering can oscillate forever while still reporting movement. Route
 // around the obstruction when it stops making progress toward the entrance.
 if(route.stagnant>B.movement.routeStuckSeconds){route.path=localRoute(s,a,target);route.stagnant=0;route.attempted=true;}
 while(route.path?.length&&Math.hypot(a.x-route.path[0].x,(a.y-route.path[0].y)*1.65)<8)route.path.shift();
 const waypoint=route.path?.[0]??target;
 if(moveToward(s,a,waypoint,speed,h,options)){route.blocked=0;return true;}
 route.blocked+=h;
 if(!route.attempted||route.blocked>5){route.path=localRoute(s,a,target);route.blocked=0;route.attempted=true;if(route.path?.length)return moveToward(s,a,route.path[0],speed,h,options);}
 return false;
}
