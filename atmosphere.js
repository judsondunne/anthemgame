"use strict";
// Cached density fields give the clouds soft, irregular edges and lit volume.
const Atmosphere = {
  clouds: [], flock: null, nextFlight: 14,
  noise(x,y,seed) {
    const hash=(a,b)=>{let n=Math.sin(a*127.1+b*311.7+seed*74.7)*43758.5453;return n-Math.floor(n);};
    const ix=Math.floor(x),iy=Math.floor(y),u=x-ix,v=y-iy;
    const sx=u*u*(3-2*u),sy=v*v*(3-2*v);
    return (hash(ix,iy)*(1-sx)+hash(ix+1,iy)*sx)*(1-sy)+(hash(ix,iy+1)*(1-sx)+hash(ix+1,iy+1)*sx)*sy;
  },
  makeCloud(seed) {
    const c=document.createElement('canvas');c.width=640;c.height=240;
    const cx=c.getContext('2d'),im=cx.createImageData(c.width,c.height);
    const puffs=Array.from({length:11},(_,i)=>({x:85+i*45,y:128-Math.sin(i*.83+seed)*23,r:40+20*Math.sin(i*1.7+seed)**2}));
    for(let y=0;y<c.height;y++)for(let x=0;x<c.width;x++){
      let density=0;
      for(const p of puffs){const q=((x-p.x)/p.r)**2+((y-p.y)/(p.r*.82))**2;density+=Math.exp(-q*1.8);}
      const n=this.noise(x/36,y/36,seed)*.52+this.noise(x/15,y/15,seed)*.28+this.noise(x/6,y/6,seed)*.14+this.noise(x/2.5,y/2.5,seed)*.06;
      let d=Math.max(0,Math.min(1,(density+(n-.5)*.85-.15)*2.4));
      d=d*d*(3-2*d);
      const shadow=Math.max(0,Math.min(1,(y-92)/95))*.65+(1-n)*.16;
      const k=(y*c.width+x)*4;
      im.data[k]=254-shadow*65;im.data[k+1]=253-shadow*56;im.data[k+2]=242-shadow*38;im.data[k+3]=d*230;
    }
    cx.putImageData(im,0,0);return c;
  },
  launch(){this.flock={age:0,duration:38,count:7,honkAt:5, calls:0};},
  update(dt){
    if(!this.flock){this.nextFlight-=dt;if(this.nextFlight<=0&&!isNight())this.launch();return;}
    const f=this.flock;f.age+=dt;
    if(f.age>f.honkAt&&f.calls<3){AudioGarden.goose(f.calls*.6- .6);f.calls++;f.honkAt+=4.5+Math.random()*3;}
    if(f.age>f.duration){this.flock=null;this.nextFlight=65+Math.random()*55;}
  },
  draw(c,t,night,sunset){
    if(!this.clouds.length)this.clouds=[1,4,8,12].map(s=>this.makeCloud(s));
    const left=-view.x/view.scale, right=left+innerWidth/view.scale,top=-view.y/view.scale;
    const span=right-left;
    c.save();
    for(let i=0;i<5;i++){
      const w=360+(i%3)*95, x=left+((i*span*.27+t*(1.5+i*.25))%(span+w))-w*.65;
      const y=top+(95-top)*(.15+(i%3)*.25)-35;
      c.globalAlpha=(1-night*.77)*(i<3?.87:.52);
      c.drawImage(this.clouds[i%4],x,y,w,w*.375);
    }
    c.globalAlpha=1;
    const f=this.flock;
    if(f){
      const x=left-180+(span+360)*f.age/f.duration,y=top+Math.max(65,(105-top)*.48);
      for(let i=0;i<f.count;i++){
        const row=Math.ceil(i/2),side=i===0?0:(i%2?1:-1);
        c.save();c.translate(x-row*70,y+side*row*13+Math.sin(t*1.2+i)*2);c.scale(.48,.48);
        this.bird(c,t*4.6+i*.47);c.restore();
      }
    }
    c.restore();
  },
  bird(c,phase){
    const flap=Math.sin(phase), lift=flap*26;
    c.lineJoin='round';c.lineCap='round';
    // Broad tapered flight feathers remain a single coherent wing silhouette.
    function wing(far){
      c.fillStyle=far?'#777b6b':'#646c5d';
      const k=far?.75:1, y=lift*k;
      c.beginPath();c.moveTo(2,1);
      c.bezierCurveTo(-2,y*.4,-9,y*.85-3,-18,y);
      c.bezierCurveTo(-22,y+1,-29,y+5,-32,y+8);
      c.quadraticCurveTo(-27,y+9,-24,y+8);
      c.quadraticCurveTo(-28,y+12,-22,y+10);
      c.quadraticCurveTo(-24,y+14,-18,y+12);
      c.bezierCurveTo(-9,y*.6+9,0,9,8,4);c.closePath();c.fill();
    }
    c.save();c.translate(-2,-2);wing(true);c.restore();
    c.fillStyle='#e0dbc5';c.beginPath();c.ellipse(-2,4,14,5.5,-.08,0,Math.PI*2);c.fill();
    c.fillStyle='#999982';c.beginPath();c.ellipse(-3,1,14,5,-.08,0,Math.PI*2);c.fill();
    path(c,[[-13,0],[-23,2],[-15,5]],'#565e52');
    // Neck follows the direction of travel; compact head with a white chinstrap.
    c.strokeStyle='#39483f';c.lineWidth=4;c.beginPath();c.moveTo(8,1);c.bezierCurveTo(17,1,21,-2,30,-3);c.stroke();
    c.fillStyle='#39483f';c.beginPath();c.ellipse(31,-3,4.5,3,0,0,Math.PI*2);c.fill();
    path(c,[[34,-4],[40,-2.5],[34,-1]],'#414c42');
    c.strokeStyle='#eeeada';c.lineWidth=2;c.beginPath();c.moveTo(31,-1);c.quadraticCurveTo(28,1,27,-1);c.stroke();
    wing(false);
  }
};
