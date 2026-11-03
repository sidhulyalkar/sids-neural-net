/** Canonical, shareable cross-navigation between the fast website archives and Sid's iLand. */
export type GalleryDestination = "photos" | "papers";
export const galleryWorldHref = (destination:GalleryDestination):string =>
  `/?gallery=${destination}`;

export function parseGalleryDestination(search:string):GalleryDestination|null {
  const value=new URLSearchParams(search).get("gallery");
  return value==="photos"||value==="papers"?value:null;
}
export function photoArchiveHref(id:string):string {
  if(!/^photo-\d{3}$/.test(id))return "/photography";
  return `/photography?photo=${encodeURIComponent(id)}`;
}
export function parsePhotoArchiveId(search:string,ids:readonly string[]):string|null {
  const id=new URLSearchParams(search).get("photo");
  return id&&/^photo-\d{3}$/.test(id)&&ids.includes(id)?id:null;
}
