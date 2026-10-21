// Seeded scene collider data is injected once at bootstrap. The index is a
// transient, deterministic input to the pure sim and is rebuilt after loading.
const CELL=200;
export function setWorldColliders(s,records=[]){const cells=new Map();for(const c of records){const key=`${Math.floor(c.x/CELL)},${Math.floor(c.y*1.65/CELL)}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(c);}Object.defineProperty(s,'worldCollision',{value:{cells},enumerable:false,configurable:true,writable:true});return {ok:true,count:records.length};}
export function worldCollisionAt(s,x,y,r=0){const cells=s.worldCollision?.cells;if(!cells)return false;const gx=Math.floor(x/CELL),gy=Math.floor(y*1.65/CELL);for(let j=-1;j<=1;j++)for(let i=-1;i<=1;i++)for(const c of cells.get(`${gx+i},${gy+j}`)??[])if(Math.hypot(x-c.x,(y-c.y)*1.65)<c.r+r)return true;return false;}
