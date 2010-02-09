// Background service for YAFlags
// smashlong@gmail.com, 2010

YAF = {
    tabs : {},
    getGeoData : function(url, callback) {
        var match = url.match(/^(https?|ftp)\:\/\/(.+?)[\/\:]/); // aware of port in url, accept http(s)/ftp, any symbols in domain
        if (!match) {
            return;
        }
        var domain = match[2]; // match[1] is the protocol
        
        if (!localStorage[domain]) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://ipinfodb.com/ip_query2.php?ip=' + domain + '&output=json', true);
            xhr.onreadystatechange = (function(self) {
                return function(event) {
                    if (xhr.readyState == 4) {
                        if (xhr.status == 200) {
                            localStorage[domain] = xhr.responseText;
                            callback.call(self, domain, localStorage[domain]);
                        } else {
                            // do not store anything if request fails 
                            localStorage[domain] = false;
                        }
                    }
                }
            })(this)
            xhr.send(null);
            localStorage[domain] = 'is_requesting';
        } else if (localStorage[domain] != 'is_requesting') {
            callback.call(this, domain, localStorage[domain]);
        }
    },
    setFlag : function(tab) {
        if (!tab.url) {
            return;
        }
        
        this.getGeoData(tab.url, function(domain, geo) {
            geo = JSON.parse(geo).Locations[0];
            
            var title = [];
            geo.City && title.push(geo.City);
            geo.RegionName && title.push(geo.RegionName);
            title.push(geo.CountryName);
            
            chrome.pageAction.setIcon({
                tabId : tab.id,
                path  : 'img/flags/' + geo.CountryCode.toLowerCase() + '.png'
            });
            chrome.pageAction.setTitle({
                tabId : tab.id,
                title : title.join(', ')
            });
            
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