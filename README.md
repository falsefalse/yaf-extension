# Yet Another Flags 🇺🇦

[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/falsefalse/5f76f3b771603857432300417fcb90e0/raw/badge.json)](https://github.com/falsefalse/yaf-extension/actions/workflows/specs.yml)

Minimalistic web extension that shows country flag for the current tab domain. Available for [Chrome] and [Firefox].

Extension uses free [MaxMind City DB] for geo location, and [Google DoH] for localized DNS resolution.

Take a look at [server code] as well.

## Prerequisites

Requires `node@18`, `yarn@1.22` and `jake`.

```bash
# allows require-ing globally installed packages
export NODE_PATH=`npm -g root` >> ~/.profile

npm -g install yarn jake [prettier]
yarn install
```

<details>
  <summary>Why not <code>npm</code>?</summary>

Because of the lock file size — <code>yarn.lock</code> is three times smaller.
See <a href="https://github.com/falsefalse/yaf-extension/commit/037b18f21422707d05dc5097f39e43df876764cb"><code>037b18f</code></a> 🐈

</details>

## Development

```bash
# development build: un-minified, points to http://localhost:8080
yarn build[:firefox]

# production build: minified, points to https://geoip.furman.im
jake -q [firefox]

# specs
yarn test[:watch]
# generate coverage
yarn coverage
# compile html report and open it in the default browser
yarn report
```

### Run development build

- open `chrome://extensions/`, turn on "Developer mode"
- click "Load unpacked"
- navigate to `./pkg` and pick `manifest.json`

Don't forget to reload the extension in the browser when rebuilding.

### SublimeText build system

SublimeText users get the benefit of ready-made build tasks (requires [Terminus]).

Open `extension.sublime-project` as a Project and press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>.

`tc 🦜`, `lint 🕵` and `test 🧪` tasks have navigable output.

### Release

- bump version in `package.json`
- add changelog entry
- Build, upload and tag the release
  ```bash
  git commit -am "Bump"
  yarn release # upload to webstore, submit for review
  yarn release:firefox # upload to AMO
  yarn release:tag
  ```

#### Fix `jake -T`

The command is broken in the latest release, but already fixed in master.

```bash
# remove global jake
npm -g rm jake
# get latest master and link it globally
git clone git@github.com:jakejs/jake.git
cd jake && npm i && npm link
```

See jakejs/jake#417, jakejs/jake#420.

[Chrome]: https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk
[Firefox]: https://addons.mozilla.org/en-US/firefox/addon/yet-another-flags/
[MaxMind City DB]: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
[Google DoH]: https://dns.google
[server code]: https://github.com/falsefalse/geoip-server
[Terminus]: https://packagecontrol.io/packages/Terminus
