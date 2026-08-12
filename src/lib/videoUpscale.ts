import { upscaleFrameToCanvas, type ScaleFactor, formatBytes } from './upscale'

export type VideoEnhanceMode = 'quality' | 'ai'
export type VideoScaleFactor = 2 | 4

export type VideoUpscaleResult = {
  blob: Blob
  dataUrl: string
  width: number
  height: number
  duration: number
  frameCount: number
  mimeType: string
}

export type VideoMeta = {
  width: number
  height: number
  duration: number
}

function sleep(ms: number) {
  return new Promise<void>((resolve) => {
    window.setTimeout(resolve, ms)
  })
}

function waitForEvent(target: EventTarget, eventName: string) {
  return new Promise<void>((resolve, reject) => {
    const onOk = () => {
      cleanup()
      resolve()
    }
    const onErr = () => {
      cleanup()
      reject(new Error(`Video event failed: ${eventName}`))
    }
    const cleanup = () => {
      target.removeEventListener(eventName, onOk)
      target.removeEventListener('error', onErr)
    }
    target.addEventListener(eventName, onOk, { once: true })
    target.addEventListener('error', onErr, { once: true })
  })
}

export function loadVideoFromFile(file: File): Promise<{ video: HTMLVideoElement; url: string }> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const video = document.createElement('video')
    video.preload = 'auto'
    video.muted = true
    video.playsInline = true
    video.src = url

    const onLoaded = () => {
      cleanup()
      if (!video.videoWidth || !Number.isFinite(video.duration) || video.duration <= 0) {
        reject(new Error('Could not read that video.'))
        return
      }
      resolve({ video, url })
    }
    const onError = () => {
      cleanup()
      URL.revokeObjectURL(url)
      reject(new Error('Could not read that video.'))
    }
    const cleanup = () => {
      video.removeEventListener('loadeddata', onLoaded)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('loadeddata', onLoaded)
    video.addEventListener('error', onError)
  })
}

export function getVideoMeta(video: HTMLVideoElement): VideoMeta {
  return {
    width: video.videoWidth,
    height: video.videoHeight,
    duration: video.duration,
  }
}

async function seekVideo(video: HTMLVideoElement, time: number) {
  if (Math.abs(video.currentTime - time) < 0.001) return
  video.currentTime = Math.min(Math.max(time, 0), Math.max(video.duration - 0.001, 0))
  await waitForEvent(video, 'seeked')
}

function pickRecorderMime(): string {
  const candidates = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm']
  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type
    }
  }
  throw new Error('This browser cannot record WebM video.')
}

async function paintFrame(
  video: HTMLVideoElement,
  canvas: HTMLCanvasElement,
  scale: VideoScaleFactor,
  mode: VideoEnhanceMode,
) {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')

  if (mode === 'quality') {
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    return
  }

  const snap = document.createElement('canvas')
  snap.width = video.videoWidth
  snap.height = video.videoHeight
  const snapCtx = snap.getContext('2d')
  if (!snapCtx) throw new Error('Canvas is not available in this browser.')
  snapCtx.drawImage(video, 0, 0)
  await upscaleFrameToCanvas(snap, canvas, scale as ScaleFactor)
}

export async function upscaleVideo(
  video: HTMLVideoElement,
  scale: VideoScaleFactor,
  mode: VideoEnhanceMode,
  onProgress?: (progress: number, label?: string) => void,
): Promise<VideoUpscaleResult> {
  const srcW = video.videoWidth
  const srcH = video.videoHeight
  const maxDuration = mode === 'ai' ? 10 : 30
  const fps = mode === 'ai' ? 8 : 16
  const duration = Math.min(video.duration || 0, maxDuration)

  if (!duration || duration < 0.2) {
    throw new Error('Video is too short to upscale.')
  }
  if (srcW > 1920 || srcH > 1920) {
    throw new Error('Use videos 1920×1920 or smaller for browser upscaling.')
  }
  if (mode === 'ai' && (srcW > 960 || srcH > 960)) {
    throw new Error('AI video mode supports up to 960×960. Try Quality mode or a smaller clip.')
  }

  const destW = Math.round(srcW * scale)
  const destH = Math.round(srcH * scale)
  if (destW * destH > 16_000_000) {
    throw new Error('Output frames would be too large. Try a lower scale.')
  }

  const canvas = document.createElement('canvas')
  canvas.width = destW
  canvas.height = destH

  const mimeType = pickRecorderMime()
  const frameCount = Math.max(1, Math.floor(duration * fps))
  const frameDurationMs = 1000 / fps

  onProgress?.(0.02, mode === 'ai' ? 'Warming up AI…' : 'Preparing video…')

  const frames: ImageBitmap[] = []
  for (let i = 0; i < frameCount; i += 1) {
    const t = Math.min(duration - 0.001, i / fps)
    await seekVideo(video, t)
    await paintFrame(video, canvas, scale, mode)
    frames.push(await createImageBitmap(canvas))
    onProgress?.(0.05 + ((i + 1) / frameCount) * 0.7, `Enhancing frame ${i + 1}/${frameCount}`)
  }

  onProgress?.(0.78, 'Encoding video…')

  const stream = canvas.captureStream(fps)
  const recorder = new MediaRecorder(stream, {
    mimeType,
    videoBitsPerSecond: mode === 'ai' ? 4_000_000 : 6_000_000,
  })

  const chunks: BlobPart[] = []
  recorder.ondataavailable = (event) => {
    if (event.data.size > 0) chunks.push(event.data)
  }

  const stopped = new Promise<void>((resolve) => {
    recorder.onstop = () => resolve()
  })

  recorder.start()
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas is not available in this browser.')

  for (let i = 0; i < frames.length; i += 1) {
    ctx.clearRect(0, 0, destW, destH)
    ctx.drawImage(frames[i], 0, 0)
    frames[i].close()
    onProgress?.(0.78 + ((i + 1) / frames.length) * 0.2, 'Encoding video…')
    await sleep(frameDurationMs)
  }

  recorder.stop()
  await stopped
  stream.getTracks().forEach((track) => track.stop())

  const blob = new Blob(chunks, { type: mimeType })
  if (!blob.size) {
    throw new Error('Video encoding failed. Try another browser or shorter clip.')
  }

  onProgress?.(1, 'Done')

  return {
    blob,
    dataUrl: URL.createObjectURL(blob),
    width: destW,
    height: destH,
    duration,
    frameCount,
    mimeType,
  }
}

export { formatBytes }
