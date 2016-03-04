/*global chrome, Promise, YAF:true, _gaq*/

// Background service for YAFlags

window._gaq = window._gaq || [];
_gaq.push(['_setAccount', 'UA-18454737-1']);

(function() {
  var ga = document.createElement('script'); ga.type = 'text/javascript'; ga.async = true;
  ga.src = 'https://ssl.google-analytics.com/ga.js';
  var s = document.getElementsByTagName('script')[0]; s.parentNode.insertBefore(ga, s);
})();

// helpers
function isLocal (ip) {
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
}
function normalizeData (raw) {
    var normal = {
        ip          : raw.ip,
        country_code: raw.country_code,
        country_name: raw.country_name,
        city        : raw.city,
        postal_code : raw.postal_code
    };
    // don't want number-only regions
    // and regions that are the same as the city
    if ( raw.region && !/^\d+$/.test(raw.region) && raw.region !== raw.city )
        normal.region = raw.region;

    // on the offchance that local IP was returned by VPN DNS or other local DNS
    if ( isLocal(raw.ip) )
        normal.isLocal = true;

    return normal;
}
function getDomain (url) {
    // aware of port in url, accept http(s)/ftp, any symbols in domain
    var match = url.match(/^(https?|ftp)\:\/\/(.+?)[\/\:]/);
    if (match && match[2]) {
        // match[1] is the protocol
        return match[2];
    }
    return false;
}
function passedMoreThan (seconds, date) {
    return (new Date()).getTime() - date > ( seconds * 1000 );
}

var c = document.createElement('canvas').getContext('2d');
c.width = c.height = 19;

function center(whole, part) { return Math.round((whole - part) / 2); }

function setIcon(tabId, path) {
    var img = new Image();
    img.onload = function() {
        c.clearRect(0, 0, c.width, c.height);
        console.log(img.width, img.height);
        c.drawImage(img, center(c.width, img.width), center(c.height, img.height), img.width, img.height);

        chrome.pageAction.setIcon({
            tabId : tabId,
            imageData : c.getImageData(0, 0, 19, 19)
        });
    };
    img.src = path;
}

function updatePageAction(tab, domain, data) {
    var geo = data.geo;

    if (geo) {
        if (geo.isLocal) {
            setIcon(tab.id, 'img/local_resource.png');
            chrome.pageAction.setTitle({
                tabId : tab.id,
                title : domain + ' is a local resource'
            });
        } else {
            var title = [geo.country_name];
            if (geo.city) title.splice(0, 0, geo.city);
            if (geo.region) title.splice(1, 0, geo.region);

            setIcon(tab.id, 'img/flags/' + geo.country_code.toLowerCase() + '.png');
            chrome.pageAction.setTitle({
                tabId : tab.id,
                title : title.join(', ')
            });
        }
    } else {
        setIcon(tab.id, 'img/icon/16.png');
        chrome.pageAction.setTitle({
            tabId : tab.id,
            title : data.error || '\'' + domain + '\' was not found in database'
        });
    }

    chrome.pageAction.show(tab.id);
}

var API_URL = 'http://geo.furman.im:8080/';
YAF = {
    request: function(domain) {
        var data = {
            date : (new Date()).getTime(),
            geo  : null
        };
        YAF.storage.set(domain, data);

        return new Promise(function(resolve, reject) {
            var xhr = new XMLHttpRequest(), resp;
            xhr.open('GET', API_URL + domain, true);
            xhr.onload = function() {
                _gaq.push(['_trackPageview']);

                if (xhr.status === 200) {
                    data.geo = normalizeData( JSON.parse(xhr.responseText) );
                } else {
                    try {
                        resp = JSON.parse(xhr.responseText);
                    } catch(e) {
                        resp = xhr.responseText;
                    }
                    data.error = resp.error || resp;
                    if (resp.ip) {
                        data.geo = {
                            ip: resp.ip,
                            isLocal: isLocal(resp.ip)
                        };
                    }
                }
                // TODO: handle dead server, `reject` should do something

                YAF.storage.set(domain, data);
                resolve( [domain, data] );
            };
            xhr.onerror = function() {
                reject( new Error('Network Error') );
            };
            xhr.send(null);
        });
    },
    getGeoData : function(domain, reload) {
        // constants
        var day = 60 * 60 * 24, // seconds
            twoWeeks = day * 14;

        // do we already have data for this domain?
        var data = YAF.storage.get(domain) || {};

        // short-circuit for the local domains (boths IPs and user-marked)
        if ( isLocal(domain) || (data.geo && data.geo.isLocal) ) {
            return Promise.resolve( [domain, { geo: data.geo || { isLocal: true } }] );
        }

        if (data.date && !reload) {
            // if data has been stored for 2 weeks - refetch it
            if ( passedMoreThan(twoWeeks, data.date) ) {
                return this.request(domain);
            // refetch 404s once a day
            } else if ( !data.geo && passedMoreThan(day, data.date) ) {
                return this.request(domain);
            } else {
                return Promise.resolve([domain, data]);
            }
        } else {
            return this.request(domain);
        }
    },


    // need `tab` since it could need to modify it later
    setFlag : function(tab, reload) {
        var domain = getDomain(tab.url);
        if (!domain) { return; }
        return this.getGeoData( domain, reload )
            .then(function(args) {
                args.unshift(tab);
                updatePageAction.apply(YAF, args);
            });
    }
};

function _getURL(tab) {
    if (!tab || !tab.url) {
        return false;
    } else {
        return tab.url;
    }
}

// update icon when tab is updated
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
    if (changeInfo.status !== 'complete') {
        return;
    }
    YAF.setFlag( tab );
});
// update icon when tab is selected
chrome.tabs.onActivated.addListener(function(activeInfo) {
    // TODO: execute only if domain has changed
    chrome.tabs.get( activeInfo.tabId, function(tab) {
        if (_getURL(tab)) {
            YAF.setFlag( tab );
        }
    } );
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
