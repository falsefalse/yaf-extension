// Render services links for domain/IP and display them in popup
// smashlong@gmail.com, 2010

/*jshint curly:false, undef:true*/
/*global browser:true, chrome:true, YAF:true, _gaq:true*/

YAF = chrome.extension.getBackgroundPage().YAF;

window.addEventListener("DOMContentLoaded", function() {
    chrome.tabs.getSelected(null, function(tab) {
        var data   = YAF.tabs[tab.id],
            geo    = data.geo,
            domain = data.domain,
            link;

        var ul = document.querySelector('#menu');

        if (!geo) {
            ul.innerHTML = window.tmpl('not_found', { domain: domain });

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
            ul.innerHTML = window.tmpl('local', { domain: domain });
            return;
        }

        ul.innerHTML = window.tmpl('regular', {
            domain: domain,
            geo: geo
        });
    });
}, false);