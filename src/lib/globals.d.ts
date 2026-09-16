declare global {
  /** MV3 `chrome`, typed from the same generated Chrome API types the test fake implements */
  var chrome: typeof import('@wxt-dev/browser').browser

  /** Inlined by vite from .env files, see vite.config.ts */
  interface ImportMetaEnv {
    readonly VITE_API_URL: string
    readonly VITE_DOH_API_URL: string
  }
}

export {}
