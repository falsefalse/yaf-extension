import { dohUrl, fetchMock, getDohResponse, json, respond } from '../setup'

import { resolve } from '../../src/helpers'

describe('resolve', () => {
  describe('Google DoH', () => {
    it('returns undefined when network errors out', async () => {
      fetchMock.mockRejectedValueOnce(new Error('offline'))

      expect(await resolve('boop.com')).toBeUndefined()
    })

    it('returns undefined when gets http error', async () => {
      expect(await resolve('boop.com')).toBeUndefined()
    })

    it('returns undefined when DoH errors out', async () => {
      respond('boop.com', json({ Status: 88 }))

      expect(await resolve('boop.com')).toBeUndefined()
    })

    it('returns undefined when gets no Answer', async () => {
      respond('boop.com', json({ Status: 0 }))

      expect(await resolve('boop.com')).toBeUndefined()
    })

    it('returns undefined when gets no Answer with type 1 (A record)', async () => {
      respond('boop.com', json({ Status: 0, Answer: [{ type: 'not 1' }] }))

      expect(await resolve('boop.com')).toBeUndefined()
    })

    it('returns undefined when gets no data for Answer with type 1', async () => {
      respond('boop.com', json({ Status: 0, Answer: [{ type: 1 }] }))

      expect(await resolve('boop.com')).toBeUndefined()
    })

    it('makes correct query', async () => {
      await resolve('boop.com')

      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(dohUrl('boop.com'))
    })

    it('resolves IP address', async () => {
      respond('boop.com', json(getDohResponse('7.7.7.7')))

      expect(await resolve('boop.com')).toBe('7.7.7.7')
    })
  })

  describe('Firefox dns.resolve', () => {
    beforeAll(() => {
      // @ts-expect-error: let's pretend we are in firefox
      chrome.dns = 'is there'
    })

    afterAll(() => {
      // @ts-expect-error: stop pretending we are in firefox
      delete chrome.dns
    })

    it('resolves IP without fetch', async () => {
      vi.mocked(browser.dns.resolve).mockResolvedValue({
        addresses: ['66.66.66.66'],
        isTRR: 'nope'
      })

      expect(await resolve('boop.com')).toBe('66.66.66.66')
      expect(fetchMock).not.toHaveBeenCalled()
    })

    it('falls back to DoH when could not resolve', async () => {
      vi.mocked(browser.dns.resolve).mockRejectedValue('nope')

      await resolve('boop.com')

      expect(fetchMock).toHaveBeenCalledExactlyOnceWith(dohUrl('boop.com'))
    })
  })
})
