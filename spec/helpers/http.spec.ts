import { expect } from 'chai'
import { getDohResponse, pickStub } from '../setup.js'

import { resolve } from '../../src/helpers/http.js'

describe('resolve', () => {
  const fetchStub = pickStub('fetch', global)

  describe('Google DoH', () => {
    it('returns undefined when network errors out', async () => {
      fetchStub.throws()

      expect(await resolve('boop.com')).to.be.undefined
    })

    it('returns undefined when gets http error', async () => {
      expect(await resolve('boop.com')).to.be.undefined
    })

    it('returns undefined when DoH errors out', async () => {
      fetchResultStub.ok = true
      fetchResultStub.json.resolves({ Status: 88 })

      expect(await resolve('boop.com')).to.be.undefined
    })

    it('returns undefined when gets no Answer', async () => {
      fetchResultStub.ok = true
      fetchResultStub.json.resolves({ Status: 0 })

      expect(await resolve('boop.com')).to.be.undefined
    })

    it('returns undefined when gets no Answer with type 1 (A record)', async () => {
      fetchResultStub.ok = true
      fetchResultStub.json.resolves({
        Status: 0,
        Answer: [{ type: 'not 1' }]
      })

      expect(await resolve('boop.com')).to.be.undefined
    })

    it('returns undefined when gets no data for Answer with type 1', async () => {
      fetchResultStub.ok = true
      fetchResultStub.json.resolves({ Status: 0, Answer: [{ type: 1 }] })

      expect(await resolve('boop.com')).to.be.undefined
    })

    it('makes correct query', async () => {
      await resolve('boop.com')

      expect(fetchStub).calledOnceWith(
        'https://dns.google/resolve?type=1&name=boop.com'
      )
    })

    it('resolves IP address', async () => {
      fetchResultStub.ok = true
      fetchResultStub.json.resolves(getDohResponse('7.7.7.7'))

      expect(await resolve('boop.com')).to.eq('7.7.7.7')
    })
  })

  describe('Firefox dns.resolve', () => {
    before(() => {
      // @ts-expect-error: let's pretend we are in firefox
      chrome.dns = 'is there'
    })

    after(() => {
      // @ts-expect-error: stop pretending we are in firefox
      delete chrome.dns
    })

    const resolveStub = pickStub('resolve', browser.dns)

    it('resolves IP without fetch', async () => {
      resolveStub.resolves({ addresses: ['66.66.66.66'] })

      expect(await resolve('boop.com')).to.eq('66.66.66.66')
      expect(fetchStub).not.called
    })

    it('falls back to DoH when could not resolve', async () => {
      resolveStub.rejects('nope')
      await resolve('boop.com')

      expect(fetchStub).calledOnceWith(
        'https://dns.google/resolve?type=1&name=boop.com'
      )
    })
  })
})
