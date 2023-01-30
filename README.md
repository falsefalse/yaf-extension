## Yet Another Flags

Web extensions that shows country flag for the current tabs domain.

Available for [Chrome] and [Firefox].

Extension uses data from free [MaxMind City DB].
Take a look at [server code] as well.

### Building and packaging

Requires `node@18` and `yarn@1.22`.

```bash
yarn install
[sudo] yarn global add jake
```

#### Development

```bash
# build for chrome without minification, point to locahost
yarn ch
# same for 🦊
yarn ff
```

In Chrome extensions turn Developer Mode on, "Load as unpacked extension", pick `pkg/manifest.json`.
🦊 uses zip file instead (because it allows to load local extensions as zip files, Chrome does not).

```bash
# other tasks, not all are used
jake -T
```

#### Release

Prepare `pkg/yet-another-flags-<version>.zip`.

```bash
# build minified version, point to production, don't include workspace changes
yarn release:chrome
yarn release:firefox
```

[Chrome]: https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk
[Firefox]: https://addons.mozilla.org/en-US/firefox/addon/yet-another-flags/
[MaxMind City DB]: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
[server code]: https://github.com/falsefalse/geoip-server
