/*global chrome */

// Render services links for domain/IP and display them in popup

function get(template) {
    return window.TPL[template];
}

window.addEventListener('DOMContentLoaded', function() {
    var toolbar = document.querySelector('.toolbar');
    var result = document.querySelector('.result');

    chrome.runtime.getBackgroundPage(function(service) {
        service._gaq.push(['_trackEvent', 'popup', 'shown']);

        chrome.tabs.query({
            active: true,
            currentWindow: true
        }, function(tabs) {
            var tab = tabs[0];

            service.YAF.getGeoData( service.getDomain(tab.url) )
                .then(function(args) {
                    args.unshift(tab);
                    renderPopup.apply(service, args);
                });
        });
    });

    function renderPopup (tab, domain, data) {
        var service = this;

        toolbar.innerHTML = get('toolbar.ejs')({
            geo: data.geo,
            trueLocal: service.isLocal(domain)
        });
        var mark = toolbar.querySelector('.toolbar-marklocal'),
            reload = toolbar.querySelector('.toolbar-reload');

        mark && mark.addEventListener('click', function() {
            if (data.geo && data.geo.isLocal) {
                delete data.geo.isLocal;
                service._gaq.push(['_trackEvent', 'popup', 'unmark']);
            } else {
                data.geo = data.geo || {};
                data.geo.isLocal = true;
                service._gaq.push(['_trackEvent', 'popup', 'mark']);
            }

            service.YAF.storage.set(domain, data);
            service.YAF.setFlag(tab).then(function() {
                window.location.reload(true);
            });
        });
        reload && reload.addEventListener('click', function() {
            service.YAF.setFlag(tab, true)
                .then(function() {
                    window.location.reload(true);
                });
            service._gaq.push(['_trackEvent', 'popup', 'reload']);
        });

        if (data.error) {
            result.innerHTML = get('not_found.ejs')({
                domain: domain,
                error: data.error
            });
        }
        else if (data.geo.isLocal) {
            result.innerHTML = get('local.ejs')({
                domain: domain,
                geo: data.geo
            });
        }
        else {
            result.innerHTML = get('regular.ejs')({
                domain: domain,
                geo: data.geo
            });
        }
    }
}, false);
