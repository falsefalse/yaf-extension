import { setPageAction, storage } from '../../src/helpers'

describe('setPageAction', () => {
  const saveDomainIcon = vi.spyOn(storage, 'saveDomainIcon')
  const { setTitle, setIcon } = chrome.action
  const fillText = vi.spyOn(
    OffscreenCanvasRenderingContext2D.prototype,
    'fillText'
  )

  it('sets local domain action icon and title', async () => {
    await setPageAction(99, { kind: 'local', domain: 'do.main' })

    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      title: 'do.main is a local resource'
    })
    expect(setIcon).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      path: '/img/local_resource.png'
    })
    expect(saveDomainIcon).toHaveBeenCalledWith(
      'do.main',
      '/img/local_resource.png'
    )
  })

  it('sets Tailscale node title and icon', async () => {
    await setPageAction(99, {
      kind: 'local',
      domain: 'do.main',
      is_tailscale: true
    })

    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      title: 'do.main is a Tailscale node'
    })
    expect(setIcon).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      path: '/img/tailscale.png'
    })
    expect(saveDomainIcon).toHaveBeenCalledWith('do.main', '/img/tailscale.png')
  })

  it('sets error action icon and title', async () => {
    await setPageAction(99, {
      kind: 'error',
      domain: 'do.main',
      error: 'bonk!'
    })

    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      title: 'Error: bonk!'
    })
    expect(setIcon).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      imageData: { 64: expect.any(ImageData) }
    })
    expect(fillText).toHaveBeenCalledWith(
      '❌',
      expect.any(Number),
      expect.any(Number)
    )
    expect(saveDomainIcon).not.toHaveBeenCalled()
  })

  it('sets resolved flag action icon and title', async () => {
    await setPageAction(99, {
      kind: 'geo',
      domain: 'do.main',
      data: {
        country_code: 'np',
        country_name: 'nepal ftw'
      }
    })

    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      title: 'nepal ftw'
    })
    expect(setIcon).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      imageData: { 64: expect.any(ImageData) }
    })
    expect(saveDomainIcon).toHaveBeenCalledWith('do.main', '/img/flags/np.png')
  })

  it('sets internal page title and icon', async () => {
    await setPageAction(99, { kind: 'settings_page' })

    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      title: 'Internal browser page'
    })
    expect(setIcon).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      path: '/img/icon/32.png'
    })
    expect(saveDomainIcon).not.toHaveBeenCalled()
  })

  it('hands a handle back for loading and nothing for the rest', async () => {
    const stop = await setPageAction(99, { kind: 'loading', domain: 'do.main' })
    expect(stop).toBeTypeOf('function')

    // dropping it leaks the interval into whatever spec runs next
    await stop?.()

    expect(await setPageAction(99, { kind: 'settings_page' })).toBeUndefined()
    expect(
      await setPageAction(99, { kind: 'local', domain: 'do.main' })
    ).toBeUndefined()
  })

  it('throws if impossible path was reached', async () => {
    await expect(
      // @ts-expect-error: assertNever spec
      setPageAction(99, { kind: 'impossible-kind' })
    ).rejects.toThrow("Unreachable path reached with 'impossible-kind'")
  })
})
