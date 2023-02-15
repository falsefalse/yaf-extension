### 1.1.2

- Drop unused CSP field from manifest.

### 1.1.1

- Less annoying charity animation, better handling for initial popup load after install.
- Smaller cache TTLs.

### 1.1.0

- Pixel perfect flags upscaling (even for Nepal 🇳🇵), 4k mode on.

### 1.0.9

- HTTPS 🔐
- Fix page action icon being out of sync with popup content (when clicked on 'fetch error' when network is back already)

### 1.0.8

- Drop `manifest.host_permissions`🎉, CORS for the win.

### 1.0.7

- First Firefox version release got `localhost:8080`, of course. Fix and prevent this.
- Send `x-client-version` header with `manifest.version` along with requests

### 1.0.6

Bugfix release

- caching and server error handling improvements, faster recovery after lost network
- apparently extension works in Firefox with minimal changes to manifest, needs module.html wrapper for service script and that's it
- simplify and improve Jakefile to handle two manifests

### 1.0.5

This is basically a rewrite.

- Convert to Manifest v3: modules, ES2018, templates scoped locally.
- Add prettier and eslint, improve build system, move to yarn (smol lockfile).
- Move to use `server@0.0.4` API, change data format to flat "key, value".
- Fix icons scaling – render only flag icons with OffscreenCanvas, no more blurring.
- Make popup more reactive, nicer styling, a bit more bling.
- Remove Google Analytics entirely 🧹

Glory to Ukraine 🇺🇦

### 1.0.2

- Prevent Chrome from scaling flag icon, render to canvas and then to page/browserAction.
- Pad default icons to 19 and 38 px.

### 1.0.1

- Includes correct minified service in the manifest.

### 1.0.0

- Change permanent background page to event page which is loaded only when needed.
- Accommodate popup to not always present background page.
- Remove underscore.js dependency, use its templates only instead.
- Use underscore.templates.js only when building, 1 script less to load.
- It is time for a major version bump, as well as switch to 3 parts inst. of 4.
- Chrome wouldn't auto update from 0.9.11.0 to 0.10.0.0 anyway :)

### 0.9.11.0

- Refactor popup innards.
- Add 'Reload' button, allows to refresh geo data immediately.
- Added ability to switch 'Marked as local' status for domain.
- Styled toolbar buttons so they look more like buttons.

### 0.9.10.0

- Add GA event for popup display.
- Simplify service.js code.
- Fixes couple minor bugs in local IPs/domains handling.

### 0.9.9.9

- Better error reporting when domain or IP wasn't found in DB.
- Updated GeoLite to the latest.

### 0.9.9.8

- Rest permissions, no more content script is needed.
- Update tab API calls, fixes flag disappearing.
- Simplified XHR code.

### 0.9.9.7

- Attempt to fix disappearing pageAction icon on Mac OS X.
- Keeping code simpler could help.

### 0.9.9.6

- Fixes crash when ext. gets empty `tab` from Chrome.
- Treat 'localhost' as local domain always, duh.

### 0.9.9.4

- Flushes all stored data, geo data on server was updated.

### 0.9.9.2

- Disable annoying blue overlay on popup link on Mac OS X.

### 0.9.9.1

- Now fixed GA for real, finally.

### 0.9.9

- Fixed popup.
- Fixed GA.
- Started using JSHint and npm.
- Added Jakefile, which will handle templates compilation, minification and packaging.

### 0.9.8

- Updated manifest.json to version 2.

### 0.9.7

- Center 'Mark as local' icon under the flag icon.
- Don't make any requests when displaying local IPs.
- Check for not found data once a day inst. of after 2 weeks.
- Black service links are black again.

### 0.9.5

- Use Resig's microtemplates.
- Add 'Mark resource as local' button, incredibly useful for people who do a lot of development on different domains.
- Correct country code for European Union.

### 0.9.1

- Get rid of ipinfodb.com, they suck balls at DNS resolution, and thus can't found shit :(
- Use my own awesome back-end in nodejs instead.

### 0.8.4

- Don't confuse 'not found' with 'local IP' anymore. Improve related logic.
- Fix cached data so that logic could be applied to cached data as well.
- Added GA.
- Caching period is 2 weeks instead of a month. Not found entries are updated
  daily, along with DNS propagation.
- Fixing regressions after updating to latest API.

### 0.7.7

- Fix Great Britain flag for cached domains.

### 0.7.6

- Fix Great Britain flag.

### 0.7.5

- New icon, yay!

### 0.7.3

- Support v3 of API. Fix localStorage overflow bug.

### 0.7.2

- Remove link to GeoIP thing, they lost their domain.

### 0.7.1

- Fixes geo data cache storage between browser launches, it was introduced in 0.7. Flags will be displayed right away after browser launch, without re-requesting data.

### 0.7

- Update to match ipinfodb.com API. Old API has been disabled on 15 Nov 2010. This should fix @Fcgbman33 and @lukasz210 issues.

### 0.6.1

- Updates manifest to comply to new syntax.
- Updates font stack in popup to please Mac OS X users.
- Minor polishing for the popup menu styling here and there, now it looks more clean and prominent (see updated screenshots).

### 0.6

- API change fix: performs less strict check for 'not found' API response. Fixes handling of unknown domains (hosts entries that are mapped to local IPs for example).

### 0.5

- fixed regression: doesn't request geo data for the domain if extension is already waiting for the data for this domain

### 0.4

- doesn't put both region and city to the icon hint if they are equal

### 0.3

- updates cached geo data to the new format on extension first run

### 0.2

- invalidates geo data cache: request geo data again after storing it for 30 days
- handles LAN resources: separate icon is used, no service links; refer to screenshot
- handles resources without associated geo data: displays default extension icon, no service links; refer to screenshot
- use ISO compliant flag icons from http://www.famfamfam.com/lab/icons/flags/ (this fixes flag icon for Taiwan)
- grey globe icon is shown instead - US flag right after extension was installed
