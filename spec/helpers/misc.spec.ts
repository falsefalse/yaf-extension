import { expect } from 'chai'

import { getDomain, isLocal, resolvedAtHint } from '../../src/helpers/misc.js'

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

  describe('🕰', () => {
    const cases = [
      ['🕛', '00:00'],
      ['🕧', '00:30'],
      ['🕐', '01:00'],
      ['🕜', '01:30'],
      ['🕑', '02:00'],
      ['🕝', '02:30'],
      ['🕒', '03:00'],
      ['🕞', '03:30'],
      ['🕓', '04:00'],
      ['🕟', '04:30'],
      ['🕔', '05:00'],
      ['🕠', '05:30'],
      ['🕕', '06:00'],
      ['🕡', '06:30'],
      ['🕖', '07:00'],
      ['🕢', '07:30'],
      ['🕗', '08:00'],
      ['🕣', '08:30'],
      ['🕘', '09:00'],
      ['🕤', '09:30'],
      ['🕙', '10:00'],
      ['🕥', '10:30'],
      ['🕚', '11:00'],
      ['🕦', '11:30'],
      // noon
      ['🕛', '12:00'],
      ['🕧', '12:30'],
      ['🕐', '13:00'],
      ['🕜', '13:30'],
      ['🕑', '14:00'],
      ['🕝', '14:30'],
      ['🕒', '15:00'],
      ['🕞', '15:30'],
      ['🕓', '16:00'],
      ['🕟', '16:30'],
      ['🕔', '17:00'],
      ['🕠', '17:30'],
      ['🕕', '18:00'],
      ['🕡', '18:30'],
      ['🕖', '19:00'],
      ['🕢', '19:30'],
      ['🕗', '20:00'],
      ['🕣', '20:30'],
      ['🕘', '21:00'],
      ['🕤', '21:30'],
      ['🕙', '22:00'],
      ['🕥', '22:30'],
      ['🕚', '23:00'],
      ['🕦', '23:30']
    ] as const

    cases.forEach(([clock, time]) => {
      const [hours = 0, minutes = 0] = time.split(':').map(Number)

      const date = new Date()
      date.setHours(hours)
      date.setMinutes(minutes)

      const [hh, mm] = [hours, minutes].map(v => String(v).padStart(2, '0'))

      it(`sets ${clock} to ${hh}:${mm}`, () => {
        expect(resolvedAtHint(date.getTime())).to.include(clock)
      })
    })
  })
})
