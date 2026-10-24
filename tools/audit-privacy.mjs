// Local-only audit. Prints categories and relative filenames, never values.
import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative,extname} from 'node:path';
const root=resolve(process.argv[2]||'.');
const findings=[];let files=0,bytes=0;
const patterns=[
  ['private profile path',/[A-Za-z]:[\\/]Users[\\/][A-Za-z0-9_.-]+/i],
  ['GitHub credential',/(?:ghp_[A-Za-z0-9]{30,}|github_pat_[A-Za-z0-9_]{30,})/],
  ['private key',/-----BEGIN (?:RSA |OPENSSH |EC )?PRIVATE KEY-----/],
  ['internal context',/(?:system[_]prompt|tool[_]call[_]id|codex[-]clipboard|\.codex[\\/]|rollout[_]summaries)/i],
  ['live secret assignment',/(?:api[_-]?key|access[_-]?token|client[_-]?secret)\s*[:=]\s*["'][A-Za-z0-9_+/-]{24,}["']/i]
];
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  if(['.git','node_modules'].includes(entry.name))continue;
  const file=resolve(dir,entry.name),name=relative(root,file).replaceAll('\\','/');
  if(entry.isSymbolicLink()){findings.push({file:name,type:'symlink requires manual review'});continue;}
  if(entry.isDirectory()){await walk(file);continue;}
  if(!entry.isFile())continue;
  files++;const data=await readFile(file);bytes+=data.length;
  // Windows executables and model metadata may contain UTF-16 strings.
  const strings=[data.toString('utf8'),data.toString('utf16le')];
  for(const [type,pattern]of patterns)if(strings.some(s=>pattern.test(s)))findings.push({file:name,type});
  if(/^\.env(?:\.|$)/.test(entry.name)&&entry.name!=='.env.example')findings.push({file:name,type:'environment file'});
  if(['.log','.pdb','.map'].includes(extname(file)))findings.push({file:name,type:'debug artifact requires review'});
 }
}
await walk(root);
console.log(JSON.stringify({status:findings.length?'REVIEW_REQUIRED':'PASS',files,bytes,findings,scope:'Local file scan of UTF-8 and UTF-16, known credential/path/context patterns. Not a proof against every possible secret format; manual package and image review is also required.'},null,2));
if(findings.length)process.exitCode=1;
