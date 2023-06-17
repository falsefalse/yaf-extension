# Yet Another Flags 🇺🇦

[![coverage](https://img.shields.io/endpoint?url=https://gist.githubusercontent.com/falsefalse/5f76f3b771603857432300417fcb90e0/raw/badge.json)](https://github.com/falsefalse/yaf-extension/actions/workflows/specs.yml)

Minimalistic web extension that shows country flag for the current tab domain. Available for [Chrome] and [Firefox].

Extension uses free [MaxMind City DB] for geo location, and [Google DoH] for localized DNS resolution.

Take a look at [server code] as well.

## Prerequisites

Requires `node@18`, `yarn@1.22` and `jake`.

```bash
npm -g install yarn jake [prettier]
yarn install
```

<details>
  <summary>Why not <code>npm</code>?</summary>

Because of the lock file size — <code>yarn.lock</code> is three times smaller.
See <a href="https://github.com/falsefalse/yaf-extension/commit/037b18f21422707d05dc5097f39e43df876764cb"><code>037b18f</code></a> 🐈

</details>

<details>
  <summary>I don't want global <code>jake</code></summary>

No problem, you can [link local package](https://github.com/falsefalse/yaf-extension/blob/master/.github/workflows/specs.yml#L21). 🐈

</details>

## Development

```bash
# development build: un-minified, points to http://localhost:8080
yarn build[:firefox]

# production build: minified, points to https://geoip.furman.im
jake -q [firefox]

yarn test # specs
yarn coverage # generate coverage
yarn report # compile html report and open it in the default browser
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

1. bump version in `package.json`
2. add `CHANGELOG.md` entry
3. ```bash
   git commit -am "Bump"

   yarn release
   # - upload pkg to webstore, submit draft for review

   yarn release:firefox
   # - upload pkg and pkg-src to AMO

   yarn release:tag
   ```

[Chrome]: https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk
[Firefox]: https://addons.mozilla.org/en-US/firefox/addon/yet-another-flags/
[MaxMind City DB]: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
[Google DoH]: https://dns.google
[server code]: https://github.com/falsefalse/geoip-server
[Terminus]: https://packagecontrol.io/packages/Terminus
