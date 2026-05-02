import { getGallery } from "@/actions/gallery";
import { GalleryClient } from "@/components/gallery/GalleryClient";

export default async function GalleryPage() {
  const result = await getGallery();

  if (result.error) {
    return (
      <div className="mx-auto max-w-5xl p-6">
        <div className="rounded-3xl border border-rose-400/20 bg-rose-500/10 p-5 text-rose-100">
          Nepodařilo se načíst galerii: {result.error}
        </div>
      </div>
    );
  }

  return <GalleryClient media={result.media} role={result.role} />;
}
