import {createServer} from 'node:http';
import {readFile,stat} from 'node:fs/promises';
import {join,extname,resolve,sep} from 'node:path';

const root=resolve(import.meta.dirname,'..');
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.jpg':'image/jpeg','.jpeg':'image/jpeg','.png':'image/png','.mp3':'audio/mpeg'};
export async function startServer(port=0){
  const server=createServer(async(req,res)=>{
    try{
      const path=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=resolve(root,'.'+(path==='/'?'/index.html':path));
      if(file!==root&&!file.startsWith(root+sep))throw new Error('outside project');
      const s=await stat(file);if(!s.isFile())throw new Error('not file');
      res.writeHead(200,{'Content-Type':types[extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});
      res.end(await readFile(file));
    }catch{res.writeHead(404);res.end('Not found')}
  });
  await new Promise((ok,fail)=>server.once('error',fail).listen(port,'127.0.0.1',ok));
  return {server,url:`http://127.0.0.1:${server.address().port}`};
}
