/* Domains and IPs */

export function getDomain(url: string | undefined) {
  if (!url) return

  const { protocol, hostname } = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(protocol)) return

  return hostname
}

function octets(host: string) {
  const parts = host.split('.').map(o => parseInt(o, 10))

  return parts.length == 4 && !parts.some(isNaN) ? parts : undefined
}

/** @see https://tailscale.com/docs/reference/ip-pool */
export function isTailscale(host: string | undefined): host is string {
  if (!host) return false

  // MagicDNS names
  if (host.endsWith('.ts.net')) return true

  // fd7a:115c:a1e0::/48, URL keeps IPv6 hostnames bracketed and lowercased
  if (host.startsWith('[fd7a:115c:a1e0:')) return true

  const [first = 0, second = 0] = octets(host) ?? []
  // 100.64.0.0 - 100.127.255.255
  return first === 100 && second >= 64 && second <= 127
}

export function isLocal(host: string | undefined): host is string {
  if (!host) return false

  if (host == 'localhost') return true

  if (isTailscale(host)) return true

  const parts = octets(host)
  if (!parts) return false

  // 0.0.0.0
  if (parts.every(o => o === 0)) return true

  const [first = 0, second = 0] = parts
  // 127.0.0.1 - 127.255.255.255
  if (first === 127) return true
  // 10.0.0.0 - 10.255.255.255
  if (first === 10) return true
  // 172.16.0.0 - 172.31.255.255
  if (first === 172 && second >= 16 && second <= 31) return true
  // 192.168.0.0 - 192.168.255.255
  if (first === 192 && second === 168) return true

  return false
}

/* Misc */

export const isFirefox = () => 'dns' in chrome

export const DEFAULT_ICON = '/img/icon/32.png'

export async function isNotPinned() {
  return !(await chrome.action.getUserSettings()).isOnToolbar
}

export async function getCurrentTab() {
  const [activeTab] = await chrome.tabs.query({
    active: true,
    currentWindow: true
  })

  return activeTab
}

/* Dates */

const MINUTE = 60 * 1000
const DAY = 24 * 60 * MINUTE
const WEEK = 7 * DAY

const passedMoreThan = (howMuchEpoch: number, sinceEpoch: number) =>
  new Date().getTime() - sinceEpoch > howMuchEpoch

const passedMoreThanWeek = (sinceEpoch: number) =>
  passedMoreThan(WEEK, sinceEpoch)

const passedMoreThanDay = (sinceEpoch: number) =>
  passedMoreThan(DAY, sinceEpoch)

const passedMoreThanMinute = (sinceEpoch: number) =>
  passedMoreThan(MINUTE, sinceEpoch)

export { passedMoreThanWeek, passedMoreThanDay, passedMoreThanMinute }

export function daysAgo(epochTime: number) {
  const relative = new Intl.RelativeTimeFormat('en', {
    numeric: 'auto',
    style: 'long'
  })

  const now = new Date()
  const then = new Date(epochTime)

  const passedDays = (now.getTime() - then.getTime()) / DAY
  const [passed, unit]: [number, Intl.RelativeTimeFormatUnit] =
    passedDays >= 30
      ? [passedDays / 30, 'month']
      : passedDays >= 7
        ? [passedDays / 7, 'week']
        : [passedDays, 'day']
  // discard fractions instead of rounding, we care about full days only
  return relative.format(-1 * ~~passed, unit)
}

export function resolvedAtHint(resolvedAtEpoch: number) {
  const resolved = new Date(resolvedAtEpoch)
  const agoRelative = daysAgo(resolvedAtEpoch)

  const clocks = {
    0: ['🕛', '🕧'],
    1: ['🕐', '🕜'],
    2: ['🕑', '🕝'],
    3: ['🕒', '🕞'],
    4: ['🕓', '🕟'],
    5: ['🕔', '🕠'],
    6: ['🕕', '🕡'],
    7: ['🕖', '🕢'],
    8: ['🕗', '🕣'],
    9: ['🕘', '🕤'],
    10: ['🕙', '🕥'],
    11: ['🕚', '🕦'],
    12: ['🕛', '🕧']
  } as const

  const hour = (resolved.getHours() % 12) as keyof typeof clocks
  const pastHalf = resolved.getMinutes() >= 30
  const clock = clocks[hour][Number(pastHalf)]

  // time
  const time = resolved.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  })

  return `Resolved at ${clock} ${time} ${agoRelative}`
}
