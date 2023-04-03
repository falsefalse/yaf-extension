# Yet Another Flags 🇺🇦

Minimalistic web extension that shows country flag for the current tab domain.

Available for [Chrome] and [Firefox].

Extension uses data from free [MaxMind City DB] and `https://dns.google` for localized host name resolution.

Take a look at [server code] as well.

## Prerequisites

Requires `node@18` and `yarn@1.22`.

```bash
yarn install
[sudo] yarn global add jake
```

## Development

```bash
# build without minification, points to `localhost:8080``
yarn ch
# same for 🦊
yarn ff
```

Open `chrome://extensions/`,
switch "Developer mode" on, click "Load unpacked",
pick `pkg/DEV-yet-another-flags-x.x.x/manifest.json`.

🦊 uses zip file instead – `pkg/DEV-yet-another-flags-x.x.x.zip`.

```bash
exit | yarn run # list all package scripts
jake -T # list all build tasks
```

You want to use `jake -q` to limit the noise when running tasks.

#### With SublimeText

SublimeText users get the benefit of ready-made build tasks (requires [Terminus]).
Select Project → Open Project..., pick `extension.sublime-project`,
press <kbd>Cmd</kbd>+<kbd>Shift</kbd>+<kbd>B</kbd>. `tc` and `lint` tasks parse the results to make them navigable.

### Release

Prepare `pkg/yet-another-flags-<version>.zip`.

```bash
# build minified version, point to production, don't include workspace changes
yarn release:chrome
yarn release:firefox
```

#### Package sources

Mozilla store sometimes requires full source code (due to the fact that extension uses compiled templates).

```bash
yarn release:firefox
# open Jakefile.js, comment 'packageTask(pkgName...',
# uncomment 'packageTask(`${pkgName}-source`' and run
jake -q package
```

[Chrome]: https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk
[Firefox]: https://addons.mozilla.org/en-US/firefox/addon/yet-another-flags/
[MaxMind City DB]: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
[server code]: https://github.com/falsefalse/geoip-server
[Terminus]: https://packagecontrol.io/packages/Terminus
