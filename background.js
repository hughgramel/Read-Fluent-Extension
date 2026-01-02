// Background service worker - handles API requests to avoid CORS issues

chrome.runtime.onInstalled.addListener(() => {
  console.log('Read Fluent Extension installed');
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Background received message:', request.action);

  if (request.action === 'downloadAudio') {
    // Handle async operation
    handleDownload(request.url, sendResponse);
    return true; // CRITICAL: keeps the message channel open
  }

  return false;
});

async function handleDownload(videoUrl, sendResponse) {
  try {
    console.log('Starting download for:', videoUrl);

    // Use cobalt.tools API
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        isAudioOnly: true,
        disableMetadata: false
      })
    });

    console.log('API response status:', response.status);

    if (!response.ok) {
      const text = await response.text();
      console.error('API error response:', text);
      sendResponse({ success: false, error: `API request failed: ${response.status}` });
      return;
    }

    const data = await response.json();
    console.log('API response data:', data);

    if (data.status === 'error') {
      sendResponse({ success: false, error: data.text || 'Failed to get audio URL' });
      return;
    }

    let audioUrl = null;

    if (data.status === 'redirect' || data.status === 'stream') {
      audioUrl = data.url;
    } else if (data.status === 'picker') {
      const audioOption = data.picker.find(p => p.type === 'audio') || data.picker[0];
      if (audioOption && audioOption.url) {
        audioUrl = audioOption.url;
      }
    }

    if (!audioUrl) {
      sendResponse({ success: false, error: 'No audio URL found in response' });
      return;
    }

    console.log('Fetching audio from:', audioUrl);

    // Fetch the actual audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      sendResponse({ success: false, error: 'Failed to download audio file' });
      return;
    }

    const audioBlob = await audioResponse.blob();
    console.log('Audio blob size:', audioBlob.size);

    // Convert blob to base64 for sending to popup
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      console.log('Sending audio data, length:', base64.length);
      sendResponse({
        success: true,
        audioData: base64,
        mimeType: audioBlob.type || 'audio/mpeg'
      });
    };
    reader.onerror = () => {
      sendResponse({ success: false, error: 'Failed to encode audio' });
    };
    reader.readAsDataURL(audioBlob);

  } catch (error) {
    console.error('Download error:', error);
    sendResponse({ success: false, error: error.message });
  }
}
