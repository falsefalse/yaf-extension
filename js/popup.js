// Render services links for domain/IP and display them in popup
// smashlong@gmail.com, 2010

/*jshint curly:false, undef:true*/
/*global browser:true, chrome:true, YAF:true, _gaq:true*/

YAF = {
    service : chrome.extension.getBackgroundPage()
};

window.addEventListener("DOMContentLoaded", function() {
    chrome.tabs.getSelected(null, function(tab) {
        var data = YAF.service.YAF.tabs[tab.id],
            geo  = data.geo,
            domain = data.domain;

        YAF.service._gaq.push(['_trackPageview']);

        var ul = document.querySelector('#menu');

        if (!geo) {
            ul.innerHTML = window.tmpl('not_found', {
                domain: domain
            });
            return;
        }

        if (geo.isLocal) {
            ul.innerHTML = window.tmpl('local', {
                domain: domain,
                geo: geo
            });
            return;
        }

        ul.innerHTML = window.tmpl('regular', {
            domain: domain,
            geo: geo
        });
    });
}, false);