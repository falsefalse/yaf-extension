/* local storage */

import type { Data } from '../lib/types'
import { DEFAULT_ICON } from './index'

type Stored = Data & { icon?: string }

class Storage {
  private async set(key: string, value: unknown) {
    const data = { [key]: value }
    try {
      await chrome.storage.local.set(data)
    } catch {
      await chrome.storage.local.clear()
      await chrome.storage.local.set(data)
    }
  }

  private async get(key: string) {
    const data = (await chrome.storage.local.get(key)) || {}
    return data[key] as Stored | undefined
  }

  async saveDomain(domain: string, value: Data) {
    return await this.set(domain, value)
  }
  async getDomain(domain: string): Promise<Data | undefined> {
    return await this.get(domain)
  }

  async saveDomainIcon(domain: string, path: string) {
    const data = await this.get(domain)
    if (data) {
      await this.set(domain, { ...data, icon: path })
    }
  }
  async getDomainIcon(domain: string) {
    const data = await this.get(domain)

    return data?.icon || DEFAULT_ICON
  }
}

export const storage = new Storage()
