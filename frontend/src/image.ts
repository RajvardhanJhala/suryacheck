// Prepare a camera photo or screenshot for the vision model: tall screenshots are split
// into overlapping tiles; everything is scaled to <= 1280 px wide JPEG, at most 8 tiles.
const MAX_W = 1280
const TILE_H = 1600
const OVERLAP = 80
const MAX_TILES = 8

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not open that image.'))
    img.src = URL.createObjectURL(file)
  })
}

function toBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) =>
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not process the image.'))), 'image/jpeg', 0.85))
}

export async function prepareTiles(file: File): Promise<Blob[]> {
  const img = await loadImage(file)
  const scale = Math.min(1, MAX_W / img.naturalWidth)
  const w = Math.round(img.naturalWidth * scale)
  const h = Math.round(img.naturalHeight * scale)
  const tall = h > 2 * w
  const tileH = tall ? TILE_H : h
  const tiles: Blob[] = []
  for (let y = 0; y < h && tiles.length < MAX_TILES; y += tileH - (tall ? OVERLAP : 0)) {
    const canvas = document.createElement('canvas')
    canvas.width = w
    canvas.height = Math.min(tileH, h - y)
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(img, 0, y / scale, img.naturalWidth, canvas.height / scale, 0, 0, w, canvas.height)
    tiles.push(await toBlob(canvas))
    if (!tall || y + tileH >= h) break
  }
  URL.revokeObjectURL(img.src)
  return tiles
}
