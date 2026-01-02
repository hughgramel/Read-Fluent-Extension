// Background service worker - manages offscreen document for fetch requests

let creatingOffscreen;

async function setupOffscreenDocument() {
  const offscreenUrl = 'offscreen.html';

  // Check if offscreen document already exists
  const existingContexts = await chrome.runtime.getContexts({
    contextTypes: ['OFFSCREEN_DOCUMENT'],
    documentUrls: [chrome.runtime.getURL(offscreenUrl)]
  });

  if (existingContexts.length > 0) {
    return;
  }

  // Create offscreen document
  if (creatingOffscreen) {
    await creatingOffscreen;
  } else {
    creatingOffscreen = chrome.offscreen.createDocument({
      url: offscreenUrl,
      reasons: ['DOM_SCRAPING'],
      justification: 'Fetch audio from YouTube without CORS restrictions'
    });
    await creatingOffscreen;
    creatingOffscreen = null;
  }
}

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadAudio') {
    handleDownload(request.url)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
  return false;
});

async function handleDownload(videoUrl) {
  try {
    // Ensure offscreen document exists
    await setupOffscreenDocument();

    // Send message to offscreen document
    const response = await chrome.runtime.sendMessage({
      action: 'fetchAudio',
      videoUrl: videoUrl
    });

    return response;
  } catch (err) {
    console.error('Background error:', err);
    return { success: false, error: err.message };
  }
}

console.log('Background service worker loaded');
