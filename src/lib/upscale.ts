import Upscaler from 'upscaler'
import type { ModelDefinition } from 'upscaler'
import x2Model from '@upscalerjs/esrgan-slim/2x'
import x4Model from '@upscalerjs/esrgan-slim/4x'

export type OutputFormat = 'png' | 'jpg' | 'webp'
export type ScaleFactor = 2 | 4 | 8

export type UpscaleResult = {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  /** Nearest-neighbor enlarge of the source, same pixel size as the AI result — for fair comparison. */
  baselineSrc: string
}

type ModelScale = 2 | 4
type UpscalerInstance = InstanceType<typeof Upscaler>

const upscalerCache = new Map<ModelScale, UpscalerInstance>()

function localModel(definition: ModelDefinition, scale: ModelScale): ModelDefinition {
  return {
    ...definition,
    path: `/models/esrgan-slim/x${scale}/model.json`,
  }
}

async function getUpscaler(scale: ModelScale): Promise<UpscalerInstance> {
  const cached = upscalerCache.get(scale)
  if (cached) {
    await cached.ready
    return cached
  }

  const definition = scale === 2 ? localModel(x2Model, 2) : localModel(x4Model, 4)
  const upscaler = new Upscaler({ model: definition })
  upscalerCache.set(scale, upscaler)
  await upscaler.ready
  return upscaler
}

function mimeFor(format: OutputFormat) {
  if (format === 'jpg') return 'image/jpeg'
  if (format === 'webp') return 'image/webp'
  return 'image/png'
}

async function canvasFromSource(
  source: CanvasImageSource,
  width: number,
  height: number,
  smooth: boolean,
): Promise<HTMLCanvasElement> {
  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')
  ctx.imageSmoothingEnabled = smooth
  if (smooth) ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(source, 0, 0, width, height)
  return canvas
}

async function encodeCanvas(
  canvas: HTMLCanvasElement,
  format: OutputFormat,
): Promise<{ blob: Blob; dataUrl: string }> {
  const mime = mimeFor(format)
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
  return { blob, dataUrl: URL.createObjectURL(blob) }
}

async function loadImageFromUrl(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('Could not read the upscaled image.'))
    img.src = url
  })
}

async function runModelPass(
  source: HTMLImageElement | HTMLCanvasElement,
  scale: ModelScale,
  onProgress?: (progress: number) => void,
  progressFrom = 0,
  progressTo = 1,
): Promise<HTMLImageElement> {
  const upscaler = await getUpscaler(scale)
  onProgress?.(progressFrom)

  const base64 = await upscaler.upscale(source, {
    output: 'base64',
    patchSize: 64,
    padding: 8,
    awaitNextFrame: true,
    progress: (amount: number) => {
      onProgress?.(progressFrom + amount * (progressTo - progressFrom))
    },
  })

  return loadImageFromUrl(base64)
}

/** ESRGAN AI upscale in the browser (2× / 4× models; 8× = 4× then 2×). */
export async function upscaleImage(
  source: HTMLImageElement,
  scale: ScaleFactor,
  format: OutputFormat,
  onProgress?: (progress: number) => void,
): Promise<UpscaleResult> {
  const srcW = source.width
  const srcH = source.height
  const destW = Math.round(srcW * scale)
  const destH = Math.round(srcH * scale)

  if (destW * destH > 24_000_000) {
    throw new Error('Output would be too large. Try a smaller image or lower scale.')
  }

  let enhanced: HTMLImageElement

  if (scale === 8) {
    // Browser ESRGAN slim has no 8× weights — chain 4× then 2×.
    const mid = await runModelPass(source, 4, onProgress, 0.02, 0.62)
    enhanced = await runModelPass(mid, 2, onProgress, 0.62, 0.92)
  } else {
    enhanced = await runModelPass(source, scale, onProgress, 0.02, 0.92)
  }

  if (enhanced.width !== destW || enhanced.height !== destH) {
    // Guard against unexpected model output size.
    const normalized = await canvasFromSource(enhanced, destW, destH, true)
    enhanced = await loadImageFromUrl(normalized.toDataURL('image/png'))
  }

  const outputCanvas = await canvasFromSource(enhanced, destW, destH, true)
  const { blob, dataUrl } = await encodeCanvas(outputCanvas, format)

  const baselineCanvas = await canvasFromSource(source, destW, destH, false)
  const baselineSrc = baselineCanvas.toDataURL('image/png')

  onProgress?.(1)

  return {
    blob,
    dataUrl,
    width: destW,
    height: destH,
    baselineSrc,
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
