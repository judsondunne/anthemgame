// Focused verification entrypoint; one browser smoke after unit/build/asset gates.
const { spawnSync, spawn }=require('node:child_process');
const root=require('node:path').resolve(__dirname,'../..');
function run(cmd,args){const r=spawnSync(cmd,args,{cwd:root,stdio:'inherit',env:process.env});if(r.status!==0)process.exit(r.status||1);}
run('npm',['test']);run('npm',['run','build']);run('node',['scripts/audit-assets.cjs']);
(async()=>{const port=process.env.PORT||'8097',url=process.env.FARM_URL||'http://127.0.0.1:'+port;let server;
try{
 if(!process.env.FARM_URL){server=spawn(process.execPath,['scripts/serve.js'],{cwd:root,stdio:'inherit',env:{...process.env,PORT:port}});for(let i=0;i<30;i++){try{if((await fetch(url)).ok)break;}catch{}await new Promise(r=>setTimeout(r,100));}}
 const smoke=spawn(process.execPath,['verification/v5/smoke.cjs'],{cwd:root,stdio:'inherit',env:{...process.env,FARM_URL:url}});process.exitCode=await new Promise(r=>smoke.on('exit',code=>r(code||0)));
}finally{server?.kill();}})().catch(e=>{console.error(e);process.exitCode=1;});
