let firefoxEventPage = {
  page: 'src/module.html'
}
let chromeServiceModule = {
  service_worker: 'build/service.js',
  type: 'module'
}

let manifest = ({ forFirefox } = {}) => ({
  manifest_version: 3,

  name: 'Yet another flags',
  short_name: 'YAFlags',
  description: 'Shows flag for the website near the location bar',

  ...(forFirefox
    ? {
        browser_specific_settings: {
          gecko: { id: 'yaflags@furman.im' }
        }
      }
    : {}),

  version: '1.0.5',

  background: {
    ...(forFirefox ? firefoxEventPage : chromeServiceModule)
  },

  permissions: ['tabs', 'storage'],
  host_permissions: ['http://geoip.furman.im/*', 'http://localhost/*'],

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
  },

  content_security_policy: {
    extension_pages: "script-src 'self'; object-src 'self'"
  }
})

module.exports = manifest
