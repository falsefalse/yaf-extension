// Background service for YAFlags
// smashlong@gmail.com, 2010

YAF = {
    getGeoData : function(url, callback) {
        var match = url.match(/^(https?|ftp)\:\/\/(.+?)[\/\:]/); // aware of port in url, accept any protocol and symbols in domain
        if (!match) {
            return;
        }
        var domain = match[2]; // match[1] is the protocol
        
        if (!localStorage[domain]) {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', 'http://ipinfodb.com/ip_query2.php?ip=' + domain + '&output=json', true);
            xhr.onreadystatechange = function(event) {
                if (xhr.readyState == 4) {
                    if (xhr.status == 200) {
                        localStorage[domain] = xhr.responseText;
                        callback.call(this, localStorage[domain]);
                    }
                }
            }
            xhr.send(null);
        } else {
            callback.call(this, localStorage[domain]);
        }
    },
    setFlag : function(tab) {
        if (!tab.url) {
            return;
        }
        
        this.getGeoData(tab.url, function(geo) {
            geo = JSON.parse(geo).Locations[0];
            
            chrome.pageAction.setIcon({
                tabId : tab.id,
                path  : 'img/flags/' + geo.CountryCode.toLowerCase() + '.gif'
            });
            chrome.pageAction.setTitle({
                tabId : tab.id,
                title : [geo.CountryName, geo.RegionName, geo.City].join(', ')
            });
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