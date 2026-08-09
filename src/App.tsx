import { Hero } from './components/Hero'
import { Workspace } from './components/Workspace'

function App() {
  return (
    <div id="top" className="page">
      <Hero />

      <main>
        <Workspace />

        <section className="how" id="how">
          <div className="section-intro">
            <h2>Local processing. Clear steps.</h2>
            <p>No accounts, no uploads, no waiting on a remote GPU queue.</p>
          </div>
          <ol className="how__list">
            <li>
              <strong>Choose a photo</strong>
              <span>Drop any common image format into the workspace.</span>
            </li>
            <li>
              <strong>Pick a scale</strong>
              <span>2×, 4×, or 8× using an ESRGAN model that reconstructs edges and texture.</span>
            </li>
            <li>
              <strong>Download</strong>
              <span>Export PNG, JPG, or WebP — inference stays on your device.</span>
            </li>
          </ol>
        </section>
      </main>

      <footer className="footer">
        <p className="footer__brand">PixelBoost</p>
        <p>Image upscaling that stays in the browser.</p>
      </footer>
    </div>
  )
}

export default App
