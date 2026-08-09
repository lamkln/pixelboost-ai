export function Hero() {
  return (
    <header className="hero">
      <img
        className="hero__media"
        src="/hero.jpg"
        alt="Mountain ridges catching early light — the kind of detail PixelBoost recovers"
      />
      <div className="hero__veil" aria-hidden="true" />

      <nav className="nav">
        <a className="nav__brand" href="#top" aria-label="PixelBoost home">
          PixelBoost
        </a>
        <a className="nav__link" href="#workspace">
          Upscale
        </a>
      </nav>

      <div className="hero__copy">
        <p className="brand-mark">PixelBoost</p>
        <h1>Enlarge images without washing out the detail.</h1>
        <p className="hero__lede">
          Private ESRGAN upscaling in your browser — your files never leave this device.
        </p>
        <div className="hero__actions">
          <a className="btn btn--primary" href="#workspace">
            Upscale an image
          </a>
          <a className="btn btn--ghost" href="#how">
            How it works
          </a>
        </div>
      </div>
    </header>
  )
}
