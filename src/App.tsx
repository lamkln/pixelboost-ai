import { useState } from 'react'
import { Tool } from './components/Tool'
import { VideoTool } from './components/VideoTool'

type Mode = 'image' | 'video'

function App() {
  const [mode, setMode] = useState<Mode>('video')

  return (
    <div className="page">
      <header className="topbar">
        <a className="topbar__brand" href="/">
          <span className="topbar__mark" aria-hidden="true" />
          PixelBoost
        </a>
        <nav className="topbar__modes" aria-label="Tool">
          <button
            type="button"
            className={mode === 'image' ? 'is-active' : undefined}
            onClick={() => setMode('image')}
          >
            Image
          </button>
          <button
            type="button"
            className={mode === 'video' ? 'is-active' : undefined}
            onClick={() => setMode('video')}
          >
            Video
          </button>
        </nav>
      </header>

      {mode === 'image' ? <Tool key="image" /> : <VideoTool key="video" />}

      <footer className="footer">
        <p>© PixelBoost — upscale images & videos in your browser. Files stay on your device.</p>
      </footer>
    </div>
  )
}

export default App
