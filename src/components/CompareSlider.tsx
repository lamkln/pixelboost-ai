import { useEffect, useId, useRef, useState } from 'react'

type CompareSliderProps = {
  beforeSrc: string
  afterSrc: string
  beforeLabel?: string
  afterLabel?: string
}

export function CompareSlider({
  beforeSrc,
  afterSrc,
  beforeLabel = 'Original',
  afterLabel = 'Upscaled',
}: CompareSliderProps) {
  const id = useId()
  const trackRef = useRef<HTMLDivElement>(null)
  const [position, setPosition] = useState(52)
  const [trackWidth, setTrackWidth] = useState(0)

  useEffect(() => {
    const track = trackRef.current
    if (!track) return

    const sync = () => setTrackWidth(track.clientWidth)
    sync()

    const observer = new ResizeObserver(sync)
    observer.observe(track)
    return () => observer.disconnect()
  }, [])

  const updateFromClientX = (clientX: number) => {
    const track = trackRef.current
    if (!track) return
    const rect = track.getBoundingClientRect()
    const next = ((clientX - rect.left) / rect.width) * 100
    setPosition(Math.min(98, Math.max(2, next)))
  }

  return (
    <div className="compare" ref={trackRef}>
      <img className="compare__img compare__img--after" src={afterSrc} alt={afterLabel} />
      <div className="compare__before" style={{ width: `${position}%` }}>
        <img
          className="compare__img"
          src={beforeSrc}
          alt={beforeLabel}
          draggable={false}
          style={trackWidth ? { width: trackWidth } : undefined}
        />
      </div>
      <div className="compare__divider" style={{ left: `${position}%` }} aria-hidden="true">
        <span className="compare__handle" />
      </div>
      <input
        id={id}
        className="compare__range"
        type="range"
        min={2}
        max={98}
        value={position}
        aria-label="Compare original and upscaled"
        onChange={(event) => setPosition(Number(event.target.value))}
        onPointerDown={(event) => updateFromClientX(event.clientX)}
        onPointerMove={(event) => {
          if (event.buttons === 1) updateFromClientX(event.clientX)
        }}
      />
      <span className="compare__tag compare__tag--before">{beforeLabel}</span>
      <span className="compare__tag compare__tag--after">{afterLabel}</span>
    </div>
  )
}
