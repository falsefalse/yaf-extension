// Background service for YAFlags
// smashlong@gmail.com, 2010

/*jshint curly:false, undef:true*/
/*global browser:true, DOMException:true, chrome:true, YAF:true*/

String.prototype.capitalize = function() {
    return this.replace(/(^| )(\w)/g, function($0) {
        return $0.toUpperCase();
    });
};

window._gaq = window._gaq || [];
_gaq.push(['_setAccount', 'UA-18454737-1']);

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
        };

        YAF.storage.set(domain, JSON.stringify(data));

        var xhr = new XMLHttpRequest();
        var query = [['key', YAF.API.key], ['ip', domain], ['format', 'json'], ['timezone', 'false']];

        xhr.open('GET', YAF.API.URL + '?' + (query.map(function(parameter) {
            return parameter.join('=');
        })).join('&'), true);

        xhr.onreadystatechange = (function(self) {
            return function(event) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        // normalize received
                        data.geo = YAF.util.normalizeData(domain, JSON.parse(xhr.responseText));
                        // save along with timestamp
                        YAF.storage.set(domain, JSON.stringify(data));
                        // pass data for processing
                        callback.call(self, domain, data);
                    } else {
                        // do not store anything if request fails
                        data.geo = false;
                        YAF.storage.set(domain, JSON.stringify(data));
                    }
                }
            };
        })(this);

        xhr.send(null);
        _gaq.push(['_trackPageview']);
    },
    getGeoData : function(url, callback) {
        var domain = this.getDomain(url);
        if (!domain) {
            return;
        }

        var storedJSON = YAF.storage.get(domain);

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

            if (geo.countryCode) {
                var title = [];
                if (geo.cityName) title.push(geo.cityName);
                if (geo.regionName && geo.regionName != geo.cityName) title.push(geo.regionName);
                title.push(geo.countryName);

                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/flags/' + geo.countryCode.toLowerCase() + '.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : title.join(', ').capitalize()
                });
            } else if (geo.isLocal) {
                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/local_resource.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : geo.ipAddress + ' is a local resource'
                });
            } else {
                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/icon/16.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : '\'' + geo.ipAddress + '\' was not found in database'
                });
            }

            this.tabs[tab.id] = {
                domain : domain,
                geo    : geo
            };

            chrome.pageAction.show(tab.id);
        });
    }
};

// get message from content script and update icon
chrome.extension.onRequest.addListener(function(request, sender, sendResponse) {
    YAF.setFlag(sender.tab);
    sendResponse({});
});
// update icon when tab is updated
chrome.tabs.onUpdated.addListener(function(tabID, info, tab) {
    // TODO: execute only if domain has changed
    YAF.setFlag(tab);
});
// update icon when tab is selected
chrome.tabs.onSelectionChanged.addListener(function(tabID, selectionInfo) {
    // TODO: execute only if domain has changed
    chrome.tabs.get(tabID, function(tab) {
        YAF.setFlag(tab);
    });
});

YAF.storage = {
    set: function(key, data) {
        try {
            localStorage.setItem(key, data);
        } catch(e) {
            // at certain point we'll bump into localStorage 5MB limit
            if (e.code && e.code === DOMException.prototype.QUOTA_EXCEEDED_ERR) {
                console.info('Run into 5MB localStorage limit, flushing the cache now');
                YAF.storage.flush();

                // try writing again
                localStorage.setItem(key, data);
            } else {
                throw e;
            }
        }
    },
    get: function(key) {
        return localStorage.getItem(key);
    },
    flush: function() {
        var version = this.get('_schema');
        localStorage.clear();
        this.set('_schema', version);
    }
};

YAF.util = {
    isLocal : function(domain, IP) {
        // handle edge case when trying to resolve domains from local hosts file
        // first letter of such domain will be a char. otherwise domain equals each
        // other when domain is IP (like navigate to http://8.8.8.8)
        if ( /^[^\d]/.test(IP) && domain === IP ) {
            return true;
        } else {
            IP = IP.split('.').map(function(oct) { return parseInt(oct, 10); });
            // 10.0.0.0 – 10.255.255.255
            if (IP[0] === 10) { return true; }
            // 172.16.0.0 – 172.31.255.255
            if (IP[0] === 172 && IP[1] >= 16 && IP[1] <= 31) { return true; }
            // 192.168.0.0 – 192.168.255.255
            if (IP[0] === 192 && IP[1] === 168) { return true; }

            return false;
        }

    },
    normalizeData : function(domain, geo) {
        for (var key in geo) {
            if (key === 'latitude' || key === 'longitude' || key === 'timeZone' || key === 'statusCode' || key === 'zipCode') {
                delete geo[key];
                continue;
            }
            // this will delete countryCode if nothing was found, we check for it later
            if (geo[key] === '-' || geo[key] === '') {
                delete geo[key];
                continue;
            }
            // i can't believe this, fucking text-transform: capitalize; won't
            // change the uppercase letters at all :(
            if (typeof geo[key] === 'string') {
                geo[key] = geo[key].toLowerCase();
            }
        }

        // no need to waste space for 'isLocal':false
        if ( this.isLocal(domain, geo.ipAddress) ) {
            geo.isLocal = true;
        }

        this.fixISO(geo);
        return geo;
    },
    fixISO : function(geo) {
        // match API with flag icon, apparently API doesn't respect ISO :(
        if (geo.countryCode === 'uk') {
            geo.countryCode = 'gb';
        }
        return geo;
    }
};

// TODO: migrations, one way
// add dates to stored geo data
if (!YAF.storage.get('_schema')) {
    for (var domain in localStorage) {
        var geo = JSON.parse(localStorage[domain]);
        if (!geo.date) {
            localStorage[domain] = JSON.stringify({
                date : (new Date()).getTime(),
                geo  : geo
            });
        }
    }
    YAF.storage.set('_schema', 1);
}

// ipinfodb API changed, wipes all data
if (YAF.storage.get('_schema') == 1) {
    YAF.storage.flush();
    YAF.storage.set('_schema', 2);
}

// API changed again, data are normalized from this point
if (YAF.storage.get('_schema') == 2) {
    YAF.storage.flush();
    YAF.storage.set('_schema', 3);
}

// Change already stored UK country code to match flag icon ISO names
if (YAF.storage.get('_schema') == 3) {
    var data;
    for (var key in localStorage) {
        if (key === '_schema') continue;
        data = JSON.parse(localStorage[key]);
        if (data.geo.countryCode === 'uk') {
            YAF.util.fixISO(data.geo);
            localStorage[key] = JSON.stringify(data);
        }
    }
    YAF.storage.set('_schema', 4);
}

// Remove notFound, fix isLocal
if (YAF.storage.get('_schema') == 4 || YAF.storage.get('_schema') == 5 || YAF.storage.get('_schema') == 6) {
    var data;
    for (var key in localStorage) {
        if (key === '_schema') continue;
        data = JSON.parse(localStorage[key]);
        // restart anything stuck, delete cached entry
        if (data.geo === 'is_requesting') {
            delete localStorage[key];
            continue;
        }
        delete data.geo.notFound;
        delete data.geo.isLocal;
        if ( YAF.util.isLocal(key, data.geo.ipAddress) ) {
            data.geo.isLocal = true;
        }
        localStorage[key] = JSON.stringify(data);
    }
    YAF.storage.set('_schema', 7);
}