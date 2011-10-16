// Background service for YAFlags
// smashlong@gmail.com, 2010

YAF = {
    API : {
        key : '8e0b0ae78b430161344890b492099daeb04e75d7610a0211b684b720789d9de6',
        URL : 'http://api.ipinfodb.com/v3/ip-city/'
    },
    tabs : {},
    passedMoreThanFrom : function(msec, date) {
        return (((new Date()).getTime() - date)) > msec;
    },
    getDomain : function(url) {
        var match = url.match(/^(https?|ftp)\:\/\/(.+?)[\/\:]/); // aware of port in url, accept http(s)/ftp, any symbols in domain
        if (match && match[2]) {
            return match[2]; // match[1] is the protocol
        } else {
            return null;
        }
    },
    xhr : function (domain, callback) {
        var data = {
            date : (new Date()).getTime(),
            geo  : 'is_requesting'
        }
        
        localStorage[domain] = JSON.stringify(data);
        
        var xhr = new XMLHttpRequest();
        var query = [['key', YAF.API.key], ['ip', domain], ['format', 'json'], ['timezone', 'false']];

        xhr.open('GET', YAF.API.URL + '?' + (query.map(function(parameter) {
            return parameter.join('=');
        })).join('&'), true);
    
        xhr.onreadystatechange = (function(self) {
            return function(event) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        // store geo
                        data.geo = JSON.parse(xhr.responseText);
                        // encode
                        localStorage[domain] = JSON.stringify(data);
                        // pass data for processing
                        callback.call(self, domain, data);
                    } else {
                        // do not store anything if request fails 
                        data.geo = false;
                        localStorage[domain] = JSON.stringify(data);
                    }
                }
            }
        })(this);
        
        xhr.send(null);
    },
    getGeoData : function(url, callback) {
        var domain = this.getDomain(url);
        if (!domain) {
            return;
        }
        
        var storedJSON = localStorage[domain];
        if (storedJSON) {
            var data = JSON.parse(storedJSON);
            // if there is an request open more than for 5 sec, or if there is no data loaded for more that 5 sec - try load again
            // if more than a month passed since last load - reload data
            if (
                 ((!data.geo || data.geo == 'is_requesting') && this.passedMoreThanFrom(10000, data.date)) || 
                 (data.geo != 'is_requesting' && this.passedMoreThanFrom(2592000000, data.date)) // month
               ) { 
                this.xhr(domain, callback);
            } else if (typeof data.geo === 'object') {
                callback.call(this, domain, data);
            }
        } else {
            this.xhr(domain, callback);
        }
    },
    setFlag : function(tab) {
        if (!tab.url) {
            return;
        }
        
        this.getGeoData(tab.url, function(domain, data) {
            var geo = data.geo;
            
            if (/not found/.test(geo.Status.toLowerCase())) {
                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/icon/16.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : '\'' + geo.Ip + '\' was not found in database'
                });
            } else if (geo.CountryName === 'Reserved') {
                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/local_resource.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : geo.Ip + ' is local resource'
                });
            } else {
                var title = [];
                geo.City && title.push(geo.City);
                geo.RegionName && geo.RegionName != geo.City && title.push(geo.RegionName);
                title.push(geo.CountryName);
                
                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/flags/' + geo.CountryCode.toLowerCase() + '.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : title.join(', ')
                });
            }
            
            this.tabs[tab.id] = {
                domain : domain,
                geo    : geo
            }
            
            chrome.pageAction.show(tab.id);
        });
    }
}

// get message from content script and update icon
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    YAF.setFlag(sender.tab)
    sendResponse({});
});
// update icon when tab is updated
chrome.tabs.onUpdated.addListener(function(tabID, info, tab) {
    YAF.setFlag(tab);
});
// update icon when tab is selected
chrome.tabs.onSelectionChanged.addListener(function(tabID, selectionInfo) {
    chrome.tabs.get(tabID, function(tab) {
        YAF.setFlag(tab);
    });
});

// add dates to stored geo data 
if (!localStorage['_schema']) {
    for (var domain in localStorage) {
        var geo = JSON.parse(localStorage[domain]);
        if (!geo.date) {
            localStorage[domain] = JSON.stringify({
                date : (new Date()).getTime(),
                geo  : geo
            });
        }
    }
    localStorage['_schema'] = 1;
}

// ipinfodb API changed, wipes all data
if (localStorage['_schema'] == 1) {
    for (var key in localStorage) {
        if (key !== '_schema') {
            delete localStorage[key];
        }
    }
    localStorage['_schema'] = 2;
}