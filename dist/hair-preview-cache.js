// Composite portraits stay in this browser's storage; no pre-rendered female
// hair images are distributed with the application or sent to a server.
export const PREVIEW_KEY = 'lightfield.female-hair-previews.v2.4cdb339e-6ef184c0-1c6f1544-b94c4459';
export const PREVIEW_STYLES = ['none','short','bob','curly'];
const valid = image => typeof image==='string' && image.length<300000 && /^data:image\/jpeg;base64,[A-Za-z0-9+/]+=*$/.test(image);
export function localHairPreviewCache(storage) {
  let images={};
  try {
    const saved=JSON.parse(storage?.getItem(PREVIEW_KEY)||'{}');
    for(const id of PREVIEW_STYLES)if(valid(saved[id]))images[id]=saved[id];
  } catch { /* Local storage is optional, including private browsing. */ }
  return {
    get(id){return images[id];},
    missing(){return PREVIEW_STYLES.filter(id=>!images[id]);},
    save(id,image){
      if(!PREVIEW_STYLES.includes(id)||!valid(image))throw Error('Invalid local hair preview');
      images[id]=image;
      try {storage?.setItem(PREVIEW_KEY,JSON.stringify(images));}catch{/* Keep the usable in-memory preview. */}
    }
  };
}
