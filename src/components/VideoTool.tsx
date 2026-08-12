import { startTransition, useEffect, useId, useRef, useState, type CSSProperties } from 'react'
import { ProcessingViz } from './ProcessingViz'
import {
  formatBytes,
  getVideoMeta,
  loadVideoFromFile,
  type VideoEnhanceMode,
  type VideoScaleFactor,
  upscaleVideo,
} from '../lib/videoUpscale'

const SCALES: { value: VideoScaleFactor; label: string; hint: string }[] = [
  { value: 2, label: '2x', hint: 'Double size' },
  { value: 4, label: '4x', hint: '4× larger' },
]

const MODES: { value: VideoEnhanceMode; label: string; hint: string }[] = [
  { value: 'quality', label: 'Quality', hint: 'Fast · up to 30s' },
  { value: 'ai', label: 'AI', hint: 'Slower · up to 10s' },
]

type ResultState = {
  afterSrc: string
  filename: string
  width: number
  height: number
  sizeLabel: string
  scale: VideoScaleFactor
  mode: VideoEnhanceMode
  frameCount: number
}

type Stage = 'idle' | 'ready' | 'working' | 'done'

export function VideoTool() {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState<VideoScaleFactor>(2)
  const [mode, setMode] = useState<VideoEnhanceMode>('quality')
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [status, setStatus] = useState('Upscaling…')
  const [error, setError] = useState<string | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [videoEl, setVideoEl] = useState<HTMLVideoElement | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [posterUrl, setPosterUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [dragOver, setDragOver] = useState(false)
  const [burst, setBurst] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  useEffect(() => {
    return () => {
      if (result?.afterSrc) URL.revokeObjectURL(result.afterSrc)
    }
  }, [result])

  useEffect(() => {
    if (stage !== 'done') return
    setBurst(true)
    const timer = window.setTimeout(() => setBurst(false), 1200)
    return () => window.clearTimeout(timer)
  }, [stage, result?.afterSrc])

  const reset = () => {
    setStage('idle')
    setProgress(0)
    setStatus('Upscaling…')
    setError(null)
    setFile(null)
    setVideoEl(null)
    setPreviewUrl(null)
    setPosterUrl(null)
    setResult(null)
    setBurst(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const acceptFile = async (next: File | undefined | null) => {
    if (!next) return
    setError(null)
    setResult(null)

    if (!next.type.startsWith('video/')) {
      setError('Please choose an MP4, WebM, or MOV video.')
      return
    }
    if (next.size > 200 * 1024 * 1024) {
      setError('Keep videos under 200 MB.')
      return
    }

    try {
      const loaded = await loadVideoFromFile(next)
      const meta = getVideoMeta(loaded.video)
      if (meta.width > 1920 || meta.height > 1920) {
        URL.revokeObjectURL(loaded.url)
        setError('Use videos 1920×1920 or smaller.')
        return
      }

      // Capture a poster frame for the processing viz.
      loaded.video.currentTime = Math.min(0.1, Math.max(meta.duration / 2, 0))
      await new Promise<void>((resolve) => {
        loaded.video.onseeked = () => resolve()
      })
      const poster = document.createElement('canvas')
      poster.width = meta.width
      poster.height = meta.height
      const ctx = poster.getContext('2d')
      ctx?.drawImage(loaded.video, 0, 0)
      setPosterUrl(poster.toDataURL('image/jpeg', 0.85))

      setFile(next)
      setVideoEl(loaded.video)
      setPreviewUrl(loaded.url)
      setStage('ready')
    } catch {
      setError('Could not open that video. Try another file.')
      setStage('idle')
    }
  }

  const runUpscale = async () => {
    if (!file || !videoEl) return
    setError(null)
    setResult(null)
    setStage('working')
    setProgress(0)
    setStatus(mode === 'ai' ? 'Warming up AI…' : 'Preparing video…')

    try {
      const output = await upscaleVideo(videoEl, scale, mode, (value, label) => {
        startTransition(() => {
          setProgress(value)
          if (label) setStatus(label)
        })
      })
      const base = file.name.replace(/\.[^/.]+$/, '')
      const ext = output.mimeType.includes('webm') ? 'webm' : 'mp4'

      setResult({
        afterSrc: output.dataUrl,
        filename: `${base}_${scale}x_pixelboost.${ext}`,
        width: output.width,
        height: output.height,
        sizeLabel: formatBytes(output.blob.size),
        scale,
        mode,
        frameCount: output.frameCount,
      })
      setStage('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Video upscaling failed.'
      setError(message)
      setStage('ready')
    }
  }

  const download = () => {
    if (!result) return
    const anchor = document.createElement('a')
    anchor.href = result.afterSrc
    anchor.download = result.filename
    anchor.click()
  }

  const meta = videoEl ? getVideoMeta(videoEl) : null
  const outputPreview = meta ? `${meta.width * scale}×${meta.height * scale}` : null

  return (
    <main className={`tool tool--${stage}`}>
      <div className="tool__aurora" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>

      <div className="tool__intro anim-in">
        <h1>Upscale Video</h1>
        <p>Increase video resolution in your browser. Private — files never leave this device.</p>
      </div>

      {stage === 'idle' && (
        <div className="tool__panel anim-panel">
          <div
            className={`uploader${dragOver ? ' is-drag' : ''}`}
            onDragEnter={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragOver={(event) => {
              event.preventDefault()
              setDragOver(true)
            }}
            onDragLeave={(event) => {
              event.preventDefault()
              if (!event.currentTarget.contains(event.relatedTarget as Node)) {
                setDragOver(false)
              }
            }}
            onDrop={(event) => {
              event.preventDefault()
              setDragOver(false)
              void acceptFile(event.dataTransfer.files[0])
            }}
          >
            <div className="uploader__pulse" aria-hidden="true" />
            <input
              ref={fileInputRef}
              id={inputId}
              className="sr-only"
              type="file"
              accept="video/mp4,video/webm,video/quicktime,video/*"
              onChange={(event) => void acceptFile(event.target.files?.[0])}
            />
            <button
              type="button"
              className="btn-select btn-shine"
              onClick={() => fileInputRef.current?.click()}
            >
              Select video
            </button>
            <p className="uploader__hint">or drop a video here</p>
            <p className="uploader__meta">MP4, WebM · up to 1920px · no audio in export</p>
          </div>

          {error && <p className="error anim-shake">{error}</p>}
        </div>
      )}

      {stage === 'ready' && file && videoEl && previewUrl && meta && (
        <div className="tool__panel tool__panel--ready anim-panel">
          <div className="file-row anim-pop">
            <video className="status-thumb" src={previewUrl} muted playsInline />
            <div className="file-row__text">
              <strong>{file.name}</strong>
              <span>
                {meta.width}×{meta.height} · {meta.duration.toFixed(1)}s · {formatBytes(file.size)}
              </span>
            </div>
          </div>

          <div className="scale-block">
            <p className="scale-block__label">Upscale by</p>
            <div className="scale-row" role="radiogroup" aria-label="Upscale amount">
              {SCALES.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  className={`scale-chip${scale === option.value ? ' is-active' : ''}`}
                  style={{ animationDelay: `${120 + index * 70}ms` }}
                  onClick={() => setScale(option.value)}
                  aria-checked={scale === option.value}
                >
                  <span className="scale-chip__value">{option.label}</span>
                  <span className="scale-chip__hint">{option.hint}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="scale-block">
            <p className="scale-block__label">Enhance mode</p>
            <div className="scale-row scale-row--2" role="radiogroup" aria-label="Enhance mode">
              {MODES.map((option, index) => (
                <button
                  key={option.value}
                  type="button"
                  role="radio"
                  className={`scale-chip${mode === option.value ? ' is-active' : ''}`}
                  style={{ animationDelay: `${180 + index * 70}ms` }}
                  onClick={() => setMode(option.value)}
                  aria-checked={mode === option.value}
                >
                  <span className="scale-chip__value">{option.label}</span>
                  <span className="scale-chip__hint">{option.hint}</span>
                </button>
              ))}
            </div>
            {outputPreview && (
              <p className="scale-block__out anim-tick" key={`${outputPreview}-${mode}`}>
                Output: <strong>{outputPreview}</strong>
                {mode === 'ai' ? ' · AI frames (slower)' : ' · high-quality scale'}
              </p>
            )}
          </div>

          <button
            type="button"
            className="btn-select btn-select--block btn-shine"
            onClick={() => void runUpscale()}
          >
            Upscale video {scale}x
          </button>
          <button type="button" className="btn-text" onClick={reset}>
            Choose another video
          </button>

          {error && <p className="error anim-shake">{error}</p>}
        </div>
      )}

      {stage === 'working' && (
        <div className="tool__panel tool__panel--status anim-panel">
          <ProcessingViz
            previewUrl={posterUrl || '/sample-lowres.jpg'}
            progress={progress}
            scale={scale}
          />
          <h2 className="anim-pulse-text">Upscaling video {scale}x…</h2>
          <p className="status-file">{file?.name}</p>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="progress__fill" style={{ width: `${Math.max(8, progress * 100)}%` }} />
            <div className="progress__glow" style={{ left: `${Math.max(8, progress * 100)}%` }} />
          </div>
          <p className="status-pct">{status}</p>
        </div>
      )}

      {stage === 'done' && result && (
        <div className={`tool__panel tool__panel--done anim-panel${burst ? ' is-burst' : ''}`}>
          {burst && (
            <div className="burst" aria-hidden="true">
              {Array.from({ length: 18 }, (_, i) => (
                <span key={i} style={{ '--i': i } as CSSProperties} />
              ))}
            </div>
          )}
          <div className="result-frame">
            <video
              className="result-preview"
              src={result.afterSrc}
              controls
              autoPlay
              muted
              loop
              playsInline
            />
            <div className="result-reveal" aria-hidden="true" />
          </div>
          <p className="result-meta anim-pop">
            {result.scale}x · {result.mode.toUpperCase()} · {result.width}×{result.height} ·{' '}
            {result.frameCount} frames · {result.sizeLabel}
          </p>
          <button type="button" className="btn-select btn-shine anim-pop" onClick={download}>
            Download
          </button>
          <button
            type="button"
            className="btn-text"
            onClick={() => {
              setResult(null)
              setStage('ready')
            }}
          >
            Change settings
          </button>
          <button type="button" className="btn-text" onClick={reset}>
            Upscale another
          </button>
        </div>
      )}
    </main>
  )
}
