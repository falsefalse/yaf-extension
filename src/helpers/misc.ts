/* domains and IPs */

export function getDomain(url: string | undefined) {
  if (!url) return

  const { protocol, hostname } = new URL(url)
  if (!['http:', 'https:', 'ftp:'].includes(protocol)) return

  return hostname
}

export function isLocal(ip: string | undefined): ip is string {
  if (!ip) return false

  if (ip == 'localhost') return true

  const octets = ip.split('.').map(o => parseInt(o, 10))
  if (octets.some(isNaN) || octets.length != 4) return false

  // 0.0.0.0
  if (octets.every(o => o === 0)) return true

  const [first = 0, second = 0] = octets
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

export const isFirefox = () => 'dns' in chrome

export const DEFAULT_ICON = '/img/icon/32.png'

/* Date */
const DAY = 24 * 60 * 60 * 1000
const relative = new Intl.RelativeTimeFormat('en', {
  numeric: 'auto',
  style: 'long'
})

export function resolvedAtHint(epoch: number) {
  const now = new Date()
  const resolved = new Date(epoch)

  // relative past
  const passedDays = (now.getTime() - resolved.getTime()) / DAY
  const [passed, unit]: [number, Intl.RelativeTimeFormatUnit] =
    passedDays >= 30
      ? [passedDays / 30, 'month']
      : passedDays >= 7
      ? [passedDays / 7, 'week']
      : [passedDays, 'day']

  const agoRelative = relative.format(-1 * Math.round(passed), unit)

  // clock
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
