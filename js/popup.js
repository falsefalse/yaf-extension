// Render services links for domain/IP and display them in popup
// smashlong@gmail.com, 2010

var countryList = {
    "ai" : "Australia",
    "ch" : "China",
    "us" : "United States",
    "jp" : "Japan",
    "in" : "India",
    "br" : "Brazil",
    "de" : "Germany",
    "uk" : "United Kingdom",
    "ru" : "Russia",
    "fr" : "France",
    "kr" : "Korea South",
    "ir" : "Iran",
    "it" : "Italy",
    "il" : "Israel",
    "id" : "Indonesia",
    "es" : "Spain",
    "mx" : "Mexico",
    "tr" : "Turkey",
    "ca" : "Canada",
    "ph" : "Philippines",
    "vn" : "Vietnam",
    "pl" : "Poland",
    "fi" : "Finland",
    "nl" : "Netherlands",
    "se" : "Sweden",
    "th" : "Thailand"
}

var backgroundPage = chrome.extension.getBackgroundPage();
var services = {
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
}

window.addEventListener("DOMContentLoaded", function() {
    var countryName = countryList[backgroundPage.lastCountry.toLowerCase()];
    if (countryName) {
        var country = document.getElementById("country");
        var flag = document.createElement('img');
        flag.setAttribute('src', 'flags/' + backgroundPage.lastCountry.toLowerCase() + '.gif');
        country.appendChild(flag);
        country.appendChild(document.createTextNode(lastCountry));
    }
    document.getElementById("domain").innerHTML = backgroundPage.lastDomain;
    document.getElementById("ip").innerHTML = backgroundPage.lastIP;
    
    var ul = document.querySelector('#menu');
    for (var name in services) {
        var url = services[name].url
            .replace(/\%d/, backgroundPage.lastDomain)
            .replace(/\%i/, backgroundPage.lastIP)

        var link = document.createElement('a');
        link.className = "service " + name;
        link.innerHTML = services[name].label;
        
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
}, false);