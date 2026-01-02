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

  // Extract video ID
  const videoId = extractVideoId(videoUrl);
  if (!videoId) {
    return { success: false, error: 'Could not extract video ID' };
  }

  console.log('Video ID:', videoId);

  // Try multiple approaches
  const approaches = [
    () => tryCobaltV2(videoUrl),
    () => tryY2Mate(videoId),
    () => trySaveFrom(videoUrl)
  ];

  let lastError = null;

  for (const approach of approaches) {
    try {
      const result = await approach();
      if (result.success) {
        return result;
      }
      lastError = result.error;
    } catch (err) {
      console.error('Approach error:', err);
      lastError = err.message;
    }
  }

  return { success: false, error: lastError || 'All download methods failed' };
}

function extractVideoId(url) {
  const match = url.match(/[?&]v=([^&]+)/) || url.match(/youtu\.be\/([^?]+)/);
  return match ? match[1] : null;
}

// Cobalt API v2 format
async function tryCobaltV2(videoUrl) {
  console.log('Trying Cobalt v2...');

  const response = await fetch('https://api.cobalt.tools/', {
    method: 'POST',
    headers: {
      'Accept': 'application/json',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      url: videoUrl,
      downloadMode: 'audio',
      audioFormat: 'mp3'
    })
  });

  if (!response.ok) {
    return { success: false, error: `Cobalt: ${response.status}` };
  }

  const data = await response.json();
  console.log('Cobalt response:', data);

  if (data.status === 'error' || !data.url) {
    return { success: false, error: data.error?.code || 'Cobalt failed' };
  }

  return await downloadAudioFromUrl(data.url);
}

// Y2Mate approach
async function tryY2Mate(videoId) {
  console.log('Trying Y2Mate...');

  // Step 1: Analyze
  const analyzeResponse = await fetch('https://www.y2mate.com/mates/analyzeV2/ajax', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `k_query=https://www.youtube.com/watch?v=${videoId}&k_page=home&hl=en&q_auto=0`
  });

  if (!analyzeResponse.ok) {
    return { success: false, error: 'Y2Mate analyze failed' };
  }

  const analyzeData = await analyzeResponse.json();
  console.log('Y2Mate analyze:', analyzeData);

  if (analyzeData.status !== 'ok' || !analyzeData.links?.mp3) {
    return { success: false, error: 'Y2Mate: No audio links' };
  }

  // Get the 128kbps MP3 option
  const mp3Links = analyzeData.links.mp3;
  const audioKey = Object.keys(mp3Links).find(k => mp3Links[k].q === '128kbps') || Object.keys(mp3Links)[0];

  if (!audioKey) {
    return { success: false, error: 'Y2Mate: No MP3 option' };
  }

  const audioInfo = mp3Links[audioKey];

  // Step 2: Convert
  const convertResponse = await fetch('https://www.y2mate.com/mates/convertV2/index', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: `vid=${videoId}&k=${audioInfo.k}`
  });

  if (!convertResponse.ok) {
    return { success: false, error: 'Y2Mate convert failed' };
  }

  const convertData = await convertResponse.json();
  console.log('Y2Mate convert:', convertData);

  if (convertData.status !== 'ok' || !convertData.dlink) {
    return { success: false, error: 'Y2Mate: Conversion failed' };
  }

  return await downloadAudioFromUrl(convertData.dlink);
}

// SaveFrom approach
async function trySaveFrom(videoUrl) {
  console.log('Trying SaveFrom...');

  const response = await fetch(`https://api.savefrom.net/api/convert?url=${encodeURIComponent(videoUrl)}`);

  if (!response.ok) {
    return { success: false, error: 'SaveFrom failed' };
  }

  const data = await response.json();
  console.log('SaveFrom response:', data);

  // Find audio URL
  const audioUrl = data.url?.find(u => u.type === 'mp3' || u.ext === 'mp3')?.url;

  if (!audioUrl) {
    return { success: false, error: 'SaveFrom: No audio URL' };
  }

  return await downloadAudioFromUrl(audioUrl);
}

// Download audio from URL and convert to base64
async function downloadAudioFromUrl(audioUrl) {
  console.log('Downloading from:', audioUrl);

  const response = await fetch(audioUrl);
  if (!response.ok) {
    return { success: false, error: `Download failed: ${response.status}` };
  }

  const blob = await response.blob();
  console.log('Got blob, size:', blob.size);

  if (blob.size < 1000) {
    return { success: false, error: 'Downloaded file too small' };
  }

  const base64 = await blobToBase64(blob);

  return {
    success: true,
    audioData: base64,
    mimeType: blob.type || 'audio/mpeg'
  };
}

function blobToBase64(blob) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
