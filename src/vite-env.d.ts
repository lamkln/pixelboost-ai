/// <reference types="vite/client" />

declare module '@upscalerjs/esrgan-slim/2x' {
  import type { ModelDefinition } from 'upscaler'
  const model: ModelDefinition
  export default model
}

declare module '@upscalerjs/esrgan-slim/4x' {
  import type { ModelDefinition } from 'upscaler'
  const model: ModelDefinition
  export default model
}
