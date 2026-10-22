import * as S from '../sim/index.js';
export class SharedSession {
 constructor(game){
  this.game=game;this.enabled=false;this.pending=[];this.rev=-1;this.status='connecting';this.client=crypto.randomUUID();this.count=0;this.busy=false;
  try{for(const key of Object.keys(localStorage))if(key.startsWith('farm-action:'))this.pending.push(JSON.parse(localStorage.getItem(key)));}catch{}
  try{const baseline=JSON.parse(localStorage.getItem('farm-shared-confirmed-v1'));if(baseline)this.seed=baseline;}catch{}
  this.started=this.pending.length>0;
 }
 activate(){
  this.enabled=true;const p=this.game.persist;p.sync=false;p.sharedMode=true;p.leader=true;p.channel?.close();p.channel=null;this.game.following=false;
  // Local backups no longer elect a leader for the whole shared world.
  p.onReplace=()=>{};
 }
 async request(body){
  const encoded=body?JSON.stringify(body):undefined;
  const r=await fetch('/api/farm',{keepalive:!!encoded&&encoded.length<60000,method:body?'POST':'GET',cache:'no-store',headers:body?{'content-type':'application/json'}:{},body:encoded,signal:AbortSignal.timeout(10000)});
  if(!r.ok)throw Error('Shared farm unavailable');const data=await r.json();if(!data.ok)throw Error(data.status??'Shared farm unavailable');return data;
 }
 async load(){
  this.activate();this.localCandidate=S.toDoc(this.game.state);try{const data=await this.request();this.status='live';if(data.doc){const recover=this.localCandidate.firstStartVersion===1&&this.localCandidate.stats.spent>0&&data.doc.stats.spent===0;this.accept(data);if(recover)this.seed=this.localCandidate;this.ready=Promise.resolve(data);}return data;}catch{this.status='offline';return null;}
  finally{this.timer=setInterval(()=>this.pump(),1400);addEventListener('focus',()=>this.pump());}
 }
 accept(data){
  if(!data.doc||data.rev<this.rev)return;this.rev=data.rev;const loaded=S.loadObject(data.doc);if(!loaded.ok)return;
  const local=this.game.state,next=loaded.state;next.ui=local.ui;next.player=local.player;next.selectedSlot=local.selectedSlot;next.predators=data.doc.predators??[];next.alerts=data.doc.alerts??[];
  this.confirmed=structuredClone(next);try{localStorage.setItem('farm-shared-confirmed-v1',JSON.stringify(S.toDoc(this.confirmed)));}catch{}
  // Reapply only unacknowledged commands, never upload a stale farm snapshot.
  for(const a of this.pending){const fn=S[a.name];if(fn)fn(next,...a.args);}S.drainEvents(next);
  if(next.ui.movingFence&&!next.fences.some(f=>f.id===next.ui.movingFence))next.ui.movingFence=null;
  this.game.replace(next,'shared');this.game.persist.saveLocal(next,{now:true});this.status=this.pending.length?'syncing':'live';
  for(const event of data.events??[])if(['birth','petted'].includes(event.type))this.game.emit(event);
 }
 start(){
  if(!this.enabled)return;this.started=true;this.status='syncing';
  if(!this.seed||!this.pending.length&&!this.localCandidate?.stats.spent)this.seed=S.toDoc(this.confirmed??this.game.state);try{localStorage.setItem('farm-shared-confirmed-v1',JSON.stringify(this.seed));}catch{}
  this.ready=this.request({type:'start',seed:this.seed}).then(data=>{this.accept(data);return data;}).catch(()=>{this.status='offline';this.ready=null;});return this.ready;
 }
 enqueue(name,args){
  if(!this.enabled)return;
  if(name==='illuminate'){this.beam=(this.beam??0)+args[1];if(this.beam<.3)return;args=[args[0],this.beam,args[2]];this.beam=0;}
  const action={type:'action',name,args:structuredClone(args),id:this.client+':'+(++this.count)};
  this.pending.push(action);try{localStorage.setItem('farm-action:'+action.id,JSON.stringify(action));}catch{}
  this.status='syncing';this.pump();
 }
 async pump(){
  if(!this.enabled||this.busy||document.hidden&&!this.pending.length)return;this.busy=true;
  try{
   // Viewing an unstarted garden never consumes the first real player's start.
   if(!this.ready&&!this.started)return;if(!this.ready)this.start();await this.ready;
   while(this.pending.length){
    const batch=this.pending.slice(0,32),data=await this.request({type:'actions',actions:batch});this.pending.splice(0,batch.length);
    try{for(const action of batch)localStorage.removeItem('farm-action:'+action.id);}catch{}
    this.accept(data);for(const result of data.results??[])if(!result.ok)this.game.emit({type:'sharedRefused',reason:result.reason});
   }
   this.accept(await this.request());
  }catch{this.status='offline';}finally{this.busy=false;}
 }
}
