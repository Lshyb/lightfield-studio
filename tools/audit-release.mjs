// A pinned file inventory, separate from copyright interpretation and approval.
// This command never uploads, modifies a manifest, or accepts new files itself.
import {readdir,readFile} from 'node:fs/promises';
import {resolve,relative} from 'node:path';
import {createHash} from 'node:crypto';
const root=resolve(process.argv.find((a,i)=>i>1&&!a.startsWith('--'))||'.');
const publicMode=process.argv.includes('--public');
const manifest=JSON.parse(await readFile(resolve(root,'release-manifest.json'),'utf8'));
const findings=[];let count=0;
const expected=new Map(manifest.files.map(f=>[f.path,f]));
if(expected.size!==manifest.files.length)throw Error('Duplicate manifest paths');
for(const name of expected.keys())if(name.includes('\\')||name.startsWith('/')||name.split('/').some(s=>s==='..'||s===''))throw Error('Invalid manifest path');
async function walk(dir){
 for(const entry of await readdir(dir,{withFileTypes:true})){
  const path=resolve(dir,entry.name),name=relative(root,path).replaceAll('\\','/');
  if(dir===root&&entry.name==='.git'&&entry.isDirectory())continue;
  if(entry.isSymbolicLink()){findings.push({file:name,reason:'symlink'});continue;}
  if(entry.isDirectory()){await walk(path);continue;}
  if(name==='release-manifest.json')continue;
  const record=expected.get(name);
  if(!record){findings.push({file:name,reason:'unlisted file'});continue;}
  count++;expected.delete(name);
  const data=await readFile(path);
  if(data.length!==record.bytes||createHash('sha256').update(data).digest('hex')!==record.sha256)findings.push({file:name,reason:'content changed since review'});
  if(publicMode&&!['reviewed','reviewed-official-default'].includes(record.status))findings.push({file:name,reason:record.reason||record.status});
 }
}
await walk(root);
for(const name of expected.keys())findings.push({file:name,reason:'missing file'});
if(publicMode&&!['public-review-candidate','public-release'].includes(manifest.scope))findings.push({file:'release-manifest.json',reason:'full local candidate includes private composite experiments'});
const report={status:findings.length?'REVIEW_REQUIRED':'PASS',scope:manifest.scope,files:count,publicMode,findings,note:'PASS confirms the reviewed inventory, not final approval or a guarantee of legal interpretation. The documented official-default license basis must accompany the candidate.'};
console.log(JSON.stringify(report,null,2));
if(findings.length)process.exitCode=1;
