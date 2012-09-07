/*global chrome*/
// Notify YAF that tab has started loading
// smashlong@gmail.com, 2010

chrome.extension.sendRequest({'document_start' : true});