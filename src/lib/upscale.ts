export type OutputFormat = 'png' | 'jpg' | 'webp'
export type ScaleFactor = 2 | 4 | 8

export type UpscaleResult = {
  blob: Blob
  dataUrl: string
  width: number
  height: number
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value))
}

function yieldFrame() {
  return new Promise<void>((resolve) => {
    requestAnimationFrame(() => resolve())
  })
}

/** Progressive high-quality upsample with a light sharpen pass. */
export async function upscaleImage(
  source: HTMLImageElement | ImageBitmap,
  scale: ScaleFactor,
  format: OutputFormat,
  onProgress?: (progress: number) => void,
): Promise<UpscaleResult> {
  const srcW = source.width
  const srcH = source.height
  const destW = Math.round(srcW * scale)
  const destH = Math.round(srcH * scale)

  if (destW * destH > 36_000_000) {
    throw new Error('Output would be too large. Try a smaller image or lower scale.')
  }

  onProgress?.(0.08)
  await yieldFrame()

  let current: HTMLCanvasElement | HTMLImageElement | ImageBitmap = source
  let currentW = srcW
  let currentH = srcH
  let stepsDone = 0
  const totalSteps = Math.log2(scale)

  while (currentW < destW || currentH < destH) {
    const nextW = Math.min(destW, currentW * 2)
    const nextH = Math.min(destH, currentH * 2)
    const step = document.createElement('canvas')
    step.width = nextW
    step.height = nextH
    const ctx = step.getContext('2d')
    if (!ctx) throw new Error('Canvas is not available in this browser.')
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(current, 0, 0, nextW, nextH)
    current = step
    currentW = nextW
    currentH = nextH
    stepsDone += 1
    onProgress?.(0.08 + (stepsDone / totalSteps) * 0.55)
    await yieldFrame()
  }

  const canvas = current as HTMLCanvasElement
  const ctx = canvas.getContext('2d', { willReadFrequently: true })
  if (!ctx) throw new Error('Canvas is not available in this browser.')

  if (destW * destH <= 8_000_000) {
    const imageData = ctx.getImageData(0, 0, destW, destH)
    applyFastSharpen(imageData, 0.35 + scale * 0.03)
    ctx.putImageData(imageData, 0, 0)
  }
  onProgress?.(0.82)
  await yieldFrame()

  const mime =
    format === 'jpg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png'
  const quality = format === 'png' ? undefined : 0.94

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (result) resolve(result)
        else reject(new Error('Failed to encode the upscaled image.'))
      },
      mime,
      quality,
    )
  })

  const dataUrl = URL.createObjectURL(blob)
  onProgress?.(1)

  return { blob, dataUrl, width: destW, height: destH }
}

function applyFastSharpen(imageData: ImageData, amount: number) {
  const { data, width, height } = imageData
  const src = new Uint8ClampedArray(data)

  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const i = (y * width + x) * 4
      for (let c = 0; c < 3; c += 1) {
        const center = src[i + c]
        const up = src[((y - 1) * width + x) * 4 + c]
        const down = src[((y + 1) * width + x) * 4 + c]
        const left = src[(y * width + (x - 1)) * 4 + c]
        const right = src[(y * width + (x + 1)) * 4 + c]
        const sharpened = center * 5 - up - down - left - right
        data[i + c] = clamp(center + (sharpened - center) * amount, 0, 255)
      }
    }
  }
}

export function loadImageFromFile(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that image.'))
    }
    img.src = url
  })
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
}
