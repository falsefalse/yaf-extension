/*global chrome, YAF:true */

// Render services links for domain/IP and display them in popup

var service = chrome.extension.getBackgroundPage(),
    YAF  = service.YAF,
    _gaq = service._gaq;

function get(template) {
    return window.TPL[template];
}

window.addEventListener('DOMContentLoaded', function() {
    _gaq.push(['_trackEvent', 'popup', 'shown']);

    var toolbar = document.querySelector('.toolbar');
    var result = document.querySelector('.result');

    function renderPopup (tab, domain, data) {
        var geo = data.geo;

        toolbar.innerHTML = get('toolbar.ejs')({
            geo: data.geo,
            trueLocal: service.isLocal(domain)
        });
        var mark = toolbar.querySelector('.toolbar-marklocal'),
            reload = toolbar.querySelector('.toolbar-reload');

        mark && mark.addEventListener('click', function(event) {
            if (data.geo && data.geo.isLocal) {
                delete data.geo.isLocal;
                _gaq.push(['_trackEvent', 'popup', 'unmark']);
            } else {
                data.geo = data.geo || {};
                data.geo.isLocal = true;
                _gaq.push(['_trackEvent', 'popup', 'mark']);
            }

            YAF.storage.set(domain, data);
            YAF.setFlag(tab).then(function() {
                window.location.reload(true);
            });
        });
        reload && reload.addEventListener('click', function(event) {
            YAF.setFlag(tab, true)
                .then(function(args) {
                    window.location.reload(true);
                });
            _gaq.push(['_trackEvent', 'popup', 'reload']);
        });

        if (!geo) {
            result.innerHTML = get('not_found.ejs')({
                domain: domain,
                error: data.error
            });
        }
        else if (geo.isLocal) {
            result.innerHTML = get('local.ejs')({ domain: domain });
        }
        else {
            result.innerHTML = get('regular.ejs')({
                domain: domain,
                geo: geo
            });
        }
    }
    chrome.tabs.getSelected(null, function(tab) {
        YAF.getGeoData( service.getDomain(tab.url) )
            .then(function(args) {
                args.unshift(tab);
                renderPopup.apply(this, args);
            });
    });
}, false);