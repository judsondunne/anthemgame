'use strict';
const canvas=document.querySelector('canvas');
const view={x:0,y:0,scale:1,dpr:Math.min(devicePixelRatio,2),w:innerWidth,h:innerHeight};
const params=new URLSearchParams(location.search);
let randomSeed=Number(params.get('seed')??1247)>>>0;
function rand(){randomSeed=(randomSeed*1664525+1013904223)>>>0;return randomSeed/4294967296;}
const Camera3D={xx:Math.cos(28*Math.PI/180),zx:-Math.sin(28*Math.PI/180),xy:Math.sin(28*Math.PI/180)*Math.sin(35*Math.PI/180),zy:Math.cos(28*Math.PI/180)*Math.sin(35*Math.PI/180)};
function project3(x,z,h=0){return{x:Camera3D.xx*x+Camera3D.zx*z,y:Camera3D.xy*x+Camera3D.zy*z-Math.cos(35*Math.PI/180)*h};}
