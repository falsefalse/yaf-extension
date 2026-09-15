import {
  daysAgo,
  getDomain,
  isLocal,
  resolvedAtHint
} from '../../src/helpers/index.js'

describe('helpers.ts', () => {
  describe('isLocal', () => {
    // prettier-ignore
    const cases = [
      [true,  'localhost'],
      [true,  '0.0.0.0'],
      [false, '0.0.0.1'],

      [true,  '127.0.0.0'],
      [true,  '127.0.0.1'],
      [true,  '127.1.1.1'],

      [true,  '10.0.0.1'],
      [true,  '10.1.1.1'],
      [true,  '10.0.0.0'],

      [false, '172.15.0.0'],
      [true,  '172.16.0.0'],
      [true,  '172.16.100.0'],
      [true,  '172.31.0.0'],
      [false, '172.32.0.0'],

      [true,  '192.168.0.0'],
      [false, '192.169.0.0'],
      [false, '191.168.0.0'],

      [false, '0.0'],
      [false, '....'],
      [false, undefined],
      [false, '123'],
      [false, '127.0.0.0.boop.com'],
      [false, '10.o.0.0.com'],
      [false, '8.8.8.8'],
      [false, 'geo.furman.im'],
      [false, 'battlestation'],
    ] as const

    cases.forEach(([expected, ip]) => {
      it(`${expected ? 'local' : 'global'}\t${ip}`, () => {
        expect(isLocal(ip)).toBe(expected)
      })
    })
  })

  describe('getDomain', () => {
    it('returns domain for http, https and ftp schemas', () => {
      expect(getDomain('http://boop.doop')).toBe('boop.doop')
      expect(
        getDomain('https://127.0.0.0.boop.com/welp?some=come&utm=sucks')
      ).toBe('127.0.0.0.boop.com')
      expect(getDomain('ftp://scene')).toBe('scene')
    })

    it('returns undefined for everything else', () => {
      expect(getDomain('')).toBeUndefined()
      expect(getDomain(undefined)).toBeUndefined()
      expect(getDomain('gopher://old')).toBeUndefined()
      expect(getDomain('chrome://new-tab')).toBeUndefined()
      expect(getDomain('magnet://h.a.s.h')).toBeUndefined()
    })
  })

  describe('daysAgo', () => {
    beforeAll(() => {
      const now = new Date('2023-04-14T04:20:00.000Z') // April
      vi.useFakeTimers({ now, toFake: ['Date'] })
    })
    afterAll(() => vi.useRealTimers())

    it('returns relative date', () => {
      const fourteenDaysAgo = new Date('2023-03-31T04:20:00.000Z') // March
      const agos = []
      while (agos.length <= 14) {
        agos.push(daysAgo(fourteenDaysAgo.getTime()))
        fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() + 1)
      }

      expect(agos).toEqual([
        '2 weeks ago',
        'last week',
        'last week',
        'last week',
        'last week',
        'last week',
        'last week',
        'last week',
        '6 days ago',
        '5 days ago',
        '4 days ago',
        '3 days ago',
        '2 days ago',
        'yesterday',
        'today'
      ])
    })
  })

  describe('resolvedAtHint', () => {
    const cases = [
      [0, '🕛', '🕧'],
      [1, '🕐', '🕜'],
      [2, '🕑', '🕝'],
      [3, '🕒', '🕞'],
      [4, '🕓', '🕟'],
      [5, '🕔', '🕠'],
      [6, '🕕', '🕡'],
      [7, '🕖', '🕢'],
      [8, '🕗', '🕣'],
      [9, '🕘', '🕤'],
      [10, '🕙', '🕥'],
      [11, '🕚', '🕦'],
      [12, '🕛', '🕧']
    ] as const

    const hhMm = (d: Date) =>
      [d.getHours(), d.getMinutes()]
        .map(v => String(v).padStart(2, '0'))
        .join(':')

    cases.forEach(([hour, startGlyph, endGlyph]) => {
      const d00 = new Date()
      d00.setHours(hour)
      d00.setMinutes(0)

      const d30 = new Date()
      d30.setHours(hour)
      d30.setMinutes(30)

      it(`sets ${startGlyph} for ${hhMm(d00)}`, () => {
        expect(resolvedAtHint(d00.getTime())).toContain(startGlyph)
      })

      it(`sets ${endGlyph} for ${hhMm(d30)}`, () => {
        expect(resolvedAtHint(d30.getTime())).toContain(endGlyph)
      })
    })
  })
})
