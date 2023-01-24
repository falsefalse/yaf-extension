/*global chrome */

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

var SIZE = 19;
var c = new OffscreenCanvas(SIZE, SIZE).getContext('2d', { willReadFrequently: true });
c.width = c.height = SIZE;

function center(whole, part) { return Math.round((whole - part) / 2); }

async function setIcon(tabId, path) {
    path = '../' + path;
    const imgBlob = await fetch(path).then(r => r.blob());
    const img = await createImageBitmap(imgBlob);

    c.clearRect(0, 0, c.width, c.height);
    c.drawImage(img, center(c.width, img.width), center(c.height, img.height), img.width, img.height);

    chrome.action.setIcon({
        tabId: tabId,
        imageData: c.getImageData(0, 0, SIZE, SIZE)
    });
}

function updatePageAction(tab, domain, data) {
    var geo = data.geo;

    if (geo) {
        if (geo.isLocal) {
            setIcon(tab.id, 'img/local_resource.png');
            chrome.action.setTitle({
                tabId : tab.id,
                title : domain + ' is a local resource'
            });
        } else {
            var title = [geo.country_name];
            if (geo.city) title.splice(0, 0, geo.city);
            if (geo.region) title.splice(1, 0, geo.region);

            setIcon(tab.id, 'img/flags/' + geo.country_code.toLowerCase() + '.png');
            chrome.action.setTitle({
                tabId : tab.id,
                title : title.join(', ')
            });
        }
    } else {
        setIcon(tab.id, 'img/icon/16.png');
        chrome.action.setTitle({
            tabId : tab.id,
            title : data.error || '\'' + domain + '\' was not found in database'
        });
    }
}

var API_URL = 'http://geo.furman.im:8080/';
var YAF = {
    request: async function(domain) {
        var data = {
            date : (new Date()).getTime(),
            geo  : null
        };

        let response, json
        try {
            response = await fetch(API_URL + domain)
        } catch (error) {
            data.error = error
            return data
        }
        if (!response.ok) {
            data.error = await response.text()
            return data
        } else {
            json = await response.json()
        }
        data.geo = normalizeData(json)

        return data
    },
    getGeoData : async function(domain, reload) {
        // constants
        var day = 60 * 60 * 24, // seconds
            twoWeeks = day * 14;

        // do we already have data for this domain?
        var data = (await YAF.storage.get(domain)) || {};

        // short-circuit for the local domains (boths IPs and user-marked)
        if ( isLocal(domain) || (data.geo && data.geo.isLocal) ) {
            return { geo: data.geo || { isLocal: true } };
        }

        if (data.date && !reload) {
            // if data has been stored for 2 weeks - refetch it
            if ( passedMoreThan(twoWeeks, data.date) ) {
                return await this.request(domain);
            // refetch 404s once a day
            } else if ( !data.geo && passedMoreThan(day, data.date) ) {
                return await this.request(domain);
            } else {
                return data;
            }
        } else {
            return await this.request(domain);
        }
    },

    setFlag : async function(tab, reload) {
        var domain = getDomain(tab.url);
        if (!domain) return

        const geoData = await this.getGeoData( domain, reload )
        YAF.storage.set(domain, geoData)
        updatePageAction(tab, domain, geoData);

        return geoData;
    }
};

function tabHasUrl(tab) {
    return Boolean(tab && tab.url)
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
        if (tabHasUrl(tab)) {
            YAF.setFlag( tab );
        }
    } );
});

YAF.storage = {
    set: function(key, value) {
        try {
            chrome.storage.local.set({ [key]: value })
        } catch (error) {
            chrome.storage.local.clear()
        }

    },
    get: async function (key) {
        return (await chrome.storage.local.get(key))[key];
    }
};

export { YAF, getDomain, isLocal }
