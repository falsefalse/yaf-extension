### Yet Another Flags

The source code for Google Chrome [extension].

Extension uses data from free [MaxMind City DB].
Take a look at [server code] as well.

[extension]: https://chrome.google.com/webstore/detail/dmchcmgddbhmbkakammmklpoonoiiomk
[MaxMind City DB]: https://dev.maxmind.com/geoip/geolite2-free-geolocation-data
[server code]: https://github.com/falsefalse/geoip-server

### Building

Requires `node@18` and `yarn@1.22`.

```bash
yarn install
[sudo] yarn global add jake

# package current version into ./pkg
jake -q

# 🦊
jake -q firefox
```
