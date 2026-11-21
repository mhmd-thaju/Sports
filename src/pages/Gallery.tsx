import { usePoll } from "../hooks";
import { trackGalleryActivity } from "../api";
import { galleryDownloadFilename, galleryDownloadUrl, sortGalleryPhotos } from "../galleryUtils";
import type { GalleryPhoto } from "../localDb";

type GalleryResponse = { photos: GalleryPhoto[] };

export default function Gallery() {
  const data = usePoll<GalleryResponse>("/gallery", 5000);
  const photos = sortGalleryPhotos(data?.photos);

  return (
    <main>
      <header className="mb-8 flex flex-col justify-between gap-4 border-b border-[#d6dce5] pb-6 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-bold uppercase tracking-[.2em] text-[#f47b00]">Captured in motion</p>
          <h1 className="mt-2 font-display text-5xl uppercase text-[#002656]">Sports meet gallery</h1>
          <p className="mt-3 max-w-2xl text-sm leading-6 text-[#626c79]">
            Browse and download photos from the event. New uploads appear at the beginning of the collection.
          </p>
        </div>
        <span className="whitespace-nowrap text-xs font-bold uppercase tracking-[.15em] text-[#626c79]">
          {photos.length} {photos.length === 1 ? "photo" : "photos"}
        </span>
      </header>

      {data === null ? (
        <p className="rounded-2xl bg-white p-8 text-center text-sm text-[#626c79]" role="status">
          Loading event photos…
        </p>
      ) : photos.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[#c7d0dc] bg-white px-6 py-16 text-center">
          <h2 className="font-display text-3xl uppercase text-[#002656]">No event photos yet</h2>
          <p className="mx-auto mt-3 max-w-lg text-sm leading-6 text-[#626c79]">
            Photos uploaded during the meet will appear here. The campus photo remains on the homepage.
          </p>
        </div>
      ) : (
        <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {photos.map((photo) => {
            const uploadedAt = photo.uploadedAt || photo.at;
            const parsedDate = uploadedAt ? new Date(uploadedAt) : null;
            const validDate = parsedDate && !Number.isNaN(parsedDate.getTime()) ? parsedDate : null;
            return (
              <article key={photo.id || photo.src} className="overflow-hidden rounded-2xl bg-white shadow-sm ring-1 ring-[#dce2e9]">
                <a
                  href={photo.src}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Open ${photo.caption || "event photo"} in a new tab`}
                  onClick={() => trackGalleryActivity(photo.id, "open")}
                >
                  <img
                    src={photo.src}
                    alt={photo.caption || "Sports meet event"}
                    loading="lazy"
                    className="aspect-[4/3] w-full bg-[#e7edf4] object-cover"
                  />
                </a>
                <div className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <h2 className="truncate font-semibold text-[#002656]">{photo.caption || "Sports meet photo"}</h2>
                    {validDate && (
                      <time dateTime={validDate.toISOString()} className="mt-1 block text-xs text-[#737d89]">
                        {validDate.toLocaleString()}
                      </time>
                    )}
                  </div>
                  <a
                    href={galleryDownloadUrl(photo.src)}
                    download={galleryDownloadFilename(photo)}
                    className="shrink-0 rounded-full bg-[#002656] px-4 py-2 text-xs font-bold uppercase tracking-wide text-white transition hover:bg-[#f47b00]"
                    aria-label={`Download ${photo.caption || "event photo"}`}
                    onClick={() => trackGalleryActivity(photo.id, "download_click")}
                  >
                    Download
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </main>
  );
}
