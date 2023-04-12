# Yet Another Flags 🇺🇦

Minimalistic web extension that shows country flag for the current tab domain. Available for [Chrome] and [Firefox].

Extension uses free [MaxMind City DB] for geo location, and [Google DoH] for localized DNS resolution.

Take a look at [server code] as well.

## Prerequisites

Requires `node@18`, `yarn@1.22` and `jake`.

```bash
npm -g install yarn jake
yarn install
```

Why not `npm`? `yarn.lock` is ~3.1x smaller than `package-lock.json` (see <code>[037b18f]</code>).

## Development

```bash
# dev build: un-minified, points to http://localhost:8080
yarn build
yarn build:firefox

# production build: minified, points to https://geoip.furman.im
jake -q
jake -q firefox

# specs
yarn test[:watch]
# generate coverage
yarn coverage
# format generated coverage as html and open in default browser
yarn coverage:html
```

Open `chrome://extensions/`, turn on "Developer mode", click "Load unpacked",
pick `pkg/DEV-yet-another-flags-<version>/manifest.json`.

🦊 uses zip file instead – `pkg/DEV-yet-another-flags-<version>.zip`.

Don't forget to reload the extension in the browser when rebuilding.

List all scripts and tasks. Use `jake -q` and `yarn -s` to limit the noise when running.

```bash
exit | yarn run

# broken in the latest release, see next section
jake -T
```

#### `jake` task listing

It's fixed in master but not released yet.

To use the latest source

```bash
# remove global jake
npm -g rm jake
git clone git@github.com:jakejs/jake.git && cd jake
npm install
npm link
```

See jakejs/jake#417, jakejs/jake#420.

#### SublimeText build system

SublimeText users get the benefit of ready-made build tasks (requires [Terminus]).
Open `extension.sublime-project` as a Project,
press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>. `tc` and `lint` tasks parse the results to make them navigable (or at least clickable in case of `prettier` warnings).

### Release

Prepare `pkg/yet-another-flags-<version>.zip`.

```bash
yarn release
yarn release:firefox
```

#### Package sources

AMO sometimes requires full source code to be submitted along with the build (because of compiled templates). This task prepares source code archive.

```bash
$ jake -q src:package
```

[Chrome]: https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk
[Firefox]: https://addons.mozilla.org/en-US/firefox/addon/yet-another-flags/
[MaxMind City DB]: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
[Google DoH]: https://dns.google
[server code]: https://github.com/falsefalse/geoip-server
[Terminus]: https://packagecontrol.io/packages/Terminus
[037b18f]: https://github.com/falsefalse/yaf-extension/commit/037b18f21422707d05dc5097f39e43df876764cb
