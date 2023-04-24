import { expect } from 'chai'

import { getDomain, isLocal, resolvedAtHint } from '../../src/helpers/index.js'

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
        expect(isLocal(ip)).to.equal(expected)
      })
    })
  })

  describe('getDomain', () => {
    it('returns domain for http, https and ftp schemas', () => {
      expect(getDomain('http://boop.doop')).to.eq('boop.doop')
      expect(
        getDomain('https://127.0.0.0.boop.com/welp?some=come&utm=sucks')
      ).to.eq('127.0.0.0.boop.com')
      expect(getDomain('ftp://scene')).to.eq('scene')
    })

    it('returns undefined for everything else', () => {
      expect(getDomain('')).to.be.undefined
      expect(getDomain(undefined)).to.be.undefined
      expect(getDomain('gopher://old')).to.be.undefined
      expect(getDomain('chrome://new-tab')).to.be.undefined
      expect(getDomain('magnet://h.a.s.h')).to.be.undefined
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
        expect(resolvedAtHint(d00.getTime())).to.include(startGlyph)
      })

      it(`sets ${endGlyph} for ${hhMm(d30)}`, () => {
        expect(resolvedAtHint(d30.getTime())).to.include(endGlyph)
      })
    })
  })
})
