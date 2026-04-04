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

/**
 * Center-crops an image File/Blob to a rectangle and resizes to `tw`×`th` px.
 * Crops to the target aspect ratio first, then scales down.
 */
function cropToRect(img, tw, th) {
  const { naturalWidth: w, naturalHeight: h } = img;
  const targetRatio = tw / th;
  const srcRatio    = w / h;

  let sx, sy, sw, sh;
  if (srcRatio > targetRatio) {
    // Source is wider — crop sides
    sh = h;
    sw = h * targetRatio;
    sx = (w - sw) / 2;
    sy = 0;
  } else {
    // Source is taller — crop top/bottom
    sw = w;
    sh = w / targetRatio;
    sx = 0;
    sy = (h - sh) / 2;
  }

  const canvas = document.createElement('canvas');
  canvas.width  = tw;
  canvas.height = th;
  canvas.getContext('2d').drawImage(img, sx, sy, sw, sh, 0, 0, tw, th);

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
 * Generates three PNG blobs from a source image file:
 *   icon      →  87 ×  87 px  (Apple Wallet lock screen icon)
 *   logo      → 660 × 660 px  (Google Pay circle-cropped logo)
 *   appleLogo → 480 × 150 px  (Apple Wallet rectangular logo strip)
 *
 * Throws if the source image is smaller than 200×200px.
 */
export async function cropAll(file) {
  const img = await loadImage(file);

  if (img.naturalWidth < 200 || img.naturalHeight < 200) {
    throw new Error('Logo must be at least 200×200px.');
  }

  const [icon, logo, appleLogo] = await Promise.all([
    cropToSize(img, 114),
    cropToSize(img, 660),
    cropToRect(img, 480, 150),
  ]);

  return { icon, logo, appleLogo };
}
