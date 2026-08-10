import { Tool } from './components/Tool'

function App() {
  return (
    <div className="page">
      <header className="topbar">
        <a className="topbar__brand" href="/">
          <span className="topbar__mark" aria-hidden="true" />
          PixelBoost
        </a>
      </header>

      <Tool />

      <footer className="footer">
        <p>© PixelBoost — upscale images in your browser. Files stay on your device.</p>
      </footer>
    </div>
  )
}

export default App
