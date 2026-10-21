"use strict";
const Farm={
 pan:0,targetPan:0,held:0,xp:0,shownXP:0,eggs:[],animals:[],chicks:[],eggClock:24,babyClock:85,flights:[],feedPuffs:[],
 pastures:[{kind:'cow',x:-530,gate:-150,barn:-190,feed:0,visualFeed:0,queue:[]},{kind:'horse',x:1930,gate:1550,barn:1590,feed:0,visualFeed:0,queue:[]}],
 init(){try{this.xp=Number(JSON.parse(localStorage.getItem('garden-progress')||'{}').xp)||0;}catch{}this.shownXP=this.xp;
 for(const p of this.pastures)for(let i=0;i<3;i++)this.animals.push({kind:p.kind,x:p.kind==='cow'?-75-i*170:1480+i*170,y:700+i*48,tx:i===0?(p.kind==='cow'?-75:1480):p.x,ty:i===0?700:720,dir:1,phase:i*2.1,wait:i===0?18:i+1,peek:i===0,age:1,feedUntil:0});},
 award(x,y,amount){this.xp+=amount;this.shownXP=this.xp;try{localStorage.setItem('garden-progress',JSON.stringify({xp:this.xp}));}catch{}},
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
  update(dt){if(!world.started)return;this.targetPan=Math.max(-1450,Math.min(1450,this.targetPan+this.held*620*dt));this.pan+=(this.targetPan-this.pan)*(1-Math.exp(-dt*6));
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
  },
};
