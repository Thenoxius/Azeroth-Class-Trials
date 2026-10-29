import fs from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';
const root=fileURLToPath(new URL('../',import.meta.url));const html=fs.readFileSync(path.join(root,'dist/preview.html'),'utf8');
if(!/<!doctype html>/i.test(html)||!html.includes('<html'))throw Error('Standalone HTML required');
if(/(?:src|href)=["'](?:file:|[A-Z]:\\|\/assets\/)/i.test(html))throw Error('Local or root-dependent asset reference');
const out=path.join(root,'site-preview');fs.mkdirSync(out,{recursive:true});fs.writeFileSync(path.join(out,'index.html'),html);fs.writeFileSync(path.join(out,'.nojekyll'),'');
console.log('Prepared site-preview/index.html. Local only; nothing uploaded or published.');
