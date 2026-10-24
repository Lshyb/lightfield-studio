// Geometry checks use welded positions for adjacency; UV seams are not holes.
// Proper (non-coplanar) triangle intersections are reported separately from
// touching neighbours and intended eye/mouth/ear apertures.
export function auditGeometry(geometry,{region=p=>p[1]<.10,intersections=true,cellSize=.03}={}) {
 const p=geometry.getAttribute('position'),n=geometry.getAttribute('normal'),idx=geometry.index?.array;
 const points=[],weld=[],vertices=new Map(),edges=new Map(),faces=[],faceKeys=new Set();
 let nonFinite=0,invalidNormals=0,degenerate=0,duplicates=0,wrongNormalFaces=0,wrongRegionNormals=0;
 for(let i=0;i<p.count;i++) {
  const a=[p.getX(i),p.getY(i),p.getZ(i)];points.push(a);
  if(!a.every(Number.isFinite))nonFinite++;
  const key=a.map(v=>Math.round(v*1e6)).join(',');if(!vertices.has(key))vertices.set(key,vertices.size);weld.push(vertices.get(key));
  if(n){const len=Math.hypot(n.getX(i),n.getY(i),n.getZ(i));if(!Number.isFinite(len)||Math.abs(len-1)>.01)invalidNormals++;}
 }
 const count=idx?.length??p.count;
 for(let i=0;i<count;i+=3){const ids=[0,1,2].map(k=>idx?idx[i+k]:i+k);
  if(ids.some(i=>!Number.isInteger(i)||i<0||i>=points.length))throw new Error('Triangle index outside the position buffer');
  const w=ids.map(i=>weld[i]),key=w.slice().sort((a,b)=>a-b).join(',');if(faceKeys.has(key))duplicates++;faceKeys.add(key);
  const tri=ids.map(i=>points[i]),ab=sub(tri[1],tri[0]),ac=sub(tri[2],tri[0]),cross=cross3(ab,ac),length=Math.hypot(...cross);
  if(length<2e-12){degenerate++;continue;}
  if(n){const mean=[0,1,2].map(k=>ids.reduce((s,i)=>s+n.array[i*3+k],0)/3);if(dot(cross,mean)<-length*.05){wrongNormalFaces++;if(tri.some((v,k)=>region(v,ids[k])))wrongRegionNormals++;}}
  for(let k=0;k<3;k++){const a=w[k],b=w[(k+1)%3],e=a<b?a+','+b:b+','+a;edges.set(e,(edges.get(e)||0)+1);}
  faces.push({id:i/3,w,tri,lo:[0,1,2].map(k=>Math.min(...tri.map(v=>v[k]))),hi:[0,1,2].map(k=>Math.max(...tri.map(v=>v[k]))),region:tri.some((v,k)=>region(v,ids[k]))});
 }
 let openRegionEdges=0,boundaryEdges=0,nonManifoldEdges=0;
 const weldPoints=[],weldIndices=[];weld.forEach((w,i)=>{weldPoints[w]=points[i];weldIndices[w]=i;});
 for(const [e,count] of edges){if(count===1){boundaryEdges++;if(e.split(',').map(Number).every(i=>region(weldPoints[i],weldIndices[i])))openRegionEdges++;}else if(count>2)nonManifoldEdges++;}
 const crossingPairs=[],cells=new Map(),pairs=new Set();let candidatePairs=0;
 if(intersections)for(const f of faces.filter(f=>f.region)){
  const lo=f.lo.map(v=>Math.floor(v/cellSize)),hi=f.hi.map(v=>Math.floor(v/cellSize));
  for(let x=lo[0];x<=hi[0];x++)for(let y=lo[1];y<=hi[1];y++)for(let z=lo[2];z<=hi[2];z++){
   const key=x+','+y+','+z,cell=cells.get(key)||[];
   for(const other of cell){const pair=other.id+','+f.id;if(pairs.has(pair))continue;pairs.add(pair);
    if(f.w.some(v=>other.w.includes(v))||f.lo.some((v,k)=>v>other.hi[k]+1e-7)||f.hi.some((v,k)=>v<other.lo[k]-1e-7))continue;
    candidatePairs++;if(properIntersection(f.tri,other.tri))crossingPairs.push([other.id,f.id]);}
   cell.push(f);cells.set(key,cell);
  }
 }
 return {vertices:p.count,weldedVertices:vertices.size,triangles:count/3,nonFiniteVertices:nonFinite,invalidNormals,degenerateTriangles:degenerate,duplicateFaces:duplicates,normalDisagreements:wrongNormalFaces,regionNormalDisagreements:wrongRegionNormals,boundaryEdges,openRegionEdges,nonManifoldEdges,candidatePairs,properIntersections:crossingPairs.length,crossingPairs:crossingPairs.slice(0,30)};
}
const sub=(a,b)=>a.map((v,k)=>v-b[k]);
const cross3=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const dot=(a,b)=>a.reduce((s,v,k)=>s+v*b[k],0);
function segmentTriangle(a,b,t){const direction=sub(b,a),e1=sub(t[1],t[0]),e2=sub(t[2],t[0]),h=cross3(direction,e2),det=dot(e1,h);if(Math.abs(det)<1e-13)return false;
 const s=sub(a,t[0]),u=dot(s,h)/det;if(u<=1e-5||u>=1-1e-5)return false;
 const q=cross3(s,e1),v=dot(direction,q)/det;if(v<=1e-5||u+v>=1-1e-5)return false;
 const distance=dot(e2,q)/det;return distance>1e-5&&distance<1-1e-5;
}
export function properIntersection(a,b){for(let i=0;i<3;i++)if(segmentTriangle(a[i],a[(i+1)%3],b)||segmentTriangle(b[i],b[(i+1)%3],a))return true;return false;}
