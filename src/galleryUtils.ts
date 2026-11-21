import type { GalleryPhoto } from "./localDb";

export function sortGalleryPhotos(photos: readonly GalleryPhoto[] | null | undefined): GalleryPhoto[] {
  return [...(photos || [])].sort((a, b) => {
    const dateA = Date.parse(a.uploadedAt || a.at || "") || 0;
    const dateB = Date.parse(b.uploadedAt || b.at || "") || 0;
    return dateB - dateA;
  });
}

export function galleryDownloadUrl(src: string): string {
  if (!src.includes("res.cloudinary.com") || !src.includes("/image/upload/") || src.includes("/fl_attachment/")) {
    return src;
  }
  return src.replace("/image/upload/", "/image/upload/fl_attachment/");
}

export function galleryDownloadFilename(photo: GalleryPhoto): string {
  const slug = (photo.caption || "sports-meet-photo")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  const urlExtension = photo.src.match(/\.(jpe?g|png|webp|gif)(?:[?#]|$)/i)?.[1];
  const dataUrlExtension = photo.src.match(/^data:image\/(jpe?g|png|webp|gif);/i)?.[1];
  const extension = (urlExtension || dataUrlExtension || "").replace("jpeg", "jpg");
  return `${slug || "sports-meet-photo"}${extension ? `.${extension}` : ""}`;
}
