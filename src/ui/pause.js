export function createPause({game,cameraControl,hud,shop,canvas}){
 const el=document.createElement('section');el.id='pause-screen';el.hidden=true;el.setAttribute('role','dialog');el.setAttribute('aria-modal','true');el.setAttribute('aria-labelledby','pause-title');
 el.innerHTML='<div class="pause-card"><span class="pause-symbol">Ⅱ</span><h1 id="pause-title">Game paused</h1><p>Your farm is taking a little breather.</p><button class="resume-game">Resume game <kbd>Esc</kbd></button><div class="pause-shortcuts"><span><kbd>E</kbd> Inventory</span><span><kbd>M</kbd> Market</span><span><kbd>Q</kbd> God view</span></div></div>';document.body.append(el);
 function set(value){value=!!value;if(game.paused===value)return;hud.toggleInventory(false);shop.close();game.setPaused(value);el.hidden=!value;document.body.classList.toggle('game-paused',value);cameraControl.releasePointer();if(value)el.querySelector('button').focus();else {canvas.focus();if(cameraControl.isFirstPerson&&!matchMedia('(pointer:coarse)').matches)canvas.requestPointerLock?.()?.catch?.(()=>{});}}
 el.querySelector('button').onclick=()=>set(false);return {el,set,toggle:()=>set(!game.paused)};
}
