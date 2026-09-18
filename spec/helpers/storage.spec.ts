import { storage } from '../../src/helpers'

describe('storage', () => {
  const { local } = chrome.storage

  it('#set', async () => {
    const data = { fetched_at: 777, ip: 'b.b.b.b', is_local: true }

    await storage.saveDomain('boop', data)

    expect(await local.get('boop')).toEqual({ boop: data })
  })

  it('#get', async () => {
    await local.set({ 'a key': 'valooe', 'another key': 'another valooe' })

    expect(await storage.getDomain('but a key')).toBeUndefined()
    expect(await storage.getDomain('a key')).toBe('valooe')
    expect(await storage.getDomain('another key')).toBe('another valooe')
  })

  it('#get returned undefined', async () => {
    // chrome never does this, but the code guards against it
    vi.spyOn(local, 'get').mockResolvedValueOnce(undefined)

    expect(await storage.getDomain('should not throw')).toBeUndefined()
  })

  it('clears itself when full and sets the data', async () => {
    const set = vi
      .spyOn(local, 'set')
      .mockRejectedValueOnce(new Error('QUOTA_BYTES quota exceeded'))
    const clear = vi.spyOn(local, 'clear')

    const data = { fetched_at: 1, error: 'smol but important', is_local: false }

    await storage.saveDomain('smol', data)

    expect(clear).toHaveBeenCalledOnce()
    expect(set).toHaveBeenCalledTimes(2)
    expect(set).toHaveBeenNthCalledWith(1, { smol: data })
    expect(set).toHaveBeenNthCalledWith(2, { smol: data })
    expect(await local.get('smol')).toEqual({ smol: data })
  })
})
