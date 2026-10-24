// Preserve image attribution as JPEG metadata without adding text to the picture.
export function withImageAttribution(dataURL, credits) {
  if (!credits.length || !dataURL.startsWith('data:image/jpeg;base64,')) return dataURL;
  const escape = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[c]));
  const xmp = `<?xpacket begin="\uFEFF" id="W5M0MpCehiHzreSzNTczkc9d"?><x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#"><rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/"><dc:rights><rdf:Alt><rdf:li xml:lang="x-default">${credits.map(escape).join(' | ')}</rdf:li></rdf:Alt></dc:rights></rdf:Description></rdf:RDF></x:xmpmeta><?xpacket end="w"?>`;
  const payload = new TextEncoder().encode('http://ns.adobe.com/xap/1.0/\0' + xmp);
  if (payload.length + 2 > 65535) throw new RangeError('Image metadata is too large');
  const source = atob(dataURL.slice(dataURL.indexOf(',') + 1));
  if (source.charCodeAt(0) !== 255 || source.charCodeAt(1) !== 216) throw new TypeError('Invalid JPEG header');
  const segment = new Uint8Array(payload.length + 4);
  segment.set([255, 225, (payload.length + 2) >> 8, (payload.length + 2) & 255]); segment.set(payload, 4);
  const bytes = String.fromCharCode(...segment);
  return 'data:image/jpeg;base64,' + btoa(source.slice(0, 2) + bytes + source.slice(2));
}
