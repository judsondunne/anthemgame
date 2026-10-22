// A versioned, per-device fresh start. Previewing/loading never consumes it.
import {createState,serialize,loadText} from '../sim/index.js';
export const FIRST_START_KEY='classic-garden-first-player-v1';
export function createBareFarm(){
  const s=createState();
  s.animals=[];s.buildings=[];s.pickups=[];s.fences=[];
  s.inv={};s.slots=s.slots.map(v=>v&&['hand','can','fish','flashlight'].includes(v.key)?v:null);
  s.beds.forEach(b=>b.plots=b.plots.map(()=>({crop:null,g:0,w:0})));
  s.starterCoop=false;s.firstStartVersion=1;
  // 400 coop + 60 hen + 50 rooster leaves 490 for flowers and feed.
  s.money=1000;
  return s;
}
export function prepareFirstStart(game,storage){
  const get=k=>{try{return storage.getItem(k);}catch{return null;}};
  if(game.state.firstStartVersion===1)return {pending:false,commit:()=>true};
  const previous=serialize(game.state),preview=createBareFarm();
  game.state=preview;
  game.persist.suspended=true;
  let pending=true;
  return {get pending(){return pending;},commit(event){
    if(!pending)return true;
    if(!event?.isTrusted)return false;
    game.takeOver?.();
    // Another real tab may already have started while this welcome was open.
    if(get(FIRST_START_KEY)==='1'){
      const saved=loadText(get('farm-save-v2')??'');
      if(saved.ok&&saved.state.firstStartVersion===1){game.replace(saved.state,'first-start-other-tab');game.persist.suspended=false;pending=false;return true;}
    }
    try{storage.setItem('farm-save-before-fresh-start-v1',previous);storage.removeItem('farm-tutorial-v3');}catch{}
    game.replace(createBareFarm(),'first-player-start');
    game.persist.noteAction();
    game.persist.suspended=false;
    if(!game.persist.saveLocal(game.state,{now:true})){game.persist.suspended=true;return false;}
    try{storage.setItem(FIRST_START_KEY,'1');}catch{}
    pending=false;return true;
  }};
}
