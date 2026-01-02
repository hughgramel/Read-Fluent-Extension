// Background service worker - handles API requests to avoid CORS issues

chrome.runtime.onInstalled.addListener(() => {
  console.log('Read Fluent Extension installed');
});

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'downloadAudio') {
    downloadAudio(request.url)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }
  return false;
});

async function downloadAudio(videoUrl) {
  try {
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

    if (!response.ok) {
      throw new Error(`API request failed: ${response.status}`);
    }

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.text || 'Failed to get audio URL');
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
      throw new Error('No audio URL found in response');
    }

    // Fetch the actual audio file
    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      throw new Error('Failed to download audio file');
    }

    const audioBlob = await audioResponse.blob();

    // Convert blob to base64 for sending to popup
    const base64 = await blobToBase64(audioBlob);

    return {
      success: true,
      audioData: base64,
      mimeType: audioBlob.type || 'audio/mpeg'
    };

  } catch (error) {
    console.error('Download error:', error);
    return { success: false, error: error.message };
  }
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const base64 = reader.result.split(',')[1];
      resolve(base64);
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
