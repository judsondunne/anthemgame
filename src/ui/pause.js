import { ICONS } from './icons.js';
import { NIGHT_ICONS as N } from './night-icons.js';
const pauseIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="M16 12v24m16-24v24" fill="none" stroke="currentColor" stroke-width="7" stroke-linecap="round"/></svg>';
const playIcon = '<svg viewBox="0 0 48 48" aria-hidden="true"><path d="m17 10 22 14-22 14Z" fill="#fff8e6" stroke="#69835c" stroke-width="2" stroke-linejoin="round"/></svg>';
export function createPause({game,cameraControl,hud,shop,canvas}) {
  const el=document.createElement('section');
  el.id='pause-screen';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-label','Game paused');
  el.innerHTML=`<div class="pause-card"><span class="pause-symbol" aria-hidden="true">${pauseIcon}</span><button class="resume-game" aria-label="Resume game">${playIcon}</button><div class="pause-shortcuts" aria-hidden="true"><span>${N.bag}</span><span>${ICONS.stall}</span><span>${N.eye}</span></div></div>`;
  document.body.append(el);
  function set(value){value=!!value;if(game.paused===value)return;hud.toggleInventory(false);shop.close();game.setPaused(value);el.hidden=!value;document.body.classList.toggle('game-paused',value);cameraControl.releasePointer();if(value)el.querySelector('button').focus();else{canvas.focus();if(cameraControl.isFirstPerson&&!matchMedia('(pointer:coarse)').matches)canvas.requestPointerLock?.()?.catch?.(()=>{});}}
  el.querySelector('button').onclick=()=>set(false);
  return {el,set,toggle:()=>set(!game.paused)};
}
