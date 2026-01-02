// Background service worker
console.log('Background script loaded!');

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  console.log('Message received:', request);

  if (request.action === 'downloadAudio') {
    fetchAudio(request.url).then(sendResponse);
    return true; // Keep channel open
  }

  if (request.action === 'ping') {
    sendResponse({ pong: true });
    return false;
  }

  return false;
});

async function fetchAudio(videoUrl) {
  console.log('Fetching audio for:', videoUrl);

  try {
    // Try cobalt API
    const apiResponse = await fetch('https://co.wuk.sh/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: videoUrl,
        aFormat: 'mp3',
        isAudioOnly: true
      })
    });

    console.log('API status:', apiResponse.status);

    if (!apiResponse.ok) {
      return { success: false, error: `API error: ${apiResponse.status}` };
    }

    const data = await apiResponse.json();
    console.log('API data:', data);

    if (data.status === 'error') {
      return { success: false, error: data.text || 'API returned error' };
    }

    const audioUrl = data.url;
    if (!audioUrl) {
      return { success: false, error: 'No audio URL in response' };
    }

    console.log('Downloading from:', audioUrl);

    const audioResponse = await fetch(audioUrl);
    if (!audioResponse.ok) {
      return { success: false, error: 'Failed to fetch audio file' };
    }

    const blob = await audioResponse.blob();
    console.log('Got blob, size:', blob.size);

    // Convert to base64
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => {
        resolve({
          success: true,
          audioData: reader.result.split(',')[1],
          mimeType: blob.type || 'audio/mpeg'
        });
      };
      reader.onerror = () => {
        resolve({ success: false, error: 'Failed to read audio' });
      };
      reader.readAsDataURL(blob);
    });

  } catch (err) {
    console.error('Error:', err);
    return { success: false, error: err.message };
  }
}
