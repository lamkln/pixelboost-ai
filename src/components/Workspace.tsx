import { startTransition, useEffect, useId, useRef, useState } from 'react'
import { CompareSlider } from './CompareSlider'
import {
  formatBytes,
  loadImageFromFile,
  type OutputFormat,
  type ScaleFactor,
  upscaleImage,
} from '../lib/upscale'

const SCALES: ScaleFactor[] = [2, 4, 8]
const FORMATS: { value: OutputFormat; label: string }[] = [
  { value: 'png', label: 'PNG' },
  { value: 'jpg', label: 'JPG' },
  { value: 'webp', label: 'WebP' },
]

type ResultState = {
  beforeSrc: string
  afterSrc: string
  beforeLabel: string
  afterLabel: string
  filename: string
  blob: Blob
}

export function Workspace() {
  const inputId = useId()
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [imageEl, setImageEl] = useState<HTMLImageElement | null>(null)
  const [scale, setScale] = useState<ScaleFactor>(2)
  const [format, setFormat] = useState<OutputFormat>('png')
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<ResultState | null>(null)
  const [dragOver, setDragOver] = useState(false)

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      if (result?.afterSrc) URL.revokeObjectURL(result.afterSrc)
    }
  }, [previewUrl, result])

  const acceptFile = async (next: File | undefined | null) => {
    if (!next) return
    setError(null)
    setResult(null)

    if (!next.type.startsWith('image/')) {
      setError('Please choose a JPG, PNG, or WebP image.')
      return
    }
    if (next.size > 25 * 1024 * 1024) {
      setError('Keep uploads under 25 MB for smooth browser processing.')
      return
    }

    try {
      const img = await loadImageFromFile(next)
      if (img.width > 3500 || img.height > 3500) {
        setError('Source images should be 3500×3500 or smaller.')
        return
      }
      if (previewUrl) URL.revokeObjectURL(previewUrl)
      const url = URL.createObjectURL(next)
      setFile(next)
      setPreviewUrl(url)
      setImageEl(img)
    } catch {
      setError('Could not open that image. Try another file.')
    }
  }

  const runUpscale = async () => {
    if (!file || !imageEl) return
    setBusy(true)
    setError(null)
    setProgress(0)
    if (result?.afterSrc) URL.revokeObjectURL(result.afterSrc)
    setResult(null)

    try {
      const output = await upscaleImage(imageEl, scale, format, (value) => {
        startTransition(() => setProgress(value))
      })
      const base = file.name.replace(/\.[^/.]+$/, '')
      setResult({
        beforeSrc: previewUrl!,
        afterSrc: output.dataUrl,
        beforeLabel: `${imageEl.width}×${imageEl.height}`,
        afterLabel: `${output.width}×${output.height} · ${formatBytes(output.blob.size)}`,
        filename: `${base}_${scale}x_pixelboost.${format === 'jpg' ? 'jpg' : format}`,
        blob: output.blob,
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Upscaling failed.')
    } finally {
      setBusy(false)
    }
  }

  const download = () => {
    if (!result) return
    const anchor = document.createElement('a')
    anchor.href = result.afterSrc
    anchor.download = result.filename
    anchor.click()
  }

  return (
    <section className="workspace" id="workspace">
      <div className="section-intro">
        <h2>Drop an image. Choose a scale. Download the result.</h2>
        <p>Processing stays on your machine — nothing is uploaded.</p>
      </div>

      <div
        className={`dropzone${dragOver ? ' dropzone--active' : ''}${file ? ' dropzone--ready' : ''}`}
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
        onClick={() => fileInputRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => {
          if (event.key === 'Enter' || event.key === ' ') {
            event.preventDefault()
            fileInputRef.current?.click()
          }
        }}
      >
        <input
          ref={fileInputRef}
          id={inputId}
          className="sr-only"
          type="file"
          accept="image/jpeg,image/png,image/webp,image/gif"
          onChange={(event) => void acceptFile(event.target.files?.[0])}
        />
        {previewUrl ? (
          <div className="dropzone__preview">
            <img src={previewUrl} alt="Selected upload" />
            <div>
              <strong>{file?.name}</strong>
              <span>
                {imageEl ? `${imageEl.width}×${imageEl.height}` : ''}
                {file ? ` · ${formatBytes(file.size)}` : ''}
              </span>
              <em>Click to replace</em>
            </div>
          </div>
        ) : (
          <div className="dropzone__empty">
            <span className="dropzone__glyph" aria-hidden="true" />
            <strong>Drop an image here</strong>
            <span>or click to browse · JPG, PNG, WebP · up to 25 MB</span>
          </div>
        )}
      </div>

      <div className="controls">
        <fieldset className="control">
          <legend>Scale</legend>
          <div className="segmented">
            {SCALES.map((value) => (
              <button
                key={value}
                type="button"
                className={scale === value ? 'is-active' : undefined}
                onClick={() => setScale(value)}
                aria-pressed={scale === value}
              >
                {value}×
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="control">
          <legend>Format</legend>
          <div className="segmented">
            {FORMATS.map((item) => (
              <button
                key={item.value}
                type="button"
                className={format === item.value ? 'is-active' : undefined}
                onClick={() => setFormat(item.value)}
                aria-pressed={format === item.value}
              >
                {item.label}
              </button>
            ))}
          </div>
        </fieldset>

        <button
          type="button"
          className="btn btn--primary btn--wide"
          disabled={!file || busy}
          onClick={() => void runUpscale()}
        >
          {busy ? `Upscaling… ${Math.round(progress * 100)}%` : 'Upscale image'}
        </button>
      </div>

      {busy && (
        <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(progress * 100)}>
          <div className="progress__fill" style={{ width: `${Math.max(6, progress * 100)}%` }} />
        </div>
      )}

      {error && <p className="error">{error}</p>}

      {result && (
        <div className="result">
          <div className="result__meta">
            <p>
              <span>{result.beforeLabel}</span>
              <span aria-hidden="true"> → </span>
              <span>{result.afterLabel}</span>
            </p>
            <button type="button" className="btn btn--primary" onClick={download}>
              Download
            </button>
          </div>
          <CompareSlider
            beforeSrc={result.beforeSrc}
            afterSrc={result.afterSrc}
            beforeLabel="Original"
            afterLabel="Upscaled"
          />
        </div>
      )}
    </section>
  )
}
