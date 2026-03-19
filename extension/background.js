// Background service worker — handles downloads and message routing

chrome.runtime.onMessage.addListener(function(msg, sender) {
  // Route content script messages to popup
  if (msg.type === 'scroll-progress' || msg.type === 'fetch-progress' || msg.type === 'done' || msg.type === 'error') {
    chrome.runtime.sendMessage(msg).catch(function() {});
  }

  // Handle download requests from content script
  if (msg.type === 'download') {
    chrome.downloads.download({
      url: msg.url,
      filename: msg.filename,
      saveAs: false
    });
  }
});
