const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

(async () => {
  const browser = await chromium.launch({ headless:true, args:['--use-angle=swiftshader','--enable-webgl','--enable-unsafe-swiftshader','--ignore-gpu-blocklist'] });
  const logs={errors:[],warnings:[],failed:[],http:[]}, evidence={};
  const page=await browser.newPage({viewport:{width:1280,height:800},deviceScaleFactor:1});
  page.on('pageerror',e=>logs.errors.push(e.message));
  page.on('console',m=>{if(m.type()==='error')logs.errors.push(m.text());if(m.type()==='warning')logs.warnings.push(m.text());});
  page.on('requestfailed',r=>logs.failed.push({url:r.url(),reason:r.failure()?.errorText}));
  page.on('response',r=>{if(r.status()>=400)logs.http.push({url:r.url(),status:r.status()});});
  async function noLetters(){assert.equal(await page.evaluate(()=>/[A-Za-z]/.test(document.body.innerText)),false,'no visible letters');}
  async function settle(){await page.evaluate(()=>{for(let i=0;i<80;i++)Garden.cameraControl.update(.05,true);});await page.waitForTimeout(550);}
  async function shot(name){await page.waitForTimeout(350);await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));await noLetters();await page.screenshot({path:path.join(__dirname,name+'.png'),timeout:90000,animations:'disabled'});console.log('captured',name);}
  try {
    await page.goto((process.env.FARM_URL||'http://127.0.0.1:8097')+'/?fresh=1&nosync=1&seed=1247&quality=low&timescale=0');
    await page.waitForFunction(()=>window.Garden?.ready,null,{timeout:180000});
    await page.evaluate(()=>Garden.tutorial.dismiss());
    await noLetters();
    evidence.start=await page.evaluate(()=>({stats:Garden.stats(),cottage:Garden.cottage.snapshot(),icons:document.querySelectorAll('#toolbar img.item-icon').length}));
    assert.ok(evidence.start.icons>=4,'startup model portraits are installed');
    assert.equal(await page.locator('#toolbar .slots .slot').count(),10);
    assert.equal(await page.locator('#backpack .slot').count(),64);

    await page.evaluate(()=>{Garden.setHour(17);Garden.cameraControl.setMode('god');Garden.cameraControl.focus(700,650,0,37);});await settle();await shot('01-golden-overview');

    await page.evaluate(()=>{Garden.setHour(20);Garden.Sim.tick(Garden.state(),90);Garden.game.pump();Garden.tutorial.dismiss();Garden.cameraControl.focus(320,800,.4,7);});await settle();
    evidence.coop=await page.evaluate(()=>({doors:Garden.state().coops,residents:Garden.state().animals.filter(a=>a.sp==='chicken').map(a=>({id:a.id,indoors:a.indoors}))}));
    assert.ok(evidence.coop.residents.every(a=>a.indoors),'starter chickens enter automatically');
    await shot('02-coop-dusk');

    await page.evaluate(()=>{Garden.setHour(8);Garden.tutorial.dismiss();Garden.cameraControl.focus(2850,-199,0,15);Garden.wildlife.update(1);});await settle();
    evidence.wildlife=await page.evaluate(()=>Garden.wildlife.snapshot());assert.ok(evidence.wildlife.active>0);assert.ok(evidence.wildlife.active<=evidence.wildlife.cap);await shot('03-forest-wildlife');

    // Walk through the actual front threshold in first person, including the
    // closed-door collision and interaction path, before photographing indoors.
    await page.evaluate(()=>{const d=Garden.cottage.door;Garden.cameraControl.setMode('fp');Garden.cameraControl.setPlayer({x:d.x*50+700,y:(d.z+.9)*50/1.65+650,yaw:0,pitch:0});if(Garden.cottage.doorOpen)Garden.cottage.toggleDoor();Garden.cottage.update(2,{cameraControl:Garden.cameraControl,night:0});});
    await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<50;i++)Garden.cameraControl.update(.05,true);});await page.keyboard.up('w');
    evidence.closedDoor=await page.evaluate(()=>!Garden.cottage.contains(Garden.cameraControl.player.x,Garden.cameraControl.player.z));assert.equal(evidence.closedDoor,true);
    await page.evaluate(()=>{const d=Garden.cottage.door;Garden.cameraControl.setPlayer({x:d.x*50+700,y:(d.z+.8)*50/1.65+650,yaw:0,pitch:-.22});});await settle();
    await page.evaluate(()=>Garden.input.apply({kind:'door'},{x:630,y:460},{},false));
    await page.evaluate(()=>Garden.cottage.update(2,{cameraControl:Garden.cameraControl,night:0}));
    await page.keyboard.down('w');await page.evaluate(()=>{for(let i=0;i<25;i++)Garden.cameraControl.update(.05,true);});await page.keyboard.up('w');
    evidence.interior=await page.evaluate(()=>({inside:Garden.cottage.contains(Garden.cameraControl.player.x,Garden.cameraControl.player.z),player:{...Garden.cameraControl.player},snapshot:Garden.cottage.snapshot()}));assert.equal(evidence.interior.inside,true,'open door lets player enter');
    await page.evaluate(()=>{const p=Garden.cottage.group.localToWorld(new Garden.camera.position.constructor(-.15,.12,-.85));Garden.cameraControl.setPlayer({x:p.x*50+700,y:p.z*50/1.65+650,yaw:.54,pitch:-.10});});await settle();await shot('04-furnished-interior');

    await page.evaluate(()=>{
      Garden.cameraControl.setMode('god');
      const z=-5,x=Garden.largerWorld.brook.centerAt(z),s=Garden.state();
      if(!s.animals.some(a=>a.sp==='cow'))s.animals.push({...s.animals[0],id:s.nextId++,sp:'cow',sex:'f',age:1,x:(x-1.1)*50+700,y:z*50/1.65+650,indoors:false,shelterRequested:false,health:100});
      Garden.bridge.sync(0);Garden.bridge.constrain(0);for(const a of s.animals){const agent=Garden.bridge.agentOf(a.id);if(agent)agent.popIn=false;}Garden.animals.update(1);
      Garden.cameraControl.focus((x-.6)*50+700,z*50/1.65+650,.4,10);
    });await settle();await shot('05-brook-livestock');

    await page.evaluate(()=>{const p=Garden.Sim.BALANCE.waterBodies.pond;Garden.cameraControl.setMode('fp');Garden.cameraControl.setPlayer({x:p.x*50+700,y:p.z*50/1.65+650,pitch:-1.3});for(let i=0;i<360;i++)Garden.cameraControl.update(1/60,true);});
    evidence.swimming=await page.evaluate(()=>({swimming:Garden.cameraControl.player.swimming,underwater:Garden.cameraControl.player.underwater,y:Garden.cameraControl.player.y}));assert.equal(evidence.swimming.swimming,true);assert.equal(evidence.swimming.underwater,true);
    await page.evaluate(()=>{Garden.cameraControl.setMode('god');Garden.cameraControl.setPlayer({x:620,y:700,pitch:0});Garden.cameraControl.focus(700,650,0,32);Garden.hud.toggleInventory(true);});await settle();await shot('06-hotbar-backpack');
    await page.evaluate(()=>{Garden.hud.toggleInventory(false);Garden.shop.open('buy');});await page.waitForFunction(()=>document.querySelector('#shop.open[data-tab=buy]'));await shot('07-market-buy');
    await page.click('#shop .tab.sell');await noLetters();assert.equal(await page.getAttribute('#shop','data-tab'),'sell');

    await page.evaluate(()=>{Garden.shop.close();Garden.hud.toggleInventory(false);Garden.setHour(22);Garden.tutorial.dismiss();Garden.Sim.forcePredator(Garden.state(),'wolf',{x:650,y:740});Garden.game.pump();Garden.cameraControl.focus(650,740,.4,6.5);});await settle();await shot('08-wolf-night');
    evidence.predators=await page.evaluate(()=>Garden.threats.snapshot());assert.ok(evidence.predators.predators>0);

    await page.setViewportSize({width:390,height:844});
    await page.evaluate(()=>{Garden.cameraControl.setMode('fp');Garden.tutorial.dismiss();Garden.hud.toggleInventory(true);});await settle();await noLetters();
    evidence.mobile=await page.evaluate(()=>{const r=document.querySelector('#backpack').getBoundingClientRect(),bar=document.querySelector('#toolbar').getBoundingClientRect();return {panel:{x:r.x,y:r.y,right:r.right,bottom:r.bottom},bar:{x:bar.x,y:bar.y,right:bar.right,bottom:bar.bottom},width:innerWidth,height:innerHeight};});
    assert.ok(evidence.mobile.panel.x>=0&&evidence.mobile.panel.right<=391&&evidence.mobile.panel.bottom<=844,'backpack remains inside mobile safe viewport');
    assert.ok(evidence.mobile.bar.x>=0&&evidence.mobile.bar.right<=391&&evidence.mobile.bar.bottom<=844,'hotbar remains inside mobile safe viewport');
    assert.ok(evidence.mobile.bar.bottom-evidence.mobile.bar.y<110,'hotbar height stays compact');
    await page.setViewportSize({width:844,height:390});await settle();evidence.landscape=await page.evaluate(()=>{const p=document.querySelector('#backpack').getBoundingClientRect(),b=document.querySelector('#toolbar').getBoundingClientRect();return {top:p.top,bottom:p.bottom,barTop:b.top};});assert.ok(evidence.landscape.bottom<evidence.landscape.barTop,'landscape backpack stays clear of hotbar');
    evidence.final=await page.evaluate(()=>({stats:Garden.stats(),schema:Garden.state().schemaVersion,roundTrip:Garden.Sim.loadObject(Garden.Sim.toDoc(Garden.state())).ok}));assert.equal(evidence.final.roundTrip,true);
    assert.deepEqual(logs.errors,[]);
    // SwiftShader's own readback diagnostics also occur during Chromium
    // screenshots; preserve them verbatim and fail on every application warning.
    evidence.driverWarnings=logs.warnings.filter(w=>/^\[\.WebGL-.*GL Driver Message.*GPU stall due to ReadPixels/.test(w));
    assert.deepEqual(logs.warnings.filter(w=>!evidence.driverWarnings.includes(w)),[]);
    assert.deepEqual(logs.failed,[]);assert.deepEqual(logs.http,[]);
    evidence.result=evidence.driverWarnings.length?'pass-with-driver-warnings':'pass';
  } finally {
    fs.writeFileSync(path.join(__dirname,'smoke.json'),JSON.stringify({...evidence,logs},null,2));
    await browser.close();
  }
  console.log('Eight-view SwiftShader behavior smoke passed; any driver readback warnings are preserved in smoke.json.');
})().catch(e=>{console.error(e);process.exitCode=1;});
