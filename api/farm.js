import {blobStore} from '../src/server/stores.js';
import {sharedFarm} from '../src/server/shared-farm.js';
export default async function handler(req,res){
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','application/json');
 if(req.headers.origin){try{if(new URL(req.headers.origin).host!==req.headers.host)return res.status(403).json({ok:false,status:'origin'});}catch{return res.status(403).json({ok:false});}}
 try{let body=req.body;if(body===undefined&&req.method==='POST'){const chunks=[];let size=0;for await(const c of req){size+=c.length;if(size>220000)return res.status(413).json({ok:false,status:'size'});chunks.push(c);}body=Buffer.concat(chunks).toString('utf8');}const out=await sharedFarm({method:req.method,body},blobStore(process.env));return res.status(200).json(out);}catch(error){console.error('Shared farm storage:',error.name,error.message);return res.status(503).json({ok:false,shared:true,status:'offline'});}
}
