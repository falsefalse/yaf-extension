import type { Browser } from '@wxt-dev/browser'
import pkg from './package.json' with { type: 'json' }

export const { version } = pkg

const name = (release?: boolean) =>
  release ? 'Yet Another Flags' : 'Yet Another Flags 🚧'

type Options = { firefox?: boolean; release?: boolean }

export default ({ firefox, release }: Options = {}) => {
  const manifest = {
    manifest_version: 3,

    name: name(release),
    short_name: 'YAFlags',
    description: 'Shows country flag for the website near the location bar.',

    version,

    background: {
      service_worker: 'build/service.js',
      type: 'module'
    },

    permissions: ['tabs', 'storage'],

    icons: {
      128: 'img/icon/128.png',
      48: 'img/icon/48.png',
      32: 'img/icon/32.png',
      16: 'img/icon/16.png'
    },

    action: {
      default_icon: {
        16: 'img/icon/16.png',
        32: 'img/icon/32.png'
      },
      default_title: name(release),
      default_popup: 'src/popup.html'
    }
  } satisfies Browser.runtime.ManifestV3

  if (!firefox) return manifest

  /*
    Firefox runs an event page, not a service worker, and resolves with its own `dns` API

    https://developer.chrome.com/docs/extensions/reference/api/dns
    > This API is only available in Chrome Dev.
    > There are no foreseeable plans to move this API
    > from the dev channel into Chrome stable
  */
  return {
    ...manifest,
    browser_specific_settings: { gecko: { id: 'yaflags@furman.im' } },
    background: { page: 'src/module.html' },
    permissions: ['dns', ...manifest.permissions]
  }
}
