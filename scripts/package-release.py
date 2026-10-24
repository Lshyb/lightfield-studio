"""Package only manifest-listed, verified files; never collect a working folder."""
import argparse,copy,hashlib,json,pathlib,zipfile
p=argparse.ArgumentParser();p.add_argument('--out',type=pathlib.Path,required=True);p.add_argument('--launcher',type=pathlib.Path,required=True);a=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[1];manifest=json.loads((root/'release-manifest.json').read_text(encoding='utf8'))
assert manifest['scope']=='public-release'and manifest['public_approval_granted']is True
files={}
for r in manifest['files']:
 name=r['path'];path=(root/name).resolve();assert root in path.parents
 assert r['status']in('reviewed','reviewed-official-default')
 data=path.read_bytes();assert len(data)==r['bytes']and hashlib.sha256(data).hexdigest()==r['sha256'],name
 files[name]=data
exe=a.launcher.read_bytes();launcher=json.loads((root/'windows/launcher-build.json').read_text(encoding='utf8'))
assert len(exe)==launcher['bytes']and hashlib.sha256(exe).hexdigest()==launcher['sha256']
a.out.mkdir(parents=True,exist_ok=True);results=[]
for kind in ['source','windows-x64']:
 current=copy.deepcopy(manifest);content=dict(files)
 if kind=='windows-x64':
  content['Lightfield.exe']=exe;current['files'].append({'path':'Lightfield.exe','bytes':len(exe),'sha256':launcher['sha256'],'license':'MIT','status':'reviewed','reason':'Verified native Windows launcher; compiled without debug data'})
 content['release-manifest.json']=json.dumps(current,ensure_ascii=False,indent=2).encode('utf8')
 dest=a.out/('lightfield-studio-v1.1.0-'+kind+'.zip')
 if dest.exists():raise RuntimeError('Output already exists: '+dest.name)
 with zipfile.ZipFile(dest,'w',compression=zipfile.ZIP_DEFLATED,compresslevel=9)as z:
  for name,data in sorted(content.items()):
   info=zipfile.ZipInfo('lightfield-studio-1.1.0/'+name,(2026,10,24,0,0,0));info.compress_type=zipfile.ZIP_DEFLATED;info.external_attr=0o100644<<16;z.writestr(info,data)
 with zipfile.ZipFile(dest)as z:
  assert z.testzip()is None
  for name,data in content.items():assert z.read('lightfield-studio-1.1.0/'+name)==data
 results.append({'file':dest.name,'bytes':dest.stat().st_size,'sha256':hashlib.sha256(dest.read_bytes()).hexdigest()})
(a.out/'SHA256SUMS.txt').write_text(''.join(r['sha256']+'  '+r['file']+'\n'for r in results),encoding='utf8')
print(json.dumps(results,indent=2))
