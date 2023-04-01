const { version } = require('./package.json')

const firefoxEventPage = {
  page: 'src/module.html'
}

const chromeServiceModule = {
  service_worker: 'build/service.js',
  type: 'module'
}

const firefoxSettings = {
  browser_specific_settings: { gecko: { id: 'yaflags@furman.im' } }
}

module.exports = ({ forFirefox } = {}) => ({
  manifest_version: 3,

  name: 'Yet another flags',
  short_name: 'YAFlags',
  description: 'Shows flag for the website near the location bar',

  ...(forFirefox ? firefoxSettings : {}),

  version,

  background: {
    ...(forFirefox ? firefoxEventPage : chromeServiceModule)
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
    default_title: 'Yet Another Flags',
    default_popup: 'src/popup.html'
  }
})
