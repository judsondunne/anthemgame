import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CAMERA as C } from '../src/config/camera.js';
import { toLogical, toWorld, damp, zoomDistance, blockedByFarm, blockedByFences, createCameraController } from '../src/game/camera.js';

const empty = () => ({ buildings: [], beds: [], fences: [], player: { mode: 'god', x: 620, y: 700, yaw: 0, pitch: 0 } });
test('logical coordinates round-trip without moving the established property', () => {
  for (const [x,y] of [[700,650],[-1000,905],[2400,580],[620,700]]) { const p=toWorld(x,y), q=toLogical(p.x,p.z); assert.ok(Math.abs(q.x-x)<1e-9); assert.ok(Math.abs(q.y-y)<1e-9); }
});
test('camera damping is frame-rate independent and zoom covers close and wide views', () => {
  let a=0,b=0;for(let i=0;i<60;i++)a=damp(a,10,11,1/60);for(let i=0;i<30;i++)b=damp(b,10,11,1/30);
  assert.ok(Math.abs(a-b)<1e-10);assert.equal(zoomDistance(35,-10000),C.minDistance);assert.equal(zoomDistance(35,10000),C.maxDistance);
});
test('player collision covers house, pond, buildings, beds and open/closed gates', () => {
  const s=empty();
  for (const [x,y] of [[620,450],[999,626],[320,800]]) { const p=toWorld(x,y); assert.equal(blockedByFarm(s,p.x,p.z),true); }
  const path=toWorld(630,700);assert.equal(blockedByFarm(s,path.x,path.z),false,'the path is walkable');
  s.buildings.push({id:1,type:'barn',gx:-20,gy:25});let p=toWorld(-700,650);assert.equal(blockedByFarm(s,p.x,p.z),true);
  s.fences=[{id:2,gx:15,gy:28,axis:'h',gate:true,open:false}];p=toWorld(620,28*40/1.65);assert.equal(blockedByFences(s,p.x,p.z),true);s.fences[0].open=true;assert.equal(blockedByFences(s,p.x,p.z),false);
});

class Node extends EventTarget {
  constructor(){super();this.style={};this.classList={toggle(){}};this.hidden=false;this.tagName='DIV';this.nodes=new Map();this.captured=new Set();}
  append(){} remove(){} getBoundingClientRect(){return {left:0,top:0,width:1440,height:900};}
  querySelector(k){if(!this.nodes.has(k))this.nodes.set(k,new Node());return this.nodes.get(k);}
  setPointerCapture(id){this.captured.add(id);}hasPointerCapture(id){return this.captured.has(id);}
}
function setup(params='') {
  globalThis.innerWidth=1440;globalThis.innerHeight=900;globalThis.window=new Node();globalThis.document=new Node();document.documentElement=new Node();document.body=new Node();document.hidden=false;document.createElement=()=>new Node();
  const canvas=new Node(),camera=new THREE.PerspectiveCamera(48,1.6,.035,430),game={state:empty()},Farm={targetPan:0,pan:0,held:0},view={};
  const c=createCameraController({camera,canvas,game,Farm,view,params:new URLSearchParams(params)});
  return {c,canvas,camera,game};
}
function event(node,type,fields={}){const e=new Event(type,{cancelable:true});Object.assign(e,fields);node.dispatchEvent(e);return e;}
function frames(c,n=120){for(let i=0;i<n;i++)c.update(1/60);}

test('mouse drag orbits only after threshold; releasing preserves decaying inertia',()=>{
  const {c,canvas}=setup();const initial=c.snapshot();event(canvas,'pointerdown',{pointerId:1,clientX:100,clientY:100,button:0,pointerType:'mouse'});event(canvas,'pointermove',{pointerId:1,clientX:103,clientY:100});assert.equal(c.gestureConsumed,false);event(canvas,'pointermove',{pointerId:1,clientX:160,clientY:135});assert.equal(c.gestureConsumed,true);c.update(1/60);assert.notEqual(c.snapshot().targetYaw,initial.yaw);assert.notEqual(c.snapshot().targetPitch,initial.pitch);event(canvas,'pointerup',{pointerId:1});const before=c.snapshot();c.update(1/60);const after=c.snapshot();assert.ok(Math.abs(after.velocity.x)<Math.abs(before.velocity.x));assert.notEqual(after.targetYaw,before.targetYaw);c.destroy();
});
test('wheel pan, wheel zoom, ctrl pinch and browser gesture events are consumed',()=>{
  const {c,canvas}=setup();let e=event(canvas,'wheel',{deltaX:100,deltaY:0,deltaMode:0,clientX:600,clientY:400,ctrlKey:false});assert.equal(e.defaultPrevented,true);frames(c);assert.notEqual(c.snapshot().focus[0],0);
  e=event(canvas,'wheel',{deltaX:0,deltaY:-100000,deltaMode:0,clientX:600,clientY:400,ctrlKey:true});assert.equal(e.defaultPrevented,true);frames(c);assert.ok(c.snapshot().distance<C.minDistance+.01);
  event(canvas,'wheel',{deltaX:0,deltaY:100000,deltaMode:0,clientX:600,clientY:400,ctrlKey:false});frames(c);assert.ok(c.snapshot().distance>C.maxDistance-.01);
  for(const type of ['gesturestart','gesturechange','gestureend'])assert.equal(event(document,type).defaultPrevented,true);c.destroy();
});
test('touch swipe pans and two fingers pinch without triggering a tap',()=>{
  const {c,canvas}=setup();event(canvas,'pointerdown',{pointerId:1,clientX:300,clientY:300,pointerType:'touch',button:0});event(canvas,'pointermove',{pointerId:1,clientX:370,clientY:330,pointerType:'touch'});assert.equal(c.gestureConsumed,true);const p=c.snapshot().focusTarget;assert.notEqual(p[0],0);
  event(canvas,'pointerdown',{pointerId:2,clientX:500,clientY:300,pointerType:'touch',button:0});event(canvas,'pointermove',{pointerId:1,clientX:350,clientY:330,pointerType:'touch'});event(canvas,'pointermove',{pointerId:2,clientX:600,clientY:300,pointerType:'touch'});assert.ok(c.snapshot().targetDistance<C.defaultDistance);c.destroy();
});
test('first person accelerates, sprints, jumps, and stops against the house',()=>{
  const {c,canvas,camera,game}=setup('mode=fp');c.setPlayer({x:640,y:570,yaw:0,pitch:0});event(window,'keydown',{code:'KeyW',key:'w'});frames(c,150);const stopped=game.state.player;assert.ok(stopped.y>522,'cannot cross the cottage wall');event(window,'keyup',{code:'KeyW'});frames(c,30);const y=c.player.y;c.jump();frames(c,8);assert.ok(c.player.y>y);frames(c,80);assert.equal(c.player.grounded,true);assert.ok(Math.abs(camera.position.y-(c.player.y+C.eyeHeight))<.05);
  c.setPlayer({x:620,y:700,yaw:0,pitch:0});event(window,'keydown',{code:'KeyD',key:'d'});frames(c,30);const walk=c.player.vx;event(window,'keydown',{code:'ShiftLeft',key:'Shift'});frames(c,30);assert.ok(c.player.vx>walk);event(window,'blur');frames(c,120);assert.ok(Math.abs(c.player.vx)<.01);assert.equal(game.state.player.mode,'fp');c.destroy();
});
test('rapid mode switches and focus preserve player state; presets retain their framing',()=>{
  const {c,game}=setup('cam=wide');assert.equal(c.snapshot().targetDistance,130);for(let i=0;i<12;i++)c.toggle();c.setMode('fp');c.setPlayer({x:800,y:700,yaw:.5,pitch:-.3});c.setMode('god');c.focus(900,700,.5,6);frames(c);assert.equal(game.state.player.x,800);assert.ok(Math.abs(c.snapshot().distance-6)<.01);c.destroy();
});

test('swimming uses buoyancy, keeps a stable floor and permits a camera dip',()=>{
  const {c}=setup('mode=fp');
  c.setWorldGeometry({terrainHeight:()=>-1.5,blocked:()=>false,waterAt:()=>({surface:.1,bottom:-1.5,depth:1.6})});
  c.setPlayer({x:700,y:1050,pitch:0});frames(c,360);
  assert.equal(c.player.swimming,true);assert.ok(c.player.y> -1.1 && c.player.y<-.8);
  assert.equal(c.player.underwater,false);assert.ok(c.player.y>=-1.5,'never falls through the bottom');
  c.setPlayer({x:700,y:1050,pitch:-1.3});frames(c,360);
  assert.equal(c.player.underwater,true);c.jump();frames(c,6);assert.ok(c.player.vy>0);c.destroy();
});
