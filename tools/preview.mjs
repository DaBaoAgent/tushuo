import {startServer} from './server.mjs';
const {url}=await startServer(Number(process.env.PORT)||4173);
console.log(`预览地址：${url}`);
