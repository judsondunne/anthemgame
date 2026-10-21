import { ICONS, itemIcon } from './icons.js';
import { NIGHT_ICONS as N } from './night-icons.js';
import { NIGHT } from '../config/night.js';
const LESSONS=[
 {id:'plant',text:'Pick seeds. Tap an empty bed.',icons:[itemIcon('seed_daisy'),N.arrow,ICONS.bed]},
 {id:'water',text:'Give your seeds a drink.',icons:[ICONS.can,N.arrow,ICONS.drop]},
 {id:'harvest',text:'When it sparkles, tap to harvest.',icons:[ICONS.sparkle,N.arrow,ICONS.hand]},
 {id:'explore',text:'Take a walk. Try first person.',icons:[N.eye,N.arrow,N.flashlight]},
];
export function createTutorial({game,onMode,onFence}){
 const el=document.createElement('aside');el.id='tutorial';el.hidden=true;el.setAttribute('aria-live','polite');document.body.append(el);
 let seen;try{seen=JSON.parse(localStorage.getItem('farm-tutorial-v3')??'{}');}catch{seen={};}
 let age=0,active=null,dayWarned=-1,lesson=0,nightTip=false;
 const persist=()=>{try{localStorage.setItem('farm-tutorial-v3',JSON.stringify(seen));}catch{}};
 function show(data){active=data;age=0;el.hidden=false;el.className=data.id==='dusk'?'dusk-warning':'lesson';el.innerHTML=`<div class="tutorial-example" aria-hidden="true">${data.icons.map(ic=>`<span>${ic}</span>`).join('')}</div><div class="tutorial-copy"><p>${data.text}</p>${data.detail?`<p class="tutorial-detail">${data.detail}</p>`:''}</div><button class="tutorial-close" aria-label="Dismiss">${ICONS.close}</button>`;el.querySelector('button').onclick=dismiss;if(data.action){el.classList.add('actionable');el.querySelector('.tutorial-example').onclick=data.action;}}
 function dismiss(){if(active){seen[active.id]=true;persist();}el.hidden=true;active=null;}
 function help(){lesson=0;show(LESSONS[lesson]);}
 function advance(){if(!active||active.id==='dusk'||active.id==='night')return;dismiss();lesson++;if(lesson<LESSONS.length)show(LESSONS[lesson]);}
 game.on(e=>{if((e.type==='plant'&&active?.id==='plant')||(e.type==='water'&&active?.id==='water')||(e.type==='harvest'&&active?.id==='harvest'))advance();});
 function update(dt,clock){age+=dt;const day=Math.floor(game.state.time/600);if(clock.hour>=NIGHT.tutorial.duskHour&&clock.hour<22&&dayWarned!==day){dayWarned=day;show({id:'dusk',text:'Make sure all the animals are in.',detail:'Tap the coop to call chickens in. Locals heard wolves nearby.',icons:[ICONS.cowF,N.arrow,N.fence,N.wolf],action:onFence});return;}if(!seen.plant&&!active&&game.state.time<100)show(LESSONS[0]);if(active&&age>NIGHT.tutorial.seconds&&active.id!=='dusk')dismiss();if(active?.id==='dusk'&&age>22)dismiss();if(clock.night&&game.state.predators?.length&&!nightTip&&!active){nightTip=true;show({id:'night',text:'Wolves fear your light in first person.',detail:'Aim steadily. Keep the animals inside.',icons:[N.eye,N.flashlight,N.arrow,N.wolf],action:onMode});}if(!clock.night)nightTip=false;}
 return {update,help,dismiss,show,get active(){return active?.id;},el};
}
