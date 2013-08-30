/*global chrome, YAF:true */

// Render services links for domain/IP and display them in popup
// smashlong@gmail.com, 2012

YAF = chrome.extension.getBackgroundPage().YAF;

window.addEventListener('DOMContentLoaded', function() {
    function get(template) {
        return window.TPL[template];
    }
    chrome.tabs.getSelected(null, function(tab) {
        YAF.getGeoData(tab.url, function(domain, data) {
            var geo = data.geo, link;

            var ul = document.querySelector('#menu');

            if (!geo) {
                ul.innerHTML = get('not_found.ejs')({
                    domain: domain,
                    error: data.error
                });

                link = ul.querySelector('.mark');
                link.addEventListener('click', function() {
                    var data = YAF.storage.get(domain);

                    data.geo = data.geo || {};
                    data.geo.isLocal = true;

                    YAF.storage.set(domain, data);
                    YAF.setFlag(tab);

                    window.location.reload(true);
                }, false);
                return;
            }

            if (geo.isLocal) {
                ul.innerHTML = get('local.ejs')({ domain: domain });
                return;
            }

            ul.innerHTML = get('regular.ejs')({
                domain: domain,
                geo: geo
            });
        });
    });
}, false);