import { setPageAction, storage } from '../../src/helpers/index.js'

describe('setPageAction', () => {
  const saveIcon = vi.spyOn(storage, 'saveDomainIcon')
  const { setTitle, setIcon } = chrome.action

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
    expect(saveIcon).toHaveBeenCalledWith('do.main', '/img/local_resource.png')
  })

  it('sets loading action icon and title', async () => {
    await setPageAction(99, { kind: 'loading', domain: 'do.main' })

    expect(setTitle).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      title: 'Resolving do.main …'
    })
    expect(setIcon).toHaveBeenCalledExactlyOnceWith({
      tabId: 99,
      imageData: { 64: expect.any(ImageData) }
    })
    expect(saveIcon).not.toHaveBeenCalled()
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
    expect(saveIcon).not.toHaveBeenCalled()
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
    expect(saveIcon).toHaveBeenCalledWith('do.main', '/img/flags/np.png')
  })

  it('throws if impossible path was reached', async () => {
    await expect(
      // @ts-expect-error: assertNever spec
      setPageAction(99, { kind: 'impossible-kind' })
    ).rejects.toThrow("Unreachable path reached with 'impossible-kind'")
  })
})
