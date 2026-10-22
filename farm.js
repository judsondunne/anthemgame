"use strict";
const Farm = {
  pan:0, targetPan:0, held:0, xp:0, shownXP:0, eggs:[], animals:[], chicks:[], eggClock:24, babyClock:85, flights:[],
  pastures:[{kind:'cow',x:-530,name:'Clover Pasture',gate:-150,barn:-190,feed:0,visualFeed:0,queue:[]},{kind:'horse',x:1930,name:'Horses',gate:1550,barn:1590,feed:0,visualFeed:0,queue:[]}],
  init(){
    try {this.xp=Number(JSON.parse(localStorage.getItem('garden-progress')||'{}').xp)||0;}catch{}
    this.shownXP=this.xp;
    for(const p of this.pastures)for(let i=0;i<3;i++)this.animals.push({kind:p.kind,x:p.kind==='cow'?-75-i*170:1480+i*170,y:700+i*48,tx:i===0?(p.kind==='cow'?-75:1480):p.x,ty:i===0?700:720,dir:1,phase:i*2.1,wait:i===0?18:i+1,peek:i===0,age:1,feedUntil:0});
    this.barns={cow:this.barn('cow'),horse:this.barn('horse')};
    this.originalGrain=document.querySelector('[data-tool=grain] svg').outerHTML;this.feedPuffs=[];
    this.ui();this.progress();
  },
  barn(kind){
    const stable=kind==='horse',wood=stable?'#bba584':'#b69680';
    return modelSprite(360,320,{x:165,y:248},c=>{
      // Shared camera, complete roof planes, timber foundation and open stalls.
      box3(c,-112,112,-3,96,0,7,['#b9b79a','#929b81','#d4cfad']);
      box3(c,-108,108,0,91,7,112,[wood,shade(wood,-20),wood]);
      face3(c,[[-108,0,112],[108,0,112],[0,0,179]],shade(wood,9));
      face3(c,[[0,-8,184],[0,101,184],[-121,101,106],[-121,-8,106]],'#849184');
      roof3(c,114,94,112,184,['#6f817b','#9aa89a']);
      for(let x=-102;x<108;x+=10)line3(c,[x,-.5,7],[x,-.5,110],shade(wood,-15),.7);
      for(let z=8;z<90;z+=10)line3(c,[108,z,8],[108,z,110],shade(wood,-30),.7);
      frontPlane(c,-1,()=>{
        c.fillStyle='#ede4ca';c.fillRect(-94,-98,188,96);
        const g=c.createLinearGradient(0,-90,0,0);g.addColorStop(0,'#3e5148');g.addColorStop(1,'#737962');c.fillStyle=g;c.fillRect(-88,-92,176,89);
        c.fillStyle='#b6a17c';c.fillRect(-86,-7,172,4);
        // Half doors, diagonal braces and iron hinges.
        for(const x of [-89,5]){
          c.fillStyle=shade(wood,-6);c.fillRect(x,-34,84,31);
          for(let j=1;j<7;j++){c.strokeStyle=shade(wood,-22);c.lineWidth=.7;c.beginPath();c.moveTo(x+j*12,-33);c.lineTo(x+j*12,-4);c.stroke();}
          c.strokeStyle='#e4d8b9';c.lineWidth=3;c.strokeRect(x,-34,84,31);c.beginPath();c.moveTo(x+3,-30);c.lineTo(x+80,-6);c.stroke();
          c.fillStyle='#6b7766';c.fillRect(x+3,-29,9,2);c.fillRect(x+3,-11,9,2);
        }
        c.fillStyle='#e6dcc1';c.fillRect(-3,-98,6,96);
        c.strokeStyle='#eee6ce';c.lineWidth=4;c.beginPath();c.moveTo(-108,-112);c.lineTo(0,-179);c.lineTo(108,-112);c.stroke();
        c.fillStyle='#e6dcc1';c.fillRect(-21,-149,42,29);c.fillStyle='#687f73';c.fillRect(-17,-145,34,21);
        c.strokeStyle='#c4cbb1';c.lineWidth=1.5;c.beginPath();c.moveTo(0,-145);c.lineTo(0,-124);c.moveTo(-17,-134);c.lineTo(17,-134);c.stroke();
        for(const x of [-99,97]){c.fillStyle='#e3d7b8';c.fillRect(x,-106,4,105);}
      });
      sidePlane(c,108,()=>{c.fillStyle='#d6d0b2';c.fillRect(29,-87,35,29);c.fillStyle='#687c70';c.fillRect(32,-84,29,23);c.strokeStyle='#c6cdb4';c.lineWidth=1.5;c.beginPath();c.moveTo(46,-84);c.lineTo(46,-61);c.stroke();});
      for(let i=0;i<26;i++){const x=-102+(i*31)%215,p=project3(x,-5,1);ellipse(c,p.x,p.y,3.5,1.2,'#b6ad824d');}
    });
  },
  ui(){
    const ui=document.createElement('div');ui.id='farm-ui';ui.hidden=true;
    ui.innerHTML='<div class="level-card" aria-label="Farm experience"><div class="level-heading"><span id="level-title">Level 1</span><span id="xp-count"></span></div><div class="xp-track" role="progressbar" aria-label="Level progress"><div id="xp-fill"></div></div></div><div class="farm-navigation"><button id="pan-left" aria-label="Pan left">‹</button><span id="place-name">Chicken Garden</span><button id="pan-right" aria-label="Pan right">›</button></div><button class="side-link side-left" id="to-cows" aria-label="Go to cows">‹ <span>Cows</span></button><button class="side-link side-right" id="to-horses" aria-label="Go to horses"><span>Horses</span> ›</button><div id="xp-flights" aria-hidden="true"></div><div id="farm-toast" role="status"></div>';
    document.body.append(ui);
    document.querySelector('#to-cows').onclick=()=>this.targetPan=this.pan>600?0:-1230;
    document.querySelector('#to-horses').onclick=()=>this.targetPan=this.pan< -600?0:1230;
    for(const [id,dir] of [['pan-left',-1],['pan-right',1]])document.getElementById(id).onclick=()=>this.targetPan=Math.max(-1450,Math.min(2600,this.targetPan+dir*1230));
    addEventListener('keydown',e=>{if(!world.started||!['ArrowLeft','ArrowRight'].includes(e.key))return;e.preventDefault();this.held=e.key==='ArrowLeft'?-1:1;});
    addEventListener('keyup',e=>{if(['ArrowLeft','ArrowRight'].includes(e.key))this.held=0;});addEventListener('blur',()=>this.held=0);
    canvas.addEventListener('wheel',e=>{if(!world.started||Math.abs(e.deltaX)<Math.abs(e.deltaY)*.6)return;e.preventDefault();this.targetPan=Math.max(-1450,Math.min(2600,this.targetPan+e.deltaX/view.scale));},{passive:false});
  },
  progress(){const level=Math.floor(this.shownXP/100)+1,value=this.shownXP%100;document.querySelector('#level-title').textContent=`Level ${level}`;document.querySelector('#xp-count').textContent=`${Math.floor(value)} / 100 XP`;document.querySelector('#xp-fill').style.width=value+'%';const track=document.querySelector('.xp-track');track.setAttribute('aria-valuemin','0');track.setAttribute('aria-valuemax','100');track.setAttribute('aria-valuenow',Math.floor(value));},
  award(x,y,amount,label){
    this.xp+=amount;try{localStorage.setItem('garden-progress',JSON.stringify({xp:this.xp}));}catch{}
    const dot=document.createElement('span');dot.className='xp-flight';dot.textContent=`+${amount} XP`;
    const sx=view.x+x*view.scale,sy=view.y+y*view.scale;dot.style.left=sx+'px';dot.style.top=sy+'px';document.querySelector('#xp-flights').append(dot);
    const dest=document.querySelector('.level-card').getBoundingClientRect();
    const animation=dot.animate([{transform:'translate(-50%,0) scale(.7)',opacity:0},{transform:'translate(-50%,-24px) scale(1)',opacity:1,offset:.2},{transform:`translate(${dest.x+dest.width*.65-sx}px,${dest.y+dest.height*.6-sy}px) scale(.35)`,opacity:0}],{duration:1300,easing:'cubic-bezier(.22,.65,.35,1)',fill:'forwards'});
    animation.onfinish=()=>dot.remove();this.flights.push({at:world.elapsed+1.05,value:amount});
  },
  interact(x,y){
    const egg=this.eggs.find(e=>Math.hypot(e.x-x,e.y-8-y)<Math.max(20,15/view.scale));
    if(egg){this.eggs.splice(this.eggs.indexOf(egg),1);this.award(egg.x,egg.y,15,'Egg collected');AudioGarden.chime();return true;}
    const animal=this.animalAt(x,y);
    if(animal&&world.tool!=='grain'){
      if(world.tool==='pet'){
        animal.happy=3;animal.wait=3;animal.tx=animal.x;animal.ty=animal.y;animal.feedUntil=0;
        const p=this.pastures.find(p=>p.kind===animal.kind);p.queue=p.queue.filter(a=>a!==animal);
        if((animal.lastPet??-100)+20<world.elapsed){this.award(animal.x,animal.y-65,4,'Happy');animal.lastPet=world.elapsed;}
      }else{
        const p=this.pastures.find(p=>p.kind===animal.kind);
        animal.boltUntil=world.elapsed+4;animal.tx=Math.max(p.x-390,Math.min(p.x+390,animal.x+(animal.dir||1)*200));animal.ty=640+Math.random()*160;animal.feedUntil=0;p.queue=p.queue.filter(a=>a!==animal);
      }
      return true;
    }
    if(world.tool!=='grain'||isNight())return false;
    const p=this.pastures.find(p=>Math.abs(x-p.x)<560&&y>430&&y<940);
    if(!p)return false;
    p.feed=Math.min(100,p.feed+45);
    const herd=this.animals.filter(a=>a.kind===p.kind);
    for(const a of herd)if(!p.queue.includes(a)){a.mealRemaining=12;a.mealAwarded=false;p.queue.push(a);}
    for(let i=0;i<18;i++)this.feedPuffs.push({x:x+(Math.random()-.5)*25,y,tx:p.gate+(p.kind==='cow'?-65:65)+(Math.random()-.5)*120,ty:795,age:0,duration:.55+Math.random()*.25});
    return true;
  },
  animalAt(x,y){return [...this.animals].reverse().find(a=>!a.sheltered&&Math.abs(a.x-x)<55*(.52+a.age*.48)&&Math.abs(a.y-46*(.52+a.age*.48)-y)<43*(.52+a.age*.48));},
  hover(x,y){return this.eggs.some(e=>Math.hypot(e.x-x,e.y-8-y)<Math.max(20,15/view.scale))||!!this.animalAt(x,y);},
  syncTool(){
    const region=this.pan< -380?'cow':this.pan>380?'horse':'chicken';if(this.toolRegion===region)return;this.toolRegion=region;
    const button=document.querySelector('.care-tools [data-tool="grain"]');
    const icons={cow:'<svg class="tool-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="M11 17q-1-15 9-15t9 15" fill="none" stroke="#81947c"/><path d="m8 15 4 20h17l4-20Z" fill="#b5c2a6" stroke="#718b79"/><ellipse cx="20" cy="15" rx="12" ry="4" fill="#d7c38e" stroke="#9c946c"/><path d="m13 23 14 0m-13 5 12 0" stroke="#8ca181"/></svg>',horse:'<svg class="tool-icon" viewBox="0 0 40 40" aria-hidden="true"><path d="m6 15 24-5 5 20-24 5Z" fill="#d9c68b" stroke="#ac9963"/><path d="m12 14 5 20m9-23 5 20M8 20l23-5M9 25l23-5m-21 9 23-5" fill="none" stroke="#b8a06a"/><path d="m14 12 5 21m8-23 5 21" stroke="#86916b" stroke-width="2"/></svg>'};
    button.querySelector('svg').outerHTML=icons[region]??this.originalGrain;
    button.querySelector('.tool-label').textContent=region==='horse'?'Hay':region==='cow'?'Cow feed':'Grain';
    button.setAttribute('aria-label',region==='horse'?'Fill horse hay trough':region==='cow'?'Fill cow feed trough':'Chicken grain');
    selectTool(world.tool);
  },
  update(dt){
    document.querySelector('#farm-ui').hidden=!world.started;if(!world.started)return;
    this.targetPan=Math.max(-1450,Math.min(2600,this.targetPan+this.held*620*dt));
    const old=this.pan;this.pan+=(this.targetPan-this.pan)*(1-Math.exp(-dt*6));view.x-=(this.pan-old)*view.scale;if(world.pointer?.visible)world.pointer.x+=this.pan-old;
    document.querySelector('#place-name').textContent=this.pan < -600?'Clover Pasture':this.pan>1750?'Brook':this.pan>600?'Horses':'Chicken Garden';
    document.querySelector('#pan-left').disabled=this.targetPan<=-1449;document.querySelector('#pan-right').disabled=this.targetPan>=2599;
    this.flights=this.flights.filter(f=>{if(world.elapsed>=f.at){this.shownXP+=f.value;return false;}return true;});
    if(!window.ClassicFarm)this.syncTool();
    const left=document.querySelector('#to-cows'),right=document.querySelector('#to-horses');
    left.hidden=this.pan< -600;right.hidden=this.pan>600;
    left.querySelector('span').textContent=this.pan>600?'Chicken Garden':'Cows';
    right.querySelector('span').textContent=this.pan< -600?'Chicken Garden':'Horses';
    this.progress();
    if(window.ClassicFarm)return;
    for(const p of this.pastures){
      p.visualFeed+=(p.feed-p.visualFeed)*(1-Math.exp(-dt*4));
      if(isNight()){p.queue=[];continue;}
      const serving=p.queue.slice(0,3);
      for(let i=0;i<serving.length;i++){
        const a=serving[i],dir=p.kind==='cow'?1:-1;
        a.tx=p.gate-dir*65+(i-1)*112-dir*62;a.ty=825;a.feedUntil=world.elapsed+3;
        if(p.feed>0&&Math.hypot(a.x-a.tx,a.y-a.ty)<12){
          const bite=Math.min(p.feed,dt*2.4,a.mealRemaining);p.feed-=bite;a.mealRemaining-=bite;a.eating=true;a.dir=dir;
          if(!a.mealAwarded){this.award(a.x,a.y-70,10,'Fed');a.mealAwarded=true;}
          if(a.mealRemaining<=.001){p.queue=p.queue.filter(b=>b!==a);a.feedUntil=0;a.wait=1;a.eating=false;}
        }else a.eating=false;
      }
      if(p.feed<=.001){for(const a of p.queue){a.feedUntil=0;a.eating=false;}p.queue=[];}
    }
    this.feedPuffs=this.feedPuffs.filter(p=>(p.age+=dt)<p.duration);
    if(!isNight()){
      this.eggClock-=dt;if(this.eggClock<0){if(this.eggs.length<10)this.eggs.push({x:450+Math.random()*220,y:765+Math.random()*85});this.eggClock=35+Math.random()*25;}
      this.babyClock-=dt;if(this.babyClock<0){this.birth();this.babyClock=85+Math.random()*55;}
    }
    for(const a of this.animals){
      a.age=Math.min(1,a.age+dt/160);a.wait-=dt;a.happy=Math.max(0,(a.happy??0)-dt);
      const p=this.pastures.find(p=>p.kind===a.kind),night=isNight();
      if(night){a.tx=p.barn+(a.phase%3-1)*24;a.ty=530;}
      else if(a.wasNight){a.wait=0;a.tx=p.x;a.ty=690;}
      a.wasNight=night;
      const dist=Math.hypot(a.tx-a.x,a.ty-a.y);
      a.sheltered=night&&dist<16;
      if(dist>3){const speed=(a.boltUntil??0)>world.elapsed?(a.kind==='horse'?100:60):a.kind==='horse'&&!night&&a.feedUntil<world.elapsed?58:26;const step=Math.min(dist,speed*dt);a.x+=(a.tx-a.x)/dist*step;a.y+=(a.ty-a.y)/dist*step;if(Math.abs(a.tx-a.x)>1)a.dir=a.tx>a.x?1:-1;a.moving=true;}
      else {a.moving=false;if(a.feedUntil>world.elapsed)a.dir=a.kind==='cow'?1:-1;if(!night&&a.feedUntil<world.elapsed&&a.wait<0){a.tx=a.peek?(p.kind==='cow'?-75-Math.random()*60:1465+Math.random()*50):p.x-330+Math.random()*660;a.ty=a.peek?680+Math.random()*65:610+Math.random()*200;a.wait=5+Math.random()*9;}}
    }
    // Personal space keeps grazing herds readable rather than stacked.
    if(!isNight())for(let i=0;i<this.animals.length;i++)for(let j=i+1;j<this.animals.length;j++){const a=this.animals[i],b=this.animals[j];if(a.kind!==b.kind)continue;const dx=b.x-a.x,dy=(b.y-a.y)*1.8,d=Math.hypot(dx,dy);if(d>0&&d<110){const push=Math.min(8*dt,(110-d)*.12);a.x-=dx/d*push;b.x+=dx/d*push;a.y-=dy/d*push*.45;b.y+=dy/d*push*.45;}}
    for(const b of this.chicks){b.age=Math.min(1,b.age+dt/150);const parent=world.chickens[b.parent%world.chickens.length];if(!isNight()){const dx=parent.x-24-b.x,dy=parent.y+15-b.y,d=Math.hypot(dx,dy);if(d>12){b.x+=dx/d*23*dt;b.y+=dy/d*23*dt;}b.dir=dx>0?1:-1;}}
  },
  birth(){
    const options=['chicken','cow','horse'].filter(kind=>kind==='chicken'?this.chicks.length<3:this.animals.filter(a=>a.kind===kind).length<6);if(!options.length)return;
    const kind=options[(this.birthIndex??0)%options.length];this.birthIndex=(this.birthIndex??0)+1;
    if(kind==='chicken'){const parent=Math.floor(Math.random()*world.chickens.length),p=world.chickens[parent];this.chicks.push({x:p.x-22,y:p.y+14,age:0,parent,dir:1});}
    else {const parent=this.animals.find(a=>a.kind===kind);this.animals.push({...parent,x:parent.x-35,y:parent.y+30,tx:parent.x,ty:parent.y+30,age:0,phase:Math.random()*6,peek:false,wait:2});}
    const toast=document.querySelector('#farm-toast');toast.textContent=`A little ${kind==='chicken'?'chick':kind==='cow'?'calf':'foal'} has joined the farm ♡`;toast.classList.add('visible');clearTimeout(this.toastTimer);this.toastTimer=setTimeout(()=>toast.classList.remove('visible'),4500);
  },
  fence(x1,x2,y,gate){
    const c=ctx;for(let x=x1;x<x2;x+=62){if(gate&&Math.abs(x-gate)<80)continue;line(c,x,y,x,y-43,'#e1d9b7',5);ellipse(c,x,y-43,3,2,'#eee5c8');}
    for(let row=0;row<2;row++){c.strokeStyle='#ded8b7';c.lineWidth=4;c.beginPath();c.moveTo(x1,y-15-row*19);if(gate){c.lineTo(gate-80,y-15-row*19);c.moveTo(gate+80,y-15-row*19);}c.lineTo(x2,y-15-row*19);c.stroke();}
  },
  draw(t,night){
    if(!this.barns)return;
    for(const p of this.pastures){
      const left=p.x-530,right=p.x+530;
      let g=ctx.createLinearGradient(0,465,0,900);g.addColorStop(0,'#a9ba87');g.addColorStop(1,'#94ab74');
      // The pasture shares the continuous meadow rather than a rectangular tile.
      for(let i=0;i<190;i++){const x=left+((i*137)%1050),y=510+((i*71)%370);blit(S.tuft,x,y,.45+(i%3)*.12);}
      for(const [x,y,s] of [[left+25,510,.65],[right-15,515,.65],[p.kind==='cow'?left+30:right-30,840,.6]]){shadow(x,y,28*s,8*s,night);blit(S.tree,x,y,s);}
      this.fence(left,right,550);
      if(!window.ClassicFarm){shadow(p.barn,545,115,24,night);blit(this.barns[p.kind],p.barn,545,1);}
      for(const a of (window.ClassicFarm?[]:this.animals.filter(a=>a.kind===p.kind)).sort((a,b)=>a.y-b.y)){
        if(a.sheltered){
          const index=this.animals.filter(b=>b.kind===p.kind).indexOf(a);
          ctx.save();ctx.translate(p.barn,545);
          const opening=[[-88,0,35],[88,0,35],[88,0,92],[-88,0,92]].map(v=>{const q=project3(...v);return[q.x,q.y];});
          polygonClip(ctx,opening,()=>{const pos=project3(-57+index%3*57,0,12+Math.floor(index/3)*25);ctx.translate(pos.x,pos.y);ctx.scale(.45,.45);this.animal(ctx,a,t,true);});
          ctx.restore();continue;
        }
        const size=.52+a.age*.48;shadow(a.x,a.y,46*size,12*size,night);ctx.save();ctx.translate(a.x,a.y);ctx.scale(a.dir*size,size);this.animal(ctx,a,t,false);ctx.restore();
        if(a.happy>0)heart(a.x,a.y-108*size-Math.sin(t*3)*4,.65,'#c99589');
      }
      this.fence(left,right,885,p.gate);
      this.trough(p,t);
    }
  },
  trough(p,t){
    const c=ctx,x=p.gate+(p.kind==='cow'?-65:65),y=795;
    c.save();c.translate(x,y);
    shadow(0,5,140,17,0);
    for(const xx of [-124,124])box3(c,xx-4,xx+4,0,32,0,27,['#95896b','#817b63','#c1b38b']);
    box3(c,-142,142,0,39,14,28,['#a38f6d','#837d61','#c2ae86']);
    face3(c,[[-135,3,29],[135,3,29],[135,34,29],[-135,34,29]],'#605e46');
    if(p.visualFeed>.1){const h=18+p.visualFeed*.1;face3(c,[[-132,5,h],[132,5,h],[132,32,h],[-132,32,h]],p.kind==='horse'?'#c4b578':'#cabb8d');
      for(let i=0;i<Math.ceil(p.visualFeed*.9);i++){const q=project3(-126+(i*47)%252,8+(i*13)%21,h+.8);if(p.kind==='horse')line(c,q.x-5,q.y-1,q.x+4,q.y+1,i%2?'#e5d49b':'#9e9e69',1);else ellipse(c,q.x,q.y,1.8,.8,i%2?'#e0cea0':'#aa9b66');}
    }
    box3(c,-145,145,-3,2,13,31,['#af9b73','#8a8062','#d2bf96']);
    for(let j=0;j<3;j++)line3(c,[-140,-3,17+j*5],[140,-3,17+j*5],'#8b806341',.65);
    for(const xx of [-135,135])for(const h of [18,26]){const q=project3(xx,-4,h);ellipse(c,q.x,q.y,1,1,'#777a63');}
    c.restore();
    for(const f of this.feedPuffs){const u=f.age/f.duration;c.globalAlpha=Math.sin(u*Math.PI);const fx=f.x+(f.tx-f.x)*u,fy=f.y+(f.ty-f.y)*u-Math.sin(u*Math.PI)*65;ellipse(c,fx,fy,2.4,1.3,'#d8c48c');c.globalAlpha=1;}
  },
  animal(c,a,t,sleep){
    const horse=a.kind==='horse',coat=horse?(a.phase>3?'#bda585':'#a77c58'):'#e6dfc8',dark=horse?'#6d5945':'#6f7465';
    const gait=a.moving?Math.sin(t*(horse?8:4.5)+a.phase):0;
    c.translate(0,a.moving?Math.cos(t*(horse?16:9)+a.phase)*.8:Math.sin(t*1.6+a.phase)*.3);
    // Four articulated legs attach to the torso; far legs are shaded.
    for(let i=0;i<4;i++){const x=i<2?-28:27,far=i%2===0,step=gait*(far?-1:1)*(horse?12:6);const lift=a.moving?Math.max(0,(far?-1:1)*gait)*5:0;c.strokeStyle=far?shade(coat,-30):coat;c.lineWidth=horse?6:8;c.lineCap='round';c.beginPath();c.moveTo(x, -38);c.lineTo(x+step*.5,-19);c.lineTo(x+step, -3-lift);c.stroke();line(c,x+step-3,-2-lift,x+step+3,-2-lift,dark,5);}
    c.strokeStyle=dark;c.lineWidth=horse?5:3;c.beginPath();c.moveTo(-43,-53);c.quadraticCurveTo(-54,-44,-52+Math.sin(t*2+a.phase)*3,-22);c.stroke();
    ellipse(c,-1,-47,47,23,coat);ellipse(c,27,-51,18,25,coat);
    if(!horse){for(const [x,y,rx,ry]of[[-25,-53,14,12],[7,-41,13,10],[20,-61,9,8]]){c.save();c.translate(x,y);c.fillStyle=dark;c.beginPath();c.moveTo(-rx,0);c.bezierCurveTo(-rx,-ry,3,-ry*.6,rx,-ry*.3);c.bezierCurveTo(rx*1.2,ry*.8,-rx*.5,ry*1.2,-rx,0);c.fill();c.restore();}}
    c.strokeStyle=horse?'#d9bb9345':'#f7efda75';c.lineWidth=1.2;c.beginPath();c.ellipse(-5,-49,36,15,0,Math.PI,Math.PI*1.7);c.stroke();
    const eating=a.eating&&!a.moving&&!sleep;
    c.save();c.translate(29,-55);c.rotate(eating?(horse?1.65:1.5)+Math.sin(t*3)*.04:Math.sin(t*.8+a.phase)*.025);
    if(horse){path(c,[[0,10],[-4,-5],[5,-28],[17,-40],[30,-36],[22,-15],[24,10]],coat);c.strokeStyle=dark;c.lineWidth=5;c.beginPath();c.moveTo(1,2);c.quadraticCurveTo(-1,-24,17,-40);c.stroke();c.save();c.translate(25,-34);c.rotate(.45);ellipse(c,4,0,19,9,coat);ellipse(c,18,1,8,7,'#bca184');path(c,[[-8,-5],[-12,-21],[-3,-9]],coat);path(c,[[-1,-8],[-1,-21],[5,-7]],coat);if(sleep||a.happy>0)line(c,1,-3,5,-3,'#53634d',1.2);else ellipse(c,3,-3,1.3,1.3,'#38473d');ellipse(c,22,0,1.7,1,'#75634f');c.restore();}
    else {path(c,[[0,12],[-1,-16],[15,-23],[23,-4],[21,13]],coat);ellipse(c,21,-11,18,14,coat);ellipse(c,34,-4,12,8,'#c9b7a2');ellipse(c,8,-21,10,5,dark);ellipse(c,25,-24,9,5,coat);line(c,18,-14,21,-14,'#3e493d',2);ellipse(c,38,-5,1.5,1,'#7d7867');}
    c.restore();
  },
  drawSmall(t){
    for(const e of this.eggs){glow(e.x,e.y-8,18,'#fff3be35');shadow(e.x,e.y,9,3,0);ctx.save();ctx.translate(e.x,e.y-8);ctx.rotate(.2);ellipse(ctx,0,0,6,8,'#f5e9c8');ellipse(ctx,-2,-3,1.8,2.5,'#fff7df');ctx.restore();}
    if(isNight()&&this.chicks.length){const co=world.coop;ctx.save();ctx.translate(co.x,co.y);ctx.scale(co.scale,co.scale);polygonClip(ctx,S.coop.opening.map(p=>[p.x,p.y]),()=>{for(let i=0;i<this.chicks.length;i++)blit(S.sleeping[0],-25+i*20,-6,.3);});ctx.restore();}
    if(!isNight())for(const b of this.chicks){ctx.save();ctx.translate(b.x,b.y);ctx.scale(b.dir,1);blit(S.chickens[b.age<1?0:b.parent%4],0,0,.38+b.age*.62);ctx.restore();}
  }
};
