// Background service for YAFlags
// smashlong@gmail.com, 2010

/*jshint curly:false, undef:true*/
/*global browser:true, chrome:true, YAF:true, _gaq:true*/

String.prototype.capitalize = function() {
    return this.replace(/(^| )(\w)/g, function($0) {
        return $0.toUpperCase();
    });
};

window._gaq = window._gaq || [];
_gaq.push(['_setAccount', 'UA-18454737-1']);

YAF = {
    API : {
        // URL : 'http://geo.furman.im:8080/'
        URL : 'http://turnkey:8080/'
    },
    tabs : {},
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
        xhr.open('GET', YAF.API.URL + domain, true);

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

        function isRequesting(data) {
            return !data.geo || data.geo === 'is_requesting';
        }
        function passedMoreThan(seconds, date) {
            return (new Date()).getTime() - date > ( seconds * 1000 );
        }
        var day = 60 * 60 * 24, // seconds
            twoWeeks = day * 14;

        var storedJSON = YAF.storage.get(domain);

        if (storedJSON) {
            var data = JSON.parse(storedJSON),
                date = data.date;

            // request again if there are no data after 10 seconds
            if ( isRequesting(data) && passedMoreThan(10, date) ) {
                this.xhr(domain, callback);
            // or if data has been stored for 2 weeks
            } else if (passedMoreThan(twoWeeks, date)) {
                this.xhr(domain, callback);
            } else {
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

            if (geo) {
                if (geo.isLocal) {
                    chrome.pageAction.setIcon({
                        tabId : tab.id,
                        path  : 'img/local_resource.png'
                    });
                    chrome.pageAction.setTitle({
                        tabId : tab.id,
                        title : geo.ipAddress + ' is a local resource'
                    });
                } else {
                    var title = [];
                    if (geo.city) title.push(geo.city);
                    if (geo.region && geo.region != geo.city) title.push(geo.region);

                    title.push(geo.country_name);

                    chrome.pageAction.setIcon({
                        tabId : tab.id,
                        path  : 'img/flags/' + geo.country_code.toLowerCase() + '.png'
                    });
                    chrome.pageAction.setTitle({
                        tabId : tab.id,
                        title : title.join(', ').capitalize()
                    });
                }
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

            // this is some magic that fixes flags that didn't appear after
            // first extension install and load
            setTimeout(function() { chrome.pageAction.show(tab.id); }, 125);
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
            if (e.code && e.code === window.DOMException.prototype.QUOTA_EXCEEDED_ERR) {
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
    isLocal : function(ip) {
        if (!ip) { return false; }

        ip = ip.split('.').map(function(oct) { return parseInt(oct, 10); });
        // 10.0.0.0 - 10.255.255.255
        if (ip[0] === 10) return true;
        // 172.16.0.0 - 172.31.255.255
        if (ip[0] === 172 && ip[1] >= 16 && ip[1] <= 31) return true;
        // 192.168.0.0 - 192.168.255.255
        if (ip[0] === 192 && ip[1] === 168) return true;

        return false;
    },
    normalizeData : function(domain, geo) {
        // just some random chance that local ip was returned by some
        // local VPN DNS or something
        if ( this.isLocal(geo.ip) ) geo.isLocal = true;

        var normal = {
            ip          : geo.ip,
            country_code: geo.country_code,
            country_name: geo.country_name,
            city        : geo.city,
            postal_code : geo.postal_code
        };
        if ( geo.region && !/^\d+$/.test(geo.region) )
            normal.region = geo.region;

        return normal;
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
    for (var domain in localStorage) {
        if (domain === '_schema') continue;
        data = JSON.parse(localStorage[domain]);
        if (data.geo.countryCode === 'uk') {
            YAF.util.fixISO(data.geo);
            localStorage[domain] = JSON.stringify(data);
        }
    }
    YAF.storage.set('_schema', 4);
}

// Remove notFound, fix isLocal
if (YAF.storage.get('_schema') == 4 || YAF.storage.get('_schema') == 5 || YAF.storage.get('_schema') == 6) {
    var data;
    for (var domain in localStorage) {
        if (domain === '_schema') continue;
        data = JSON.parse(localStorage[domain]);
        // restart anything stuck, delete cached entry
        if (data.geo === 'is_requesting') {
            delete localStorage[domain];
            continue;
        }
        delete data.geo.notFound;
        delete data.geo.isLocal;
        if ( YAF.util.isLocal(domain, data.geo.ipAddress) ) {
            data.geo.isLocal = true;
        }
        localStorage[domain] = JSON.stringify(data);
    }
    YAF.storage.set('_schema', 7);
}

// flush isLocal, there are false positives for not found domains
if (YAF.storage.get('_schema') == 7) {
    YAF.storage.flush();
    YAF.storage.set('_schema', 8);
}

// don't store not found entries
if (YAF.storage.get('_schema') == 8) {
    var data;
    for (var key in localStorage) {
        if (key === '_schema') continue;
        data = JSON.parse(localStorage[key]);

        if (!data.geo.countryCode && !data.geo.isLocal) {
            delete localStorage[key];
            continue;
        }
    }
    YAF.storage.set('_schema', 9);
}

// new backend
if (YAF.storage.get('_schema') == 9) {
    YAF.storage.flush();
    YAF.storage.set('_schema', 10);
}