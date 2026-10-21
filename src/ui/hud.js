import { ICONS, TOOL_ICONS, itemIcon, cursorFor } from './icons.js';
import { NIGHT_ICONS as N } from './night-icons.js';
import { fmt } from './juice.js';
import { GOODS, selectSlot as simSelectSlot, syncInventory } from '../sim/index.js';
import { BALANCE as B } from '../config/balance.js';
export const isTool = k => ['hand','can','fish','flashlight'].includes(k);
export const isGood = k => GOODS.includes(k) && k !== 'hay';
export const slotKeys = s => (s.slots ?? []).slice(0,10).map(v => v?.key ?? 'empty');
const icon = k => TOOL_ICONS[k] ?? itemIcon(k);

export function createHud({game,audio,onSelect,onShop,onConfirm,onCancel,onMode,onHelp,onFlashlight}) {
  const root = document.documentElement.style;
  root.setProperty('--coin-pop', B.ui.coinPopMs+'ms');
  root.setProperty('--shake', B.ui.shakeMs+'ms');
  root.setProperty('--flourish', B.ui.flourishMs+'ms');
  const hud = document.createElement('div');
  hud.id='hud';
  hud.innerHTML=`<div class="pill money glass"><span class="ico">${ICONS.coin}</span><span class="num"></span></div><div class="pill dial glass" aria-hidden="true"><svg class="ring" viewBox="0 0 40 40"><circle cx="20" cy="20" r="17" fill="none" stroke="rgba(107,91,69,.16)" stroke-width="3"/><circle class="arc" cx="20" cy="20" r="17" fill="none" stroke="#e3bf73" stroke-width="3" stroke-linecap="round" stroke-dasharray="106.8"/></svg><span class="ico"></span></div><div class="spacer"></div><button class="roundbtn glass help" aria-label="Tutorial">${N.help}</button><button class="roundbtn glass mute" aria-label="Sound">${ICONS.speaker}</button>`;
  document.body.append(hud);
  const moneyEl=hud.querySelector('.money'), numEl=hud.querySelector('.num'), dialEl=hud.querySelector('.dial'), arcEl=hud.querySelector('.arc'), dialIcon=dialEl.querySelector('.ico'), mute=hud.querySelector('.mute');
  mute.onclick=()=>{audio.start?.().catch?.(()=>{});audio.toggle();mute.innerHTML=audio.muted?ICONS.muted:ICONS.speaker;};
  hud.querySelector('.help').onclick=()=>onHelp?.();
  const bar=document.createElement('div');bar.id='toolbar';bar.className='glass';
  bar.innerHTML=`<div class="slots" role="toolbar" aria-label="Hotbar"></div><span class="divider"></span><div class="toolbar-actions"><button class="shopbtn bagbtn" aria-label="Inventory">${N.bag}</button><button class="shopbtn marketbtn" aria-label="Market">${ICONS.stall}</button><button class="shopbtn modebtn" aria-label="First person" aria-pressed="false">${N.eye}</button></div>`;
  document.body.append(bar);
  const slotsEl=bar.querySelector('.slots'), shopBtn=bar.querySelector('.marketbtn'), modeBtn=bar.querySelector('.modebtn');
  shopBtn.onclick=e=>{e.stopPropagation();onShop();};modeBtn.onclick=e=>{e.preventDefault();e.stopPropagation();onMode?.();};
  const veil=document.createElement('div');veil.id='inventory-veil';veil.hidden=true;
  const backpack=document.createElement('div');backpack.id='backpack';backpack.className='glass';backpack.hidden=true;backpack.setAttribute('role','dialog');backpack.setAttribute('aria-label','Inventory');backpack.setAttribute('aria-modal','true');
  backpack.innerHTML=`<div class="backpack-head"><span class="ico">${N.bag}</span><span class="inventory-capacity"></span><button class="roundbtn" aria-label="Close">${ICONS.close}</button></div><div class="backpack-grid"></div>`;
  document.body.append(veil,backpack);
  let inventoryOpen=false;
  function toggleInventory(force){inventoryOpen=typeof force==='boolean'?force:!inventoryOpen;backpack.hidden=veil.hidden=!inventoryOpen;bar.classList.toggle('inventory-open',inventoryOpen);if(inventoryOpen)document.exitPointerLock?.();renderSlots();}
  bar.querySelector('.bagbtn').onclick=()=>toggleInventory();veil.onclick=()=>toggleInventory(false);backpack.querySelector('button').onclick=()=>toggleInventory(false);
  const place=document.createElement('div');place.id='placement';place.hidden=true;place.innerHTML=`<button class="no" aria-label="Cancel">${ICONS.close}</button><button class="ok" aria-label="Place">${ICONS.check}</button>`;document.body.append(place);
  const okBtn=place.querySelector('.ok');place.querySelector('.no').onclick=()=>onCancel();okBtn.onclick=()=>onConfirm();
  const fenceBar=document.createElement('div');fenceBar.id='fence-controls';fenceBar.className='glass';fenceBar.hidden=true;fenceBar.innerHTML=`<span class="ico">${N.fence}</span><span class="fence-count"></span><button class="roundbtn rotate" aria-label="Rotate fence">${N.rotate}</button><button class="roundbtn erase" aria-label="Remove fence" aria-pressed="false">${N.erase}</button>`;document.body.append(fenceBar);
  fenceBar.querySelector('.rotate').onclick=()=>{game.state.ui.fenceAxis=game.state.ui.fenceAxis==='v'?'h':'v';};
  fenceBar.querySelector('.erase').onclick=()=>{game.state.ui.fenceDelete=!game.state.ui.fenceDelete;};
  const els=[];
  for(let i=0;i<74;i++){
    const b=document.createElement('button');b.className='slot';b.dataset.index=i;b.setAttribute('aria-label',`Slot ${i+1}`);
    (i<10?slotsEl:backpack.querySelector('.backpack-grid')).append(b);els.push(b);
  }
  let lastCursor='',shownMoney=null,drag=null,ghost=null,longTimer=null,lastSlotsAt=0,lastMode=null,lastMoney='',lastFenceState='';
  function selected(){return game.state.slots?.[game.state.selectedSlot??0]?.key??'empty';}
  function selectSlot(index,notify=false){if(index<0||index>=10)return;simSelectSlot(game.state,index);game.state.ui.tool=selected();if(notify)onSelect?.(selected(),index);renderSlots();}
  function select(k){const i=game.state.slots?.findIndex(v=>v?.key===k)??-1;if(i>=0){simSelectSlot(game.state,i);game.state.ui.tool=k;}else if(k==='empty'){const j=game.state.slots.slice(0,10).findIndex(v=>!v);if(j>=0)simSelectSlot(game.state,j);}renderSlots();}
  function cycle(d){selectSlot(((game.state.selectedSlot??0)+(d>0?1:-1)+10)%10,true);}
  function renderSlots(){
    const s=game.state;syncInventory(s);
    els.forEach((b,i)=>{const v=s.slots[i],key=v?.key??'empty',sig=key+':'+(v?.n??0);if(b.dataset.sig!==sig){b.dataset.sig=sig;b.dataset.key=key;b.innerHTML=(v?icon(key):'')+(i<10?`<span class="slot-number">${(i+1)%10}</span>`:'')+(v&&!isTool(key)?`<span class="badge">${v.n}</span>`:'');}b.classList.toggle('selected',i===s.selectedSlot);b.setAttribute('aria-pressed',String(i===s.selectedSlot));b.classList.toggle('empty',!v);b.classList.toggle('kit',!!v?.key.startsWith('kit_'));});
    const k=selected();if(lastCursor!==k){lastCursor=k;const canvas=document.querySelector('canvas');if(canvas)canvas.style.cursor=k==='empty'?'default':cursorFor(k);}
    backpack.querySelector('.inventory-capacity').textContent=`${s.slots.slice(10).filter(Boolean).length}/64`;
  }
  function clearDrag(){clearTimeout(longTimer);longTimer=null;ghost?.remove();ghost=null;els.forEach(e=>e.classList.remove('drag-source','drop-target'));drag=null;}
  function start(e){if(e.button!==0&&e.button!==2)return;const b=e.target.closest('.slot');if(!b)return;const index=Number(b.dataset.index),v=game.state.slots[index];drag={index,x:e.clientX,y:e.clientY,split:e.button===2,quick:e.shiftKey,moved:false,key:v?.key,touchScroll:e.pointerType==='touch'&&!inventoryOpen&&index<10,scroll:slotsEl.scrollLeft};if(v)longTimer=setTimeout(()=>{if(drag){drag.split=true;b.classList.add('split-ready');}},B.ui.inventoryHoldMs);e.preventDefault();}
  function move(e){if(!drag)return;const d=Math.hypot(e.clientX-drag.x,e.clientY-drag.y);if(drag.touchScroll){if(d>B.ui.inventoryDragPixels){drag.moved=true;clearTimeout(longTimer);slotsEl.scrollLeft=drag.scroll-(e.clientX-drag.x);e.preventDefault();}return;}if(d>B.ui.inventoryDragPixels&&!drag.moved&&drag.key){drag.moved=true;clearTimeout(longTimer);ghost=document.createElement('div');ghost.id='inventory-drag';ghost.innerHTML=icon(drag.key)+(drag.split?'<span>½</span>':'');document.body.append(ghost);els[drag.index].classList.add('drag-source');}if(ghost){ghost.style.left=e.clientX+'px';ghost.style.top=e.clientY+'px';const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.slot');els.forEach(el=>el.classList.toggle('drop-target',el===target));}if(drag.moved)e.preventDefault();}
  function end(e){if(!drag)return;const d=drag;const target=document.elementFromPoint(e.clientX,e.clientY)?.closest('.slot');clearTimeout(longTimer);els.forEach(el=>el.classList.remove('split-ready'));if(d.moved&&d.touchScroll){clearDrag();renderSlots();return;}if(d.moved&&target){const r=game.act('moveSlot',d.index,Number(target.dataset.index),{split:d.split});if(!r.ok)els[d.index].animate([{transform:'translateX(-3px)'},{transform:'translateX(3px)'},{transform:'none'}],{duration:200});}else if(!d.moved){if(d.quick&&d.key){game.act('moveSlot',d.index,d.index,{quick:true});}else if(d.index<10){selectSlot(d.index,true);}else if(d.key){const empty=game.state.slots.slice(0,10).findIndex(v=>!v);if(empty>=0)game.act('moveSlot',d.index,empty);}}clearDrag();renderSlots();}
  [bar,backpack].forEach(el=>{el.addEventListener('pointerdown',start);el.addEventListener('contextmenu',e=>e.preventDefault());});
  addEventListener('pointermove',move,{passive:false});addEventListener('pointerup',end);addEventListener('pointercancel',clearDrag);addEventListener('blur',clearDrag);
  addEventListener('keydown',e=>{if(e.altKey||e.ctrlKey||e.metaKey)return;if(/^\d$/.test(e.key)){e.preventDefault();selectSlot((Number(e.key)+9)%10,true);}if(e.code==='Tab'||e.code==='KeyI'){e.preventDefault();toggleInventory();}if(e.key==='Escape'){if(inventoryOpen)toggleInventory(false);else onCancel();}if(e.key==='Enter'&&game.state.ui.placing)onConfirm();});
  function update(state,clock){const now=performance.now();if(now-lastSlotsAt>B.ui.renderEveryMs){lastSlotsAt=now;renderSlots();}if(shownMoney===null)shownMoney=state.money;shownMoney+=(state.money-shownMoney)*.2;if(Math.abs(shownMoney-state.money)<.5)shownMoney=state.money;const moneyText=fmt(shownMoney);if(moneyText!==lastMoney){lastMoney=moneyText;numEl.textContent=moneyText;}const night=clock.night,frac=night?(clock.position-B.time.daySeconds)/B.time.nightSeconds:clock.position/B.time.daySeconds;arcEl.style.strokeDashoffset=String(106.8*(1-frac));arcEl.setAttribute('stroke',night?'#c9d6f0':'#e3bf73');if(dialEl.dataset.night!==String(night)){dialEl.dataset.night=String(night);dialEl.classList.toggle('night',night);dialIcon.innerHTML=night?ICONS.moon:ICONS.sun;}place.hidden=!state.ui.placing;bar.classList.toggle('dim',!!state.ui.placing);const fp=state.player?.mode==='fp';if(lastMode!==fp){lastMode=fp;modeBtn.innerHTML=fp?N.god:N.eye;modeBtn.setAttribute('aria-label',fp?'God view':'First person');modeBtn.setAttribute('aria-pressed',String(fp));document.body.classList.toggle('first-person',fp);}const fence=selected()==='fence'||selected()==='gate';fenceBar.hidden=!fence;fenceBar.querySelector('.fence-count').textContent=state.inv[selected()]??0;fenceBar.querySelector('.erase').classList.toggle('active',!!state.ui.fenceDelete);fenceBar.querySelector('.erase').setAttribute('aria-pressed',String(!!state.ui.fenceDelete));}
  for(const surface of [hud,bar,backpack,place,fenceBar])surface.addEventListener('pointerdown',e=>{if(e.target.closest('button')){audio.start?.().catch?.(()=>{});audio.lightClick?.();}},{capture:true,passive:true});
  renderSlots();
  return {update,select,selectSlot,cycle,toggleInventory,get inventoryOpen(){return inventoryOpen;},get selected(){return selected();},get selectedSlot(){return game.state.selectedSlot??0;},slotEl:k=>els.find(e=>e.dataset.key===k)??bar.querySelector('.bagbtn'),moneyEl,shopBtn,okBtn,setValid:ok=>okBtn.classList.toggle('invalid',!ok),backpack,bar};
}
