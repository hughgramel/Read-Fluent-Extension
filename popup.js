// DOM Elements
const downloadBtn = document.getElementById('downloadBtn');
const statusEl = document.getElementById('status');
const videoInfoEl = document.getElementById('videoInfo');
const videoTitleEl = document.getElementById('videoTitle');
const audioPlayer = document.getElementById('audioPlayer');
const audioEl = document.getElementById('audio');
const saveBtn = document.getElementById('saveBtn');
const clearBtn = document.getElementById('clearBtn');
const audioList = document.getElementById('audioList');

let currentAudioBlob = null;
let currentAudioUrl = null;
let currentVideoInfo = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSavedAudios();
  checkCurrentTab();
});

// Check if we're on a YouTube video page
async function checkCurrentTab() {
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url || !tab.url.includes('youtube.com/watch')) {
      setStatus('Navigate to a YouTube video', '');
      downloadBtn.disabled = true;
      return;
    }

    // Extract video ID from URL
    const url = new URL(tab.url);
    const videoId = url.searchParams.get('v');

    if (!videoId) {
      setStatus('Could not find video ID', 'error');
      downloadBtn.disabled = true;
      return;
    }

    // Get video title from the tab
    currentVideoInfo = {
      videoId: videoId,
      url: tab.url,
      title: tab.title.replace(' - YouTube', '').trim()
    };

    // Show video info
    videoTitleEl.textContent = currentVideoInfo.title;
    videoInfoEl.classList.remove('hidden');

    setStatus('Ready to download audio', 'success');
    downloadBtn.disabled = false;

  } catch (error) {
    console.error('Tab check error:', error);
    setStatus('Error checking tab', 'error');
  }
}

// Download button click
downloadBtn.addEventListener('click', async () => {
  if (!currentVideoInfo) {
    setStatus('No video detected', 'error');
    return;
  }

  try {
    downloadBtn.disabled = true;
    setStatus('Downloading audio...', 'loading');

    // Use cobalt.tools API to get audio
    const response = await fetch('https://api.cobalt.tools/api/json', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        url: currentVideoInfo.url,
        vCodec: 'h264',
        vQuality: '720',
        aFormat: 'mp3',
        isAudioOnly: true,
        disableMetadata: false
      })
    });

    const data = await response.json();

    if (data.status === 'error') {
      throw new Error(data.text || 'Failed to get audio URL');
    }

    if (data.status === 'redirect' || data.status === 'stream') {
      // Fetch the audio file
      const audioUrl = data.url;
      setStatus('Fetching audio file...', 'loading');

      const audioResponse = await fetch(audioUrl);
      if (!audioResponse.ok) {
        throw new Error('Failed to download audio file');
      }

      currentAudioBlob = await audioResponse.blob();

      // Create URL and set audio source
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
      currentAudioUrl = URL.createObjectURL(currentAudioBlob);
      audioEl.src = currentAudioUrl;

      // Show audio player
      audioPlayer.classList.remove('hidden');
      setStatus('Audio ready to play!', 'success');

    } else if (data.status === 'picker') {
      // Multiple formats available, use the first audio one
      const audioOption = data.picker.find(p => p.type === 'audio') || data.picker[0];
      if (audioOption && audioOption.url) {
        setStatus('Fetching audio file...', 'loading');
        const audioResponse = await fetch(audioOption.url);
        currentAudioBlob = await audioResponse.blob();

        if (currentAudioUrl) {
          URL.revokeObjectURL(currentAudioUrl);
        }
        currentAudioUrl = URL.createObjectURL(currentAudioBlob);
        audioEl.src = currentAudioUrl;

        audioPlayer.classList.remove('hidden');
        setStatus('Audio ready to play!', 'success');
      } else {
        throw new Error('No audio format available');
      }
    } else {
      throw new Error('Unexpected response from server');
    }

  } catch (error) {
    console.error('Download error:', error);
    setStatus('Error: ' + error.message, 'error');
  } finally {
    downloadBtn.disabled = false;
  }
});

// Save button click
saveBtn.addEventListener('click', () => {
  if (!currentAudioBlob || !currentVideoInfo) return;

  // Clean filename
  const cleanTitle = currentVideoInfo.title
    .replace(/[^a-zA-Z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .substring(0, 50);
  const filename = `${cleanTitle}.mp3`;

  // Trigger download
  const url = URL.createObjectURL(currentAudioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // Save to extension storage
  saveAudioToStorage(filename, currentAudioBlob);
});

// Clear button click
clearBtn.addEventListener('click', () => {
  if (currentAudioUrl) {
    URL.revokeObjectURL(currentAudioUrl);
  }
  currentAudioBlob = null;
  currentAudioUrl = null;
  audioEl.src = '';
  audioPlayer.classList.add('hidden');
  setStatus('Ready to download audio', 'success');
});

// Save audio to chrome storage
async function saveAudioToStorage(filename, blob) {
  try {
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];

      const result = await chrome.storage.local.get(['savedAudios']);
      const savedAudios = result.savedAudios || [];

      savedAudios.unshift({
        id: Date.now(),
        filename: filename,
        data: base64,
        type: blob.type,
        videoId: currentVideoInfo?.videoId,
        date: new Date().toISOString()
      });

      // Keep only last 5 recordings
      if (savedAudios.length > 5) {
        savedAudios.pop();
      }

      await chrome.storage.local.set({ savedAudios });
      loadSavedAudios();
    };
    reader.readAsDataURL(blob);
  } catch (error) {
    console.error('Save error:', error);
  }
}

// Load saved audios from storage
async function loadSavedAudios() {
  try {
    const result = await chrome.storage.local.get(['savedAudios']);
    const savedAudios = result.savedAudios || [];

    if (savedAudios.length === 0) {
      audioList.innerHTML = '<div class="empty-state">No saved audio yet</div>';
      return;
    }

    audioList.innerHTML = savedAudios.map(audio => `
      <div class="audio-item" data-id="${audio.id}">
        <div class="audio-item-info">
          <div class="audio-item-name">${audio.filename}</div>
          <div class="audio-item-date">${new Date(audio.date).toLocaleString()}</div>
        </div>
        <div class="audio-item-actions">
          <button class="btn btn-primary play-btn" data-id="${audio.id}">Play</button>
          <button class="btn btn-danger delete-btn" data-id="${audio.id}">X</button>
        </div>
      </div>
    `).join('');

    // Add event listeners
    audioList.querySelectorAll('.play-btn').forEach(btn => {
      btn.addEventListener('click', () => playSavedAudio(btn.dataset.id));
    });

    audioList.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', () => deleteSavedAudio(btn.dataset.id));
    });
  } catch (error) {
    console.error('Load error:', error);
  }
}

// Play a saved audio
async function playSavedAudio(id) {
  try {
    const result = await chrome.storage.local.get(['savedAudios']);
    const audio = (result.savedAudios || []).find(a => a.id === parseInt(id));

    if (audio) {
      const byteCharacters = atob(audio.data);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: audio.type || 'audio/mpeg' });

      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
      currentAudioUrl = URL.createObjectURL(blob);
      currentAudioBlob = blob;

      audioEl.src = currentAudioUrl;
      audioPlayer.classList.remove('hidden');
      audioEl.play();
    }
  } catch (error) {
    console.error('Play error:', error);
  }
}

// Delete a saved audio
async function deleteSavedAudio(id) {
  try {
    const result = await chrome.storage.local.get(['savedAudios']);
    const savedAudios = (result.savedAudios || []).filter(a => a.id !== parseInt(id));
    await chrome.storage.local.set({ savedAudios });
    loadSavedAudios();
  } catch (error) {
    console.error('Delete error:', error);
  }
}

// Helper function
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}
