import { fakeBrowser } from '@webext-core/fake-browser'
import type { Browser } from '@wxt-dev/browser'
import type { DoHResponse, GeoResponse } from '../src/lib/types'

/* chrome, browser */

vi.stubGlobal('chrome', fakeBrowser)
// firefox namespace, `'dns' in chrome` is what switches the code to it
vi.stubGlobal('browser', { dns: { resolve: vi.fn() } })

// spies stay installed across tests, `mockReset` only forgets calls and implementations
vi.spyOn(chrome.action, 'setTitle')
const setIcon = vi.spyOn(chrome.action, 'setIcon')
const getManifest = vi.spyOn(chrome.runtime, 'getManifest')

// fake-browser knows nothing of pinning
export const getUserSettings =
  vi.fn<() => Promise<Browser.action.UserSettings>>()
let onUserSettingsChanged: (
  change: Browser.action.UserSettingsChange
) => unknown
Object.assign(fakeBrowser.action, {
  getUserSettings,
  onUserSettingsChanged: {
    addListener(listener: typeof onUserSettingsChanged) {
      onUserSettingsChanged = listener
    }
  }
})
export const firePinnedChange = (isOnToolbar: boolean) =>
  onUserSettingsChanged({ isOnToolbar })

afterEach(() => {
  fakeBrowser.storage.resetState()
  fakeBrowser.action.resetState()
})

/* fetch */

const realFetch = globalThis.fetch

type Responder = () => Response | Promise<Response>
const routes: [pattern: string, respond: Responder][] = []

// the code under test only ever fetches string URLs, `typeof fetch` would allow `Request` too
type Fetch = (url: string, init?: RequestInit) => Promise<Response>

export const fetchMock = vi.fn<Fetch>(async (url, init) => {
  const route = routes.find(([pattern]) => url.includes(pattern))
  if (route) return route[1]()

  // extension assets are served by vite as they are
  if (url.startsWith('/')) return realFetch(url, init)

  // network is down unless a spec says otherwise
  return new Response(null, { status: 500 })
})
vi.stubGlobal('fetch', fetchMock)

/** Answer requests whose URL includes `pattern`, the latest registered wins */
export function respond(pattern: string, responder: Responder) {
  routes.unshift([pattern, responder])
}

export const json = (body: unknown, init?: ResponseInit) => () =>
  Response.json(body, init)

/** URLs fetched so far, in order */
export const requested = () =>
  fetchMock.mock.calls.map(([input]) => String(input))

/* Defaults, re-applied since `mockReset` wipes them before every test */

beforeEach(() => {
  routes.length = 0

  setIcon.mockResolvedValue(undefined)
  getUserSettings.mockResolvedValue({ isOnToolbar: true })
  getManifest.mockReturnValue({
    manifest_version: 3,
    name: 'YAF',
    version: 'x.y.z'
  })
})

/* URLs the code under test builds */

export const dohUrl = (domain: string) =>
  `${import.meta.env.VITE_DOH_API_URL}?type=1&name=${domain}`

export const geoUrl = (ipOrDomain: string) =>
  `${import.meta.env.VITE_API_URL}/${ipOrDomain}`

/* Fixtures */

export const tab = (fields: Partial<Browser.tabs.Tab>) =>
  fields as Browser.tabs.Tab

// `tabs.query` has a callback overload, `mockResolvedValue` picks it up and wants `void`
export const currentTab = (fields: Partial<Browser.tabs.Tab>) =>
  vi.spyOn(chrome.tabs, 'query').mockImplementation(async () => [tab(fields)])

export const getDohResponse = (ip: string): DoHResponse => ({
  Status: 0,
  Answer: [{ type: 1, data: ip, TTL: 0, name: 'anything' }]
})

export const getGeoResponse = (
  ip: string,
  overrides?: Partial<GeoResponse>
): GeoResponse => ({
  country_code: 'UA',
  country_name: 'Ukraine',
  ip, // server echoes IP back
  city: 'Boyarka',
  region: 'Kyiv Metro Area',
  ...overrides
})
