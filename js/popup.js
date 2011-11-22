// Render services links for domain/IP and display them in popup
// smashlong@gmail.com, 2010

/*jshint curly:false, undef:true*/
/*global browser:true, chrome:true, YAF:true, _gaq:true*/

YAF = {
    service : chrome.extension.getBackgroundPage(),
    services : {
        'whois' : {
            url : "http://whois.domaintools.com/%d",
            label : 'WhoIs'
        }
    },
    createElement : function(tag, html, className) {
        var element = document.createElement(tag);
        element.innerHTML = html;
        element.className = className;
        return element;
    }
};

window.addEventListener("DOMContentLoaded", function() {
    chrome.tabs.getSelected(null, function(tab) {
        var data = YAF.service.YAF.tabs[tab.id],
            geo  = data.geo;

        YAF.service._gaq.push(['_trackPageview']);

        var ul = document.querySelector('#menu');

        if (!geo) {
            ul.appendChild(YAF.createElement('li', geo.ip, 'data'));
            ul.appendChild(YAF.createElement('li', 'Was not found in database', 'data small'));
            return;
        }

        if (geo.isLocal) {
            ul.appendChild(YAF.createElement('li', 'Local resource', 'data'));
            ul.appendChild(YAF.createElement('li', geo.ip, 'data small'));
            return;
        }

        ul.appendChild(YAF.createElement('li', geo.country_name, 'data capitalize'));

        var region = [];
        if (geo.city) region.push(geo.city);
        if (geo.region && geo.region != geo.city) region.push(geo.region);
        if (region.length) ul.appendChild(YAF.createElement('li', region.join(', '), 'data small capitalize'));

        ul.appendChild(YAF.createElement('li', geo.ip, 'data small'));

        ul.appendChild(YAF.createElement('li', '', 'separator'));

        for (var name in YAF.services) {
            var url = YAF.services[name].url
                        .replace(/\%d/, data.domain)
                        .replace(/\%i/, geo.ip);

            var link = YAF.createElement('a', YAF.services[name].label, 'service ' + name);

            link.addEventListener('click', (function(url) {
                return function(event) {
                    chrome.tabs.create({
                        url      : url,
                        selected : true
                    });
                    _gaq.push(['_trackEvent', 'link-whois', 'clicked']);
                };
            })(url), false);

            var li = document.createElement('li');
            li.appendChild(link);
            ul.appendChild(li);
        }
    });
}, false);