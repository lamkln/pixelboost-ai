import { startTransition, useEffect, useId, useRef, useState } from 'react'
import {
  formatBytes,
  loadImageFromFile,
  type ScaleFactor,
  upscaleImage,
} from '../lib/upscale'

const SCALES: ScaleFactor[] = [2, 4]

type ResultState = {
  afterSrc: string
  filename: string
  width: number
  height: number
  sizeLabel: string
}

type Stage = 'idle' | 'working' | 'done'

export function Tool() {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [scale, setScale] = useState<ScaleFactor>(2)
  const [stage, setStage] = useState<Stage>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [fileName, setFileName] = useState<string | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [dragOver, setDragOver] = useState(false)

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

  const reset = () => {
    setStage('idle')
    setProgress(0)
    setError(null)
    setFileName(null)
    setPreviewUrl(null)
    setResult(null)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const processFile = async (next: File | undefined | null, nextScale: ScaleFactor) => {
    if (!next) return
    setError(null)
    setResult(null)

    if (!next.type.startsWith('image/')) {
      setError('Please choose a JPG, PNG, or WebP image.')
      return
    }
    if (next.size > 15 * 1024 * 1024) {
      setError('Keep uploads under 15 MB.')
      return
    }

    try {
      const img = await loadImageFromFile(next)
      if (img.width > 1600 || img.height > 1600) {
        setError('Use images 1600×1600 or smaller.')
        return
      }

      const url = URL.createObjectURL(next)
      setFileName(next.name)
      setPreviewUrl(url)
      setStage('working')
      setProgress(0)

      const output = await upscaleImage(img, nextScale, 'png', (value) => {
        startTransition(() => setProgress(value))
      })
      const base = next.name.replace(/\.[^/.]+$/, '')

      setResult({
        afterSrc: output.dataUrl,
        filename: `${base}_${nextScale}x_pixelboost.png`,
        width: output.width,
        height: output.height,
        sizeLabel: formatBytes(output.blob.size),
      })
      setStage('done')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upscaling failed.'
      setError(
        /fetch|network|Load|model/i.test(message)
          ? 'Could not load the AI model. Try again.'
          : message,
      )
      setStage('idle')
    }
  }

  const onPick = (file: File | undefined | null) => {
    void processFile(file, scale)
  }

  const download = () => {
    if (!result) return
    const anchor = document.createElement('a')
    anchor.href = result.afterSrc
    anchor.download = result.filename
    anchor.click()
  }

  return (
    <main className="tool">
      <div className="tool__intro">
        <h1>Upscale Image</h1>
        <p>Increase image resolution with AI. Free, private, no upload to a server.</p>
      </div>

      {stage === 'idle' && (
        <div className="tool__panel">
          <div className="scale-row" role="group" aria-label="Upscale amount">
            {SCALES.map((value) => (
              <button
                key={value}
                type="button"
                className={`scale-chip${scale === value ? ' is-active' : ''}`}
                onClick={() => setScale(value)}
                aria-pressed={scale === value}
              >
                {value}x
              </button>
            ))}
          </div>

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
              onPick(event.dataTransfer.files[0])
            }}
          >
            <input
              ref={fileInputRef}
              id={inputId}
              className="sr-only"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(event) => onPick(event.target.files?.[0])}
            />
            <button
              type="button"
              className="btn-select"
              onClick={() => fileInputRef.current?.click()}
            >
              Select image
            </button>
            <p className="uploader__hint">or drop an image here</p>
            <p className="uploader__meta">JPG, PNG, WebP · up to 1600px</p>
          </div>

          {error && <p className="error">{error}</p>}
        </div>
      )}

      {stage === 'working' && (
        <div className="tool__panel tool__panel--status">
          {previewUrl && <img className="status-thumb" src={previewUrl} alt="" />}
          <h2>Upscaling image…</h2>
          <p className="status-file">{fileName}</p>
          <div
            className="progress"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
          >
            <div className="progress__fill" style={{ width: `${Math.max(8, progress * 100)}%` }} />
          </div>
          <p className="status-pct">
            {progress < 0.05 ? 'Loading AI model…' : `${Math.round(progress * 100)}%`}
          </p>
        </div>
      )}

      {stage === 'done' && result && (
        <div className="tool__panel tool__panel--done">
          <img className="result-preview" src={result.afterSrc} alt="Upscaled result" />
          <p className="result-meta">
            {result.width}×{result.height} · {result.sizeLabel}
          </p>
          <button type="button" className="btn-select" onClick={download}>
            Download
          </button>
          <button type="button" className="btn-text" onClick={reset}>
            Upscale another
          </button>
        </div>
      )}
    </main>
  )
}
