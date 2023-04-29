/* eslint-env node */

const { version } = require('./package.json')

const name = DEV => ['Yet Another Flags', DEV && '🚧'].filter(Boolean).join(' ')

const eventPage = {
  page: 'src/module.html'
}

const serviceModule = {
  service_worker: 'build/service.js',
  type: 'module'
}

const firefoxSettings = {
  browser_specific_settings: { gecko: { id: 'yaflags@furman.im' } }
}

const permissions = ['tabs', 'storage']

module.exports = ({ forFirefox, DEV } = {}) => ({
  manifest_version: 3,

  name: name(DEV),
  short_name: 'YAFlags',
  description: 'Shows country flag for the website near the location bar.',

  ...(forFirefox && firefoxSettings),

  version,

  background: {
    ...(forFirefox ? eventPage : serviceModule)
  },

  permissions: forFirefox ? ['dns', ...permissions] : permissions,

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
    default_title: name(DEV),
    default_popup: 'src/popup.html'
  }
})
