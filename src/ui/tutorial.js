import { ICONS, itemIcon } from './icons.js';
import { NIGHT_ICONS as N } from './night-icons.js';
import { BALANCE as B } from '../config/balance.js';
import { NIGHT } from '../config/night.js';
// Build lessons after the model studio has installed its photographs.
const lessons=()=>[
 {id:'plant',label:'Buy flower seeds at the market, then plant them in your empty bed',icons:[itemIcon('seed_daisy'),N.arrow,ICONS.bed]},
 {id:'water',label:'Water your planted crops',icons:[ICONS.can,N.arrow,ICONS.drop]},
 {id:'harvest',label:'Harvest sparkling ripe crops',icons:[ICONS.sparkle,N.arrow,ICONS.hand]},
 {id:'explore',label:'Walk the garden with your flashlight',icons:[N.eye,N.arrow,itemIcon('flashlight')]},
];
export function createTutorial({game,onMode,onFence}) {
 const LESSONS=lessons();
 const el=document.createElement('aside');el.id='tutorial';el.hidden=true;el.setAttribute('aria-live','polite');document.body.append(el);
 let seen;try{seen=JSON.parse(localStorage.getItem('farm-tutorial-v3')??'{}');}catch{seen={};}
 let age=0,active=null,dayWarned=-1,lesson=0,nightTip=false;
 const persist=()=>{try{localStorage.setItem('farm-tutorial-v3',JSON.stringify(seen));}catch{}};
 function show(data){active=data;age=0;el.hidden=false;el.className=data.id==='dusk'?'dusk-warning':'lesson';el.setAttribute('aria-label',data.label??data.text??'Garden hint');el.innerHTML=`<div class="tutorial-example" aria-hidden="true">${data.icons.map(ic=>`<span>${ic}</span>`).join('')}</div><p class="tutorial-caption">${data.label??data.text??""}</p><button class="tutorial-close" aria-label="Dismiss">${ICONS.close}</button>`;el.querySelector('button').onclick=dismiss;if(data.action){el.classList.add('actionable');el.querySelector('.tutorial-example').onclick=data.action;}}
 function dismiss(){if(active){seen[active.id]=true;persist();}el.hidden=true;active=null;}
 function help(){lesson=0;show(LESSONS[lesson]);}
 function advance(){if(!active||active.id==='dusk'||active.id==='night')return;dismiss();lesson++;if(lesson<LESSONS.length)show(LESSONS[lesson]);}
 game.on(e=>{if(e.type==='replace'&&e.why==='first-player-start'){seen={};lesson=0;active=null;el.hidden=true;}if((e.type==='plant'&&active?.id==='plant')||(e.type==='water'&&active?.id==='water')||(e.type==='harvest'&&active?.id==='harvest'))advance();});
 function update(dt,clock){age+=dt;const day=Math.floor(game.state.time/B.time.cycleSeconds);if(clock.hour>=NIGHT.tutorial.duskHour&&clock.hour<22&&dayWarned!==day){dayWarned=day;show({id:'dusk',label:'Protect your animals before night. Call chickens into the coop and close your fences.',icons:[ICONS.cowF,N.arrow,itemIcon('fence'),N.wolf],action:onFence});return;}if(!seen.plant&&!active&&game.state.time<100)show(LESSONS[0]);if(active&&age>NIGHT.tutorial.seconds&&active.id!=='dusk')dismiss();if(active?.id==='dusk'&&age>B.ui.duskHintSeconds)dismiss();if(clock.night&&game.state.predators?.length&&!nightTip&&!active){nightTip=true;show({id:'night',label:'Aim your flashlight steadily to scare wolves. Keep animals inside.',icons:[N.eye,itemIcon('flashlight'),N.arrow,N.wolf],action:onMode});}if(!clock.night)nightTip=false;}
 return {update,help,dismiss,show,get active(){return active?.id;},el};
}
