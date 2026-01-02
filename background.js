// Background service worker
// Currently minimal - can be extended for future features like OpenAI integration

chrome.runtime.onInstalled.addListener(() => {
  console.log('Read Fluent Extension installed');
});

// Listen for messages (for future features)
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'ping') {
    sendResponse({ status: 'ok' });
    return false;
  }
  return false;
});
