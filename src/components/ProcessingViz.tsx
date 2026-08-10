import type { CSSProperties } from 'react'

type ProcessingVizProps = {
  previewUrl: string
  progress: number
  scale: number
}

export function ProcessingViz({ previewUrl, progress, scale }: ProcessingVizProps) {
  const pct = Math.max(0, Math.min(100, Math.round(progress * 100)))

  return (
    <div className="viz" aria-hidden="true">
      <div className="viz__orbit viz__orbit--a" />
      <div className="viz__orbit viz__orbit--b" />
      <div className="viz__orbit viz__orbit--c" />

      <div className="viz__stage">
        <div className="viz__frame">
          <img className="viz__img" src={previewUrl} alt="" />
          <div className="viz__pixelate" style={{ opacity: Math.max(0.08, 1 - progress) }} />
          <div className="viz__scan" />
          <div className="viz__sheen" />
          <div className="viz__grid" />
        </div>

        <svg className="viz__ring" viewBox="0 0 120 120">
          <circle className="viz__ring-track" cx="60" cy="60" r="54" />
          <circle
            className="viz__ring-value"
            cx="60"
            cy="60"
            r="54"
            style={{ strokeDashoffset: `${339.3 - (339.3 * pct) / 100}` }}
          />
        </svg>

        <div className="viz__badge">
          <span>{scale}x</span>
        </div>
      </div>

      <div className="viz__sparks">
        {Array.from({ length: 12 }, (_, i) => (
          <span key={i} style={{ '--i': i } as CSSProperties} />
        ))}
      </div>
    </div>
  )
}
