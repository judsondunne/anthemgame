import * as THREE from 'three';
import { VISUAL } from '../config/visual.js';
// Allowed grass surface geometry: curved, tapered blades grow in irregular
// tufts, with shared root shade and sunlit tips rather than flat confetti cards.
export function meadowGeometry(){
 const positions=[],uvs=[],colors=[],indices=[];
 let seed=731;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
 for(let b=0;b<VISUAL.grass.blades;b++){
  const angle=rand()*Math.PI*2,r=rand()*.055,x=Math.cos(angle)*r,z=Math.sin(angle)*r,h=VISUAL.grass.height*(.65+rand()*.75),width=VISUAL.grass.width*(.65+rand()*.65),bend=.03+rand()*.055;
  const cx=Math.cos(angle),cz=Math.sin(angle),offset=positions.length/3,tone=.88+rand()*.18;
  for(let j=0;j<=3;j++){const t=j/3,w=width*(1-t)*.5,curve=t*t*bend;
   for(const side of [-1,1]){positions.push(x+cx*curve-cz*w*side,h*t,z+cz*curve+cx*w*side);uvs.push((side+1)/2,t);colors.push(tone*(.63+t*.31),tone*(.74+t*.26),tone*(.47+t*.24));}}
  for(let j=0;j<3;j++){const i=offset+j*2;indices.push(i,i+2,i+1,i+1,i+2,i+3);}
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setAttribute('uv',new THREE.Float32BufferAttribute(uvs,2));g.setAttribute('color',new THREE.Float32BufferAttribute(colors,3));g.setIndex(indices);g.computeVertexNormals();return g;
}
