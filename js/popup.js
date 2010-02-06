// Render services links for domain/IP and display them in popup
// smashlong@gmail.com, 2010

YAF = {
    service : chrome.extension.getBackgroundPage(),
    services : {
        'trends' : {
            url : "http://trends.google.com/websites?q=%d&sa=N",
            label : 'Google Trends'
        },
        'whois' : {
            url : "http://whois.domaintools.com/%d",
            label : 'WhoIs'
        },
        'geoip' : {
            url : "http://geotool.servehttp.com/?host=%d&ip=%i",
            label : 'GeoIP'
        }
    },
    createElement : function(tag, html, className) {
        var element = document.createElement(tag);
        element.innerHTML = html;
        element.className = className;
        return element;
    }
}

window.addEventListener("DOMContentLoaded", function() {
    chrome.tabs.getSelected(null, function(tab) {
        var data = YAF.service.YAF.tabs[tab.id];
        
        var ul = document.querySelector('#menu');
        
        ul.appendChild(YAF.createElement('li', data.geo.CountryName, 'data'));
        
        var region = [];
        data.geo.City && region.push(data.geo.City);
        data.geo.RegionName && data.geo.RegionName != data.geo.City && region.push(data.geo.RegionName);
        region.length && ul.appendChild(YAF.createElement('li', region.join(', '), 'data small'));
        
        ul.appendChild(YAF.createElement('li', data.geo.Ip, 'data small'));

        ul.appendChild(YAF.createElement('li', '', 'separator'));
        
        for (var name in YAF.services) {
            var url = YAF.services[name].url
                        .replace(/\%d/, data.domain)
                        .replace(/\%i/, data.geo.Ip);
    
            var link = YAF.createElement('a', YAF.services[name].label, 'service ' + name);
            
            link.addEventListener('click', (function(url) {
                return function(event) {
                    chrome.tabs.create({
                        url      : url,
                        selected : true
                    });
                }
            })(url), false);
            
            var li = document.createElement('li');
            li.appendChild(link);
            ul.appendChild(li);
        }
    });
}, false);