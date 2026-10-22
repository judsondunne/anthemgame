import * as S from '../sim/index.js';
import {createBareFarm} from '../game/first-start.js';
const ACTIONS=new Set(['buy','sellGood','sellAnimal','plant','plantBed','waterBed','harvest','harvestBed','feed','feedMany','waterAnimal','waterMany','collect','collectNear','place','clearBones','moveSlot','placeFence','moveFence','removeFence','toggleGate','callChickens','illuminate','scarePredator','petAnimal','changeDayNight']);
const packet=(record,extra={})=>({ok:true,shared:true,rev:record?.rev??0,doc:record?.doc??null,...extra});
const validAction=a=>a&&ACTIONS.has(a.name)&&Array.isArray(a.args)&&JSON.stringify(a.args).length<6000&&typeof a.id==='string'&&a.id.length<=120;
export async function sharedFarm({method='GET',body,now=Date.now()},store){
 if(!store)return{ok:false,shared:false,status:'unavailable'};
 if(!['GET','POST'].includes(method))return{ok:false,status:'method'};
 let msg=method==='GET'?null:body;
 if(typeof msg==='string'){if(msg.length>220000)return{ok:false,status:'size'};try{msg=JSON.parse(msg);}catch{return{ok:false,status:'invalid'};}}
 if(method==='POST'&&(!msg||!['start','action','actions'].includes(msg.type)))return{ok:false,status:'invalid'};
 const commands=msg?.type==='actions'?msg.actions:msg?.type==='action'?[msg]:[];
 if(!Array.isArray(commands)||commands.length>32||!commands.every(validAction))return{ok:false,status:'invalid'};
 for(let attempt=0;attempt<10;attempt++){
  const current=await store.read(),record=current?.data;
  if(!record&&method==='GET')return packet(null);
  if(commands.length&&record&&commands.every(a=>record.receipts?.includes(a.id)))return packet(record,{duplicate:true,result:{ok:true},results:commands.map(a=>({id:a.id,ok:true}))});
  let state;
  if(record){const loaded=S.loadObject(record.doc);if(!loaded.ok)return{ok:false,status:'corrupt'};state=loaded.state;state.predators=record.doc.predators??[];state.alerts=record.doc.alerts??[];}
  else{const seed=msg?.seed&&S.loadObject(msg.seed);state=seed?.ok&&seed.state.firstStartVersion===1?seed.state:createBareFarm();}
  // Recover the friend's previously local progress before this shared world is played.
  if(msg?.type==='start'&&record&&state.stats.spent===0&&state.stats.harvested===0&&state.animals.length===0&&state.buildings.length===0&&state.fences.length===0&&state.beds.every(b=>b.plots.every(p=>!p.crop))){const seed=msg.seed&&S.loadObject(msg.seed);if(seed?.ok&&seed.state.firstStartVersion===1&&seed.state.stats.spent>0)state=seed.state;}
  const elapsed=record?Math.max(0,(now-record.updatedAt)/1000):0;
  if(elapsed>30)S.catchUp(state,elapsed);else if(elapsed>0)S.tick(state,Math.min(elapsed,30));
  const results=[];
  for(const a of commands){
   if(record?.receipts?.includes(a.id)){results.push({id:a.id,ok:true});continue;}
   const previousMode=state.player.mode;if(a.name==='illuminate')state.player.mode='fp';
   results.push({id:a.id,...S[a.name](state,...a.args)});state.player.mode=previousMode;
  }
  const events=S.drainEvents(state);state.rev=(record?.rev??0)+1;state.savedAt=now;
  const next={rev:state.rev,updatedAt:now,doc:{...S.toDoc(state),predators:state.predators,alerts:state.alerts},receipts:[...(record?.receipts??[]),...commands.map(a=>a.id)].slice(-256)};
  // Clients see the current simulated world, but idle polling needn't write every frame.
  if(record&&method==='GET'&&elapsed<8){next.doc.rev=record.rev;return packet({...record,doc:next.doc});}
  if(await store.write(next,current?.etag??null))return packet(next,{result:results[0]??{ok:true},results,events});
 }
 return{ok:false,status:'busy',retry:true};
}
