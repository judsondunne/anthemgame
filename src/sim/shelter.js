import { BALANCE as B } from '../config/balance.js';
import { housing } from './sim.js';
import { BASE_COOP, frontOf, footprintOf, cellRect } from './layout.js';
import { moveToward, navigateToward } from './movement.js';
import { isNightAt, hourAt } from './clock.js';
export function coopFor(s,a,homes=housing(s).homes){const b=homes.get(a.id);if(b?.type==='coop'){const f=frontOf(b);return {id:b.id,x:f.x,y:f.y,door:{x:f.x,y:f.y+8},rect:cellRect(b.gx,b.gy,...footprintOf('coop'))};}return {id:null,x:BASE_COOP.x,y:BASE_COOP.y,door:{x:BASE_COOP.x,y:BASE_COOP.y+12},rect:{x0:220,x1:458,y0:728,y1:866}};}
export function callChickensIn(s){const hour=hourAt(s.time);if(hour< B.coop.callHour && hour>=B.time.dawnHour)return {ok:false,reason:'daylight'};let n=0;for(const a of s.animals)if(a.sp==='chicken'&&a.state==='alive'){a.shelterRequested=true;n++;}s.events.push({type:'coopCall',count:n});return {ok:true,count:n};}
export function coopEntryAllowed(s,a,x,y){if(a.sp!=='chicken'||(!a.shelterRequested&&!a.indoors&&!a.leavingCoop))return null;const c=coopFor(s,a);if(!a.enteringCoop&&!a.indoors&&!a.leavingCoop&&(Math.abs(x-c.door.x)>22||y<c.door.y-12))return null;if(x<c.rect.x0-5||x>c.rect.x1+5||y<c.rect.y0-5||y>c.rect.y1+5)return null;return c;}
export function stepShelter(s,a,h,homes){if(a.sp!=='chicken')return false;const c=coopFor(s,a,homes),night=isNightAt(s.time),hour=hourAt(s.time);if(hour>=6&&hour< B.coop.callHour){a.enteringCoop=false;if(a.indoors){a.indoors=false;a.leavingCoop=true;}a.shelterRequested=false;if(a.leavingCoop){navigateToward(s,a,{x:c.door.x,y:c.door.y+42},B.coop.runSpeed,h,{avoidAnimals:true});if(a.y>c.door.y+30)a.leavingCoop=false;return true;}return false;}if(!a.shelterRequested&&!a.indoors)return false;
 const residents=s.animals.filter(q=>q.sp==='chicken'&&q.state==='alive'&&coopFor(s,q,homes).id===c.id).sort((p,q)=>p.id-q.id),slot=residents.findIndex(q=>q.id===a.id);const roost={x:c.x+((slot%3)-1)*B.coop.roostSpacing,y:c.y-23-Math.floor(slot/3)*B.coop.rowSpacing};
 const doorDistance=Math.hypot(a.x-c.door.x,(a.y-c.door.y)*1.65);if(!a.enteringCoop&&doorDistance<B.coop.doorRadius)a.enteringCoop=true;const target=a.enteringCoop?roost:Math.abs(a.x-c.door.x)>22?{x:c.door.x,y:c.rect.y1+24}:c.door;
 if(a.indoors)return true;navigateToward(s,a,target,B.coop.runSpeed,h,{avoidAnimals:true});if(a.enteringCoop&&Math.hypot(a.x-roost.x,(a.y-roost.y)*1.65)<4){a.indoors=true;a.x=roost.x;a.y=roost.y;}return true;
}
