/*global chrome, console, YAF:true, _gaq*/

// Background service for YAFlags
// smashlong@gmail.com, 2012

window._gaq = window._gaq || [];
_gaq.push(['_setAccount', 'UA-18454737-1']);
_gaq.push(['_trackPageview']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

YAF = {
    API : {
        URL : 'http://geo.furman.im:8080/'
        // URL : 'http://turnkey:8080/'

        // puth this to manifest, they don't support comments yet
        // "http://turnkey/*",
    },
    xhr : function (domain, callback) {
        var data = {
            date : (new Date()).getTime(),
            geo  : null
        };

        YAF.storage.set(domain, data);

        var xhr = new XMLHttpRequest();
        xhr.open('GET', YAF.API.URL + domain, true);

        xhr.onreadystatechange = (function(self) {
            return function() {
                if (xhr.readyState === 4) {
                    var resp = xhr.responseText;
                    if (xhr.status === 200) {
                        // normalize received
                        data.geo = YAF.util.normalizeData( domain, JSON.parse(resp) );
                    } else {
                        data.geo = false;
                        data.error = resp.trim();
                    }
                    // save along with timestamp
                    YAF.storage.set(domain, data);
                    // pass data for processing
                    callback.call(self, domain, data);
                }
            };
        })(this);

        xhr.send(null);
        _gaq.push(['_trackPageview']);
    },
    getGeoData : function(url, callback) {
        function getDomain(url) {
            // aware of port in url, accept http(s)/ftp, any symbols in domain
            var match = url.match(/^(https?|ftp)\:\/\/(.+?)[\/\:]/);
            if (match && match[2]) {
                return match[2]; // match[1] is the protocol
            } else {
                return null;
            }
        }

        var domain = getDomain(url);
        if (!domain) {
            return;
        }

        function passedMoreThan(seconds, date) {
            return (new Date()).getTime() - date > ( seconds * 1000 );
        }
        var day = 60 * 60 * 24, // seconds
            twoWeeks = day * 14;

        // check if we're on some local IP, like router or printer
        // It's about time to introduce model, this is a mess :(
        if ( YAF.util.isLocal(domain) ) {
            callback.call(this, domain, {
                geo: { isLocal: true }
            });
            return;
        }

        var data = YAF.storage.get(domain);

        if (data && data.date) {
            var date = data.date;

            // if data has been stored for 2 weeks
            if ( passedMoreThan(twoWeeks, date) ) {
                this.xhr(domain, callback);
            // check for not found data once a day
            } else if ( !data.geo && passedMoreThan(day, date) ) {
                this.xhr(domain, callback);
            } else {
                callback.call(this, domain, data);
            }
        } else {
            this.xhr(domain, callback);
        }
    },
    setFlag : function(tab) {
        if (!tab || !tab.url) {
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
                        title : domain + ' is a local resource'
                    });
                } else {
                    var title = [];
                    if (geo.city) title.push(geo.city);
                    if (geo.region && geo.region !== geo.city) title.push(geo.region);

                    title.push(geo.country_name);

                    chrome.pageAction.setIcon({
                        tabId : tab.id,
                        path  : 'img/flags/' + geo.country_code.toLowerCase() + '.png'
                    });
                    chrome.pageAction.setTitle({
                        tabId : tab.id,
                        title : title.join(', ')
                    });
                }
            } else {
                chrome.pageAction.setIcon({
                    tabId : tab.id,
                    path  : 'img/icon/16.png'
                });
                chrome.pageAction.setTitle({
                    tabId : tab.id,
                    title : data.error || '\'' + domain + '\' was not found in database'
                });
            }

            chrome.pageAction.show(tab.id);
        });
    }
};

// update icon when tab is updated
chrome.tabs.onUpdated.addListener(function(tabID, info, tab) {
    // TODO: execute only if domain has changed
    YAF.setFlag(tab);
});
// update icon when tab is selected
chrome.tabs.onActivated.addListener(function(activeInfo) {
    // TODO: execute only if domain has changed
    chrome.tabs.get( activeInfo.tabId, YAF.setFlag.bind(YAF) );
});

YAF.storage = {
    set: function(key, data) {
        try {
            localStorage.setItem(key, JSON.stringify(data));
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
        return JSON.parse(localStorage.getItem(key));
    },
    flush: function() {
        var version = this.get('_schema');
        localStorage.clear();
        this.set('_schema', version);
    }
};

YAF.util = {
    isLocal : function(ip) {
        if (!ip) return false;
        if (ip === 'localhost') return true;

        ip = ip.split('.').map(function(oct) { return parseInt(oct, 10); });
        // 127.0.0.1 - 127.255.255.255
        if (ip[0] === 127) return true;
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
    }
};

// INFO: Migrations sucks balls
(function() {
    var schema = YAF.storage.get('_schema') || 0,
        current = 15;
    //  increment ↑↑ number in order to wipe all data
    if (schema < current) {
        YAF.storage.flush();
        YAF.storage.set('_schema', current + 1);
    }
})();