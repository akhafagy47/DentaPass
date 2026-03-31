/**
 * Center-crops an image File/Blob to a square and resizes to `size`×`size` px.
 * Returns a PNG Blob. Rejects if the source is smaller than 200px on either side.
 */
function cropToSize(img, size) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const side = Math.min(w, h);
  const sx   = (w - side) / 2;
  const sy   = (h - side) / 2;

  const canvas = document.createElement('canvas');
  canvas.width  = size;
  canvas.height = size;
  canvas.getContext('2d').drawImage(img, sx, sy, side, side, 0, 0, size, size);

  return new Promise((resolve, reject) =>
    canvas.toBlob(b => b ? resolve(b) : reject(new Error('Canvas export failed')), 'image/png'),
  );
}

function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload  = () => { URL.revokeObjectURL(url); resolve(img); };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('Could not read image file.')); };
    img.src = url;
  });
}

/**
 * Generates three PNG blobs from a source image file, each center-cropped and
 * resized to exactly the dimensions PassKit requires for each slot:
 *   icon      →  87 × 87 px   (Apple Wallet icon)
 *   thumbnail → 320 × 320 px  (Google Wallet pass image)
 *   logo      → 660 × 660 px  (Apple Wallet logo strip)
 *
 * Throws if the source image is smaller than 200×200px.
 */
export async function cropAll(file) {
  const img = await loadImage(file);

  if (img.naturalWidth < 200 || img.naturalHeight < 200) {
    throw new Error('Logo must be at least 200×200px.');
  }

  const [icon, thumbnail, logo] = await Promise.all([
    cropToSize(img, 114),
    cropToSize(img, 320),
    cropToSize(img, 660),
  ]);

  return { icon, thumbnail, logo };
}
