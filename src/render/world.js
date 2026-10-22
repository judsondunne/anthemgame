// Rolling terrain and brook are shader surfaces; every solid forest object is a
// downloaded Kenney mesh. Instances use seeded cells, chunk bounds and two LODs.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { model, windTime } from '../../assets.js';
import { WORLD as W } from '../config/world.js';
import { waterAtWorld } from '../sim/water.js';

const smooth = (a, b, x) => { const u = Math.max(0, Math.min(1, (x - a) / (b - a))); return u * u * (3 - 2 * u); };
export const brookX = (z) => W.brook.x + Math.sin(z * .045) * W.brook.meander + Math.sin(z * .115) * 1.9;
export const brookWidth = (z) => W.brook.halfWidth + .30 * Math.sin(z * .09 + 2);
// The narrow ramps create small, continuous rapids instead of a vertical seam.
export function brookHeight(z) {
  let h = .08 + (z + W.radius) * .003;
  for (let step = -64; step < 90; step += 26) h += .12 * smooth(step - .45, step + .45, z);
  return h;
}
export function terrainHeight(x, z) {
  const edge = Math.max(Math.abs(x) - W.property.halfWidth, Math.abs(z) - W.property.halfDepth);
  const blend = smooth(0, W.property.blend, edge);
  const hills = 1.1 + 1.0 * Math.sin(x * .049 + z * .028) + .70 * Math.cos(z * .082 - x * .039) + .35 * Math.sin(x * .15 + z * .11);
  let h = -.035 + Math.max(.03, hills) * blend * 1.8;
  const dist = Math.abs(x - brookX(z));
  const shore = 1 - smooth(brookWidth(z) + .1, brookWidth(z) + W.brook.shoreWidth, dist);
  const bed = brookHeight(z) - .40 + .66 * smooth(.4, brookWidth(z) + 1.0, dist);
  h = THREE.MathUtils.lerp(h, bed, shore);
  const water=waterAtWorld(x,z);
  return water?water.bottom:h;
}
function random(seed) { let x = seed >>> 0; return () => { x += 0x6D2B79F5; let t = Math.imul(x ^ x >>> 15, 1 | x); t ^= t + Math.imul(t ^ t >>> 7, 61 | t); return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
function terrainMaterial() {
  const m = new THREE.MeshStandardMaterial({color: '#859e65', roughness: 1});
  m.onBeforeCompile = (s) => {
    s.uniforms.uTerrainTime=windTime;
    s.vertexShader = 'varying vec3 vTerrain;\n' + s.vertexShader;
    s.vertexShader = s.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n vTerrain=(modelMatrix*vec4(transformed,1.)).xyz;');
    s.fragmentShader = 'uniform float uTerrainTime;varying vec3 vTerrain;\n' + s.fragmentShader;
    s.fragmentShader = s.fragmentShader.replace('#include <color_fragment>', `#include <color_fragment>
      vec2 p=vTerrain.xz;
      float mottles=sin(p.x*.71+sin(p.y*.8))*sin(p.y*.67)*.025+sin(p.x*2.3+p.y*1.1)*.012;
      diffuseColor.rgb+=mottles;
      float creekX=46.+sin(p.y*.045)*7.+sin(p.y*.115)*1.9;
      float bank=1.-smoothstep(1.8,4.9,abs(p.x-creekX));
      vec3 sand=vec3(.37,.34,.25); diffuseColor.rgb=mix(diffuseColor.rgb,sand,bank*.7);
      float underWater=1.-smoothstep(1.05,1.85,abs(p.x-creekX));
      float caustic=pow(.5+.5*sin(p.x*7.+sin(p.y*4.+uTerrainTime*.8))*sin(p.y*8.-uTerrainTime*1.3),5.);
      diffuseColor.rgb+=underWater*caustic*vec3(.12,.21,.12);
      float path=1.-smoothstep(.62,1.20,abs(p.y-8.-sin(p.x*.12)*.45));
      path*=smoothstep(16.,23.,p.x)*(1.-smoothstep(69.,80.,p.x));
      diffuseColor.rgb=mix(diffuseColor.rgb,vec3(.43,.37,.27),path*.5);
    `);
  };
  m.customProgramCacheKey = () => 'rolling-forest-ground-v3';
  return m;
}
function streamGeometry() {
  const positions = [], uv = [], indices = [], n = 240;
  for (let i=0;i<=n;i++) {
    const z = -W.radius + i / n * W.radius * 2, x = brookX(z), h = brookHeight(z), width = brookWidth(z);
    for (let j=0;j<2;j++) { positions.push(x + (j*2-1)*width,h,z); uv.push(j,i/n); }
    if(i<n) { const a=i*2; indices.push(a,a+2,a+1,a+1,a+2,a+3); }
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));
  g.setAttribute('uv',new THREE.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();
  return g;
}
function streamMaterial() {
  const uniforms={uTime:{value:0},uNight:{value:0},uSky:{value:new THREE.Color('#b9d4ca')}};
  const m=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,side:THREE.DoubleSide,
    vertexShader:`varying vec2 vUv;varying vec3 vWorld;void main(){vUv=uv;vWorld=(modelMatrix*vec4(position,1.)).xyz;gl_Position=projectionMatrix*viewMatrix*vec4(vWorld,1.);}`,
    fragmentShader:`uniform float uTime;uniform float uNight;uniform vec3 uSky;varying vec2 vUv;varying vec3 vWorld;
    float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453123);}
    void main(){
      vec2 p=vWorld.xz;float t=uTime;
      float shore=abs(vUv.x-.5)*2.;
      float a=sin(p.y*5.3+t*2.4+sin(p.x*3.2))*sin(p.x*4.4-t*.51);
      float b=sin(p.y*11.+t*3.6+p.x*1.9)*.35;
      float flow=sin(vUv.y*1100.+t*4.8+sin(vUv.x*30.))*sin(vUv.x*23.+t*.8);
      float eddy=sin(length(vec2(vUv.x-.32,fract(vUv.y*13.)-.5))*42.-t*3.);
      vec3 deep=vec3(.11,.30,.30),shallow=vec3(.28,.51,.45);
      vec3 color=mix(deep,shallow,smoothstep(.12,.95,shore));
      color+=vec3(.05,.11,.10)*(a+b);
      vec3 eye=normalize(cameraPosition-vWorld);float fresnel=pow(1.-max(eye.y,0.),3.);
      color=mix(color,uSky,.14+fresnel*.48);
      float edgeFoam=smoothstep(.80,.99,shore)*smoothstep(.05,.84,sin(vUv.y*540.+t*1.7)+flow*.3);
      float rapids=0.;
      for(int i=0;i<6;i++){float z=-64.+float(i)*26.;rapids+=1.-smoothstep(.1,1.4,abs(p.y-z));}
      float whitewater=rapids*smoothstep(-.05,.68,flow+a*.35);
      float foam=max(edgeFoam*.53,whitewater*.85);
      color=mix(color,vec3(.80,.89,.78),foam);
      float glint=pow(max(0.,sin(p.y*17.1+p.x*8.2+t*1.5)*sin(p.x*14.7-p.y*5.9+t*.7)),48.);
      color+=glint*vec3(1.,.93,.67)*.55*(1.-uNight*.94);
      color+=max(0.,eddy-.88)*vec3(.08,.15,.12);
      color*=mix(1.,.18,uNight);
      float alpha=mix(.80,.56,smoothstep(.80,1.,shore));
      gl_FragColor=vec4(color,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
    }`});
  return m;
}

export function createWorld({scene,camera,quality='high',seed=W.seed}={}) {
  const group=new THREE.Group();group.name='Living forest and brook';scene.add(group);
  const rng=random(Number(seed)||W.seed),colliders=[],chunks=[];
  let low=quality==='low';
  const terrain=new THREE.PlaneGeometry(W.radius*2,W.radius*2,W.terrainSegments,W.terrainSegments);
  terrain.rotateX(-Math.PI/2);
  const pos=terrain.attributes.position;
  for(let i=0;i<pos.count;i++)pos.setY(i,terrainHeight(pos.getX(i),pos.getZ(i)));
  terrain.computeVertexNormals();
  const ground=new THREE.Mesh(terrain,terrainMaterial());ground.receiveShadow=true;group.add(ground);
  const waterMaterial=streamMaterial(),water=new THREE.Mesh(streamGeometry(),waterMaterial);water.name='Flowing brook';water.renderOrder=2;group.add(water);

  const batches=new Map();
  function scatter(name,x,z,size,heading=0,category='tree',stretch=1) {
    const chunkX=Math.floor((x+W.radius)/W.forest.chunkSize),chunkZ=Math.floor((z+W.radius)/W.forest.chunkSize);
    const key=`${chunkX}:${chunkZ}:${name}`;
    if(!batches.has(key))batches.set(key,{name,category,cx:(chunkX+.5)*W.forest.chunkSize-W.radius,cz:(chunkZ+.5)*W.forest.chunkSize-W.radius,placements:[]});
    batches.get(key).placements.push({x,z,y:terrainHeight(x,z),size,heading,stretch,color:new THREE.Color().setHSL(.25+rng()*.06,.10+rng()*.11,.77+rng()*.18)});
  }
  const trees=['forest_fir','forest_fir_b','forest_fir_c','forest_fir_b','forest_leaf_tree','forest_leaf_tree_b'];
  const spacing=W.forest.spacing;
  let treeCount=0;
  for(let z=-W.radius+3;z<W.radius-3;z+=spacing)for(let x=-W.radius+3;x<W.radius-3;x+=spacing){
    const px=x+(rng()-.5)*spacing*W.forest.jitter,pz=z+(rng()-.5)*spacing*W.forest.jitter;
    const edge=Math.max(Math.abs(px)-W.property.halfWidth,Math.abs(pz)-W.property.halfDepth);
    if(edge<3.0||Math.abs(px-brookX(pz))<brookWidth(pz)+3.6)continue;
    if(Math.abs(pz-8.-Math.sin(px*.12)*.45)<2.5&&px>19&&px<80)continue;
    const clearing=Math.hypot(px+49,pz+30)<8||Math.hypot(px-16,pz-51)<7;
    if(clearing||rng()>(.52+.46*smooth(2,25,edge)))continue;
    const species=trees[Math.floor(rng()*trees.length)],height=4.5+rng()*3.7+(species.includes('Tall')?1.2:0);
    scatter(species,px,pz,height,rng()*Math.PI*2);colliders.push({x:px,z:pz,radius:.29+height*.025,type:'tree'});treeCount++;
  }
  const plants=['forest_shrub','forest_plant','forest_fern','forest_clover','forest_mushroom','forest_rock','forest_boulder','forest_stump'];
  const bushStep=W.forest.undergrowthSpacing*(low?1.45:1);
  for(let z=-W.radius+4;z<W.radius-4;z+=bushStep)for(let x=-W.radius+4;x<W.radius-4;x+=bushStep){
    const px=x+(rng()-.5)*bushStep,pz=z+(rng()-.5)*bushStep;
    if(Math.max(Math.abs(px)-W.property.halfWidth,Math.abs(pz)-W.property.halfDepth)<3||Math.abs(px-brookX(pz))<brookWidth(pz)+1.9||rng()>.52)continue;
    if(px>18&&Math.abs(pz-8.)<2.5)continue;
    const choice=rng(),n=choice<.28?0:choice<.43?1:choice<.61?2:choice<.73?3:choice<.82?4:5+Math.floor(rng()*3),name=plants[n];
    const height=n<2?.4+rng()*.7:n<5?.18+rng()*.4:n===7?.35+rng()*.25:.45+rng()*.8;
    scatter(name,px,pz,height,rng()*Math.PI*2,'under');
    if(n>=5)colliders.push({x:px,z:pz,radius:height*.5,top:terrainHeight(px,pz)+height,baseY:terrainHeight(px,pz),type:n===7?'stump':'rock'});
  }
  // Downloaded bank stones anchor the water and emphasize narrow whitewater runs.
  for(let i=0;i<W.brook.rocks;i++){
    const z=-W.radius+4+rng()*(W.radius*2-8),side=rng()<.5?-1:1;
    if(Math.abs(z-W.brook.crossingZ)<2.4)continue;
    const x=brookX(z)+side*(brookWidth(z)+.15+rng()*1.3),h=.3+rng()*.65;
    scatter(i%3?'forest_rock':'forest_boulder',x,z,h,rng()*6.28,'rock');
    colliders.push({x,z,radius:h*.45,top:terrainHeight(x,z)+h,baseY:terrainHeight(x,z),type:'rock'});
  }
  // Tree-root pockets layer ferns, mushrooms, clover and wispy grass under
  // clear canopy edges. Open meadow and the crossing path remain readable.
  const trunks=colliders.filter(c=>c.type==='tree');
  for(let i=0;i<trunks.length;i+=3){const trunk=trunks[i];for(let j=0;j<3;j++){
    const angle=rng()*Math.PI*2,r=1.0+rng()*1.3,x=trunk.x+Math.cos(angle)*r,z=trunk.z+Math.sin(angle)*r;
    if(Math.abs(x-brookX(z))<brookWidth(z)+1.3)continue;
    scatter(['forest_fern','forest_grass_wispy','forest_clover'][j],x,z,.20+rng()*.5,angle,'under');
  }}
  const dummy=new THREE.Object3D(),geometryCache=new Map();
  // Bake source material colours into source mesh vertices, then instance each
  // asset in one draw per chunk. The downloaded topology stays unchanged.
  const forestMaterial=new THREE.MeshStandardMaterial({vertexColors:true,roughness:.92,metalness:0});
  forestMaterial.onBeforeCompile=(shader)=>{
    shader.uniforms.uWindTime=windTime;
    shader.vertexShader='uniform float uWindTime;attribute float aForestSway;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
      float forestPhase=0.;
      #ifdef USE_INSTANCING
        forestPhase=instanceMatrix[3].x*.83+instanceMatrix[3].z*.59;
      #endif
      transformed.x+=sin(uWindTime*1.15+forestPhase+position.y*3.1)*aForestSway*.022;
      transformed.z+=cos(uWindTime*.87+forestPhase)*aForestSway*.009;
    `);
  };
  forestMaterial.customProgramCacheKey=()=> 'instanced-forest-wind-v3';
  function sourceGeometry(name){
    if(geometryCache.has(name))return geometryCache.get(name);
    const template=model(name,{height:1});template.updateMatrixWorld(true);const parts=[];
    template.traverse((mesh)=>{
      if(!mesh.isMesh)return;
      const geometry=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);
      for(const attribute of Object.keys(geometry.attributes))if(!['position','normal'].includes(attribute))geometry.deleteAttribute(attribute);
      const count=geometry.attributes.position.count,colors=new Float32Array(count*3),sway=new Float32Array(count);
      const color=mesh.material.color,leaf=/leaf|grass|plant/.test(mesh.material.name);
      for(let i=0;i<count;i++){
        colors.set([color.r,color.g,color.b],i*3);
        sway[i]=leaf?Math.max(0,geometry.attributes.position.getY(i)):0;
      }
      geometry.setAttribute('color',new THREE.BufferAttribute(colors,3));geometry.setAttribute('aForestSway',new THREE.BufferAttribute(sway,1));parts.push(geometry);
    });
    const geometry=mergeGeometries(parts,false);parts.forEach(g=>g.dispose());geometryCache.set(name,geometry);return geometry;
  }
  function instances(entry,name,simplified=false){
    const result=new THREE.Group();
    let parts;
    if(name.startsWith('forest_fir')||name.startsWith('forest_leaf_tree')){
      const key='merged-textured:'+name;
      if(!geometryCache.has(key)){
        const template=model(name,{height:1});template.updateMatrixWorld(true);const geometries=[];let bark=null,leaves=null;
        template.traverse(mesh=>{if(!mesh.isMesh)return;const foliage=mesh.material.alphaTest>0;if(foliage)leaves=mesh.material.map;else bark=mesh.material.map;
          const g=mesh.geometry.clone().applyMatrix4(mesh.matrixWorld);for(const a of Object.keys(g.attributes))if(!['position','normal','uv'].includes(a))g.deleteAttribute(a);g.setAttribute('aForestPart',new THREE.Float32BufferAttribute(new Float32Array(g.attributes.position.count).fill(foliage?1:0),1));geometries.push(g);});
        const geometry=mergeGeometries(geometries,false);geometries.forEach(g=>g.dispose());
        const material=new THREE.MeshStandardMaterial({map:bark??leaves,color:'#edf0df',roughness:.83,alphaTest:.42,side:THREE.DoubleSide});
        material.onBeforeCompile=shader=>{shader.uniforms.uWindTime=windTime;shader.uniforms.uFoliageMap={value:leaves??bark};shader.vertexShader='uniform float uWindTime;attribute float aForestPart;varying float vForestPart;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
          vForestPart=aForestPart;float phase=instanceMatrix[3].x*.67+instanceMatrix[3].z*.43;transformed.x+=sin(uWindTime*.9+phase+position.y*2.)*pow(max(0.,position.y),2.)*.012;
        `);shader.fragmentShader='uniform sampler2D uFoliageMap;varying float vForestPart;\n'+shader.fragmentShader;shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>',`#ifdef USE_MAP
          vec4 sampledDiffuseColor=mix(texture2D(map,vMapUv),texture2D(uFoliageMap,vMapUv),vForestPart);diffuseColor*=sampledDiffuseColor;
        #endif`);};material.customProgramCacheKey=()=> 'detailed-tree-single-draw-v1';
        const depth=new THREE.MeshDepthMaterial({depthPacking:THREE.RGBADepthPacking,map:bark??leaves,alphaTest:.42,side:THREE.DoubleSide});depth.onBeforeCompile=material.onBeforeCompile;depth.customProgramCacheKey=()=> 'detailed-tree-depth-v1';
        const distance=new THREE.MeshDistanceMaterial({map:bark??leaves,alphaTest:.42,side:THREE.DoubleSide});distance.onBeforeCompile=material.onBeforeCompile;distance.customProgramCacheKey=()=> 'detailed-tree-distance-v1';
        geometryCache.set(key,[{geometry,material,depth,distance}]);
      }parts=geometryCache.get(key);
    }else if(name.startsWith('forest_')){
      const cacheKey='textured:'+name;
      if(!geometryCache.has(cacheKey)){
        const template=model(name,{height:1});template.updateMatrixWorld(true);const list=[];
        template.traverse(mesh=>{if(!mesh.isMesh)return;const material=mesh.material.clone();material.color.set('#edf0df');material.roughness=.83;
          if(material.transparent){material.alphaTest=.42;material.transparent=false;material.side=THREE.DoubleSide;}
          material.onBeforeCompile=shader=>{shader.uniforms.uWindTime=windTime;shader.vertexShader='uniform float uWindTime;\n'+shader.vertexShader;shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>',`#include <begin_vertex>
            float phase=instanceMatrix[3].x*.67+instanceMatrix[3].z*.43;
            transformed.x+=sin(uWindTime*.9+phase+position.y*2.)*pow(max(0.,position.y),2.)*.012;
          `);if(name==='forest_shrub')shader.fragmentShader=shader.fragmentShader.replace('#include <map_fragment>','#include <map_fragment>\n float leafLight=clamp(diffuseColor.r*1.2+diffuseColor.g,0.,1.);diffuseColor.rgb=mix(vec3(.09,.17,.07),vec3(.35,.49,.20),leafLight);');};material.customProgramCacheKey=()=> 'detailed-canopy-v5'+(name==='forest_shrub'?'sage':'');
          list.push({geometry:mesh.geometry.clone().applyMatrix4(mesh.matrixWorld),material});});geometryCache.set(cacheKey,list);
      }parts=geometryCache.get(cacheKey);
    }else parts=[{geometry:sourceGeometry(name),material:forestMaterial}];
    for(const part of parts){const im=new THREE.InstancedMesh(part.geometry,part.material,entry.placements.length);im.castShadow=entry.category==='tree'&&!low&&!simplified;im.receiveShadow=!simplified;if(part.depth)im.customDepthMaterial=part.depth;if(part.distance)im.customDistanceMaterial=part.distance;
      entry.placements.forEach((p,i)=>{dummy.position.set(p.x,p.y,p.z);dummy.rotation.set(0,p.heading,0);dummy.scale.set(p.size,p.size*p.stretch,p.size);dummy.updateMatrix();im.setMatrixAt(i,dummy.matrix);if(entry.category==='tree')im.setColorAt(i,new THREE.Color().setRGB(.94+(i%3)*.015,.97,.89+(i%4)*.018));});im.computeBoundingSphere();result.add(im);
    }return result;
  }
  const farBatches=new Map();
  for(const entry of batches.values()){
    const near=instances(entry,entry.name);group.add(near);
    chunks.push({...entry,near,far:null});
    if(entry.category==='tree'){
      const name=entry.name,key=`${entry.cx}:${entry.cz}:${name}`;
      if(!farBatches.has(key))farBatches.set(key,{...entry,name,placements:[]});
      farBatches.get(key).placements.push(...entry.placements);
    }
  }
  // Preserve the original textured tree silhouettes at every distance, as
  // requested. Chunk visibility still limits distant draws and shadows.
  for(const entry of farBatches.values()){const far=instances(entry,entry.name,true);group.add(far);chunks.push({...entry,near:null,far});}
  const bridge=model('bridge_wood',{width:brookWidth(W.brook.crossingZ)*2+2.1});
  bridge.name='Brook crossing';bridge.position.set(brookX(W.brook.crossingZ),brookHeight(W.brook.crossingZ)-.09,W.brook.crossingZ);group.add(bridge);
  const particlesCount=low?W.particles.low:W.particles.high,particlePositions=new Float32Array(particlesCount*3),particleSeeds=[];
  for(let i=0;i<particlesCount;i++){
    const x=(rng()-.5)*130,z=(rng()-.5)*130,y=terrainHeight(x,z)+.6+rng()*3;
    particlePositions.set([x,y,z],i*3);particleSeeds.push({x,y,z,phase:rng()*6.28,speed:.1+rng()*.15});
  }
  const pg=new THREE.BufferGeometry();pg.setAttribute('position',new THREE.BufferAttribute(particlePositions,3));
  const pm=new THREE.PointsMaterial({color:'#fff0ac',size:.055,transparent:true,opacity:.24,depthWrite:false,blending:THREE.AdditiveBlending});
  const fireflies=new THREE.Points(pg,pm);group.add(fireflies);
  let elapsed=0,lodAt=-1,nightValue=0;
  const nearLimit=W.forest.nearDistance,farLimit=W.forest.farDistance;
  function update(dt,context={}) {
    elapsed+=dt;const cam=context.camera??camera;
    nightValue=context.night??nightValue;
    waterMaterial.uniforms.uTime.value=elapsed;waterMaterial.uniforms.uNight.value=nightValue;
    if(cam&&elapsed-lodAt>.35){
      lodAt=elapsed;
      for(const c of chunks){
        const d=Math.hypot(cam.position.x-c.cx,cam.position.z-c.cz);
        if(c.near)c.near.visible=d<(c.category==='tree'?(low?nearLimit*.72:nearLimit):(low?W.forest.lowUndergrowthDistance:W.forest.highUndergrowthDistance));
        if(c.far)c.far.visible=d>=(low?nearLimit*.72:nearLimit)&&d<(low?farLimit*.8:farLimit);
        for(const mesh of c.near?.children??[])mesh.castShadow=c.category==='tree'&&!low&&d<W.forest.shadowDistance;
      }
    }
    const array=pg.attributes.position.array;
    for(let i=0;i<particleSeeds.length;i++){
      const s=particleSeeds[i];array[i*3]=s.x+Math.sin(elapsed*.24+s.phase)*.8;array[i*3+1]=s.y+Math.sin(elapsed*s.speed+s.phase)*.35;array[i*3+2]=s.z+Math.cos(elapsed*.18+s.phase)*.5;
    }
    pg.attributes.position.needsUpdate=true;pm.opacity=.10+nightValue*.68;pm.size=.035+nightValue*.035;
    return {trees:treeCount,chunks:chunks.length};
  }
  function distanceTo(x,z){return Math.abs(x-brookX(z))-brookWidth(z);}
  function isBlocked(x,z,radius=.24,feetY=0){
    if(Math.abs(x)>W.radius-2||Math.abs(z)>W.radius-2)return true;
    return colliders.some(c=>(c.top==null||feetY<c.top-.06)&&(x-c.x)**2+(z-c.z)**2<(radius+c.radius)**2);
  }
  function heightAt(x,z){
    if(Math.abs(z-W.brook.crossingZ)<W.brook.crossingHalfDepth&&distanceTo(x,z)<1.2)return brookHeight(W.brook.crossingZ)+.17;
    return terrainHeight(x,z);
  }
  function setQuality(value) {
    low = value === 'low';
    pg.setDrawRange(0, low ? Math.min(W.particles.low, particlesCount) : particlesCount);
    lodAt = -1;
  }
  update(0);
  return {group,update,setQuality,heightAt,isBlocked,colliders,brook:{distanceTo,centerAt:brookX,heightAt:brookHeight,crossing:{x:brookX(W.brook.crossingZ),z:W.brook.crossingZ}},stats:{trees:treeCount,chunks:chunks.length}};
}
