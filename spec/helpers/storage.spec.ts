import { expect } from 'chai'
import { pickStub } from '../setup.js'

import { storage } from '../../src/helpers/storage.js'

describe('storage', () => {
  const setStub = pickStub('set', chrome.storage.local),
    getStub = pickStub('get', chrome.storage.local),
    clearStub = pickStub('clear', chrome.storage.local)

  it('#set', () => {
    storage.saveDomain('boop', {
      fetched_at: 777,
      ip: 'b.b.b.b',
      is_local: true
    })

    expect(setStub).calledOnceWith({
      boop: { fetched_at: 777, ip: 'b.b.b.b', is_local: true }
    })
  })

  it('#get', async () => {
    getStub.resolves({
      'a key': 'valooe',
      'another key': 'another valooe'
    })

    expect(await storage.getDomain('but a key')).to.be.undefined
    expect(await storage.getDomain('a key')).to.eq('valooe')
    expect(await storage.getDomain('another key')).to.eq('another valooe')
  })

  it('#get returned undefined', async () => {
    getStub.resolves(undefined)

    expect(await storage.getDomain('should not throw')).to.be.undefined
  })

  it('clears itself when full and sets the data', async () => {
    setStub.onFirstCall().throws()
    setStub.onSecondCall().resolves()

    const data = {
      fetched_at: 1,
      error: 'smol but important',
      is_local: false
    }

    await storage.saveDomain('smol', data)

    expect(clearStub).calledOnce
    expect(setStub).calledTwice
    expect(setStub.firstCall).calledWith({ smol: data })
    expect(setStub.secondCall).calledWith({ smol: data })
  })
})
