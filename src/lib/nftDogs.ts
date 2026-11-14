import type { LibrarySticker } from './stickers';

// Source artworks are read-only in kimura-jane/inu.
// Background-free, optimized 512px WebP assets are stored in THIS repository.
// The original NFT pixels/colours are retained; no redrawing or generic dog art.
// v2 keeps the existing sticker IDs and preserves legacy image URLs for saved artwork.
export const TAF_DOG_STICKERS: LibrarySticker[] = Array.from(
  { length: 20 },
  (_, index) => {
    const number = String(index + 1).padStart(2, '0');

    return {
      id: `tafdog-${number}`,
      label: `TAF DOG #${number}`,
      kind: 'image',
      src: `${import.meta.env.BASE_URL}stickers/taf-dog/v2/taf_dog_${number}.webp`,
    };
  },
);
