// Offscreen document for making fetch requests without CORS issues

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'fetchAudio') {
    handleFetch(request.videoUrl)
      .then(sendResponse)
      .catch(err => sendResponse({ success: false, error: err.message }));
    return true;
  }
});

async function handleFetch(videoUrl) {
  console.log('Offscreen: fetching audio for', videoUrl);

  // Try cobalt API
  const apis = [
    'https://co.wuk.sh/api/json',
    'https://api.cobalt.tools/api/json'
  ];

  let lastError = null;

  for (const apiUrl of apis) {
    try {
      console.log('Trying API:', apiUrl);

      const response = await fetch(apiUrl, {
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

      if (!response.ok) {
        lastError = `API returned ${response.status}`;
        continue;
      }

      const data = await response.json();
      console.log('API response:', data);

      if (data.status === 'error') {
        lastError = data.text || 'API error';
        continue;
      }

      const audioUrl = data.url;
      if (!audioUrl) {
        lastError = 'No audio URL in response';
        continue;
      }

      console.log('Downloading audio from:', audioUrl);

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        lastError = 'Failed to download audio file';
        continue;
      }

      const blob = await audioResponse.blob();
      console.log('Got blob, size:', blob.size);

      // Convert to base64
      const base64 = await blobToBase64(blob);

      return {
        success: true,
        audioData: base64,
        mimeType: blob.type || 'audio/mpeg'
      };

    } catch (err) {
      console.error('API error:', err);
      lastError = err.message;
    }
  }

  return { success: false, error: lastError || 'All APIs failed' };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
