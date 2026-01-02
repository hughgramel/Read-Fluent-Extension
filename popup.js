// DOM Elements
const captureBtn = document.getElementById('captureBtn');
const stopBtn = document.getElementById('stopBtn');
const statusEl = document.getElementById('status');
const audioPlayer = document.getElementById('audioPlayer');
const audioEl = document.getElementById('audio');
const downloadBtn = document.getElementById('downloadBtn');
const clearBtn = document.getElementById('clearBtn');
const audioList = document.getElementById('audioList');

let currentAudioBlob = null;
let currentAudioUrl = null;
let mediaRecorder = null;
let audioChunks = [];
let captureStream = null;

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadSavedAudios();
});

// Capture button click - tabCapture must be called from popup with user gesture
captureBtn.addEventListener('click', async () => {
  try {
    setStatus('Starting capture...', '');

    // Get current tab
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

    if (!tab.url.includes('youtube.com')) {
      setStatus('Please navigate to a YouTube video first', 'error');
      return;
    }

    // Use tabCapture directly in popup (requires user gesture)
    captureStream = await new Promise((resolve, reject) => {
      chrome.tabCapture.capture(
        { audio: true, video: false },
        (stream) => {
          if (chrome.runtime.lastError) {
            reject(new Error(chrome.runtime.lastError.message));
          } else if (!stream) {
            reject(new Error('Failed to capture tab audio'));
          } else {
            resolve(stream);
          }
        }
      );
    });

    // Set up media recorder
    audioChunks = [];

    // Try different mime types for compatibility
    const mimeTypes = [
      'audio/webm;codecs=opus',
      'audio/webm',
      'audio/ogg;codecs=opus',
      'audio/mp4'
    ];

    let selectedMimeType = '';
    for (const mimeType of mimeTypes) {
      if (MediaRecorder.isTypeSupported(mimeType)) {
        selectedMimeType = mimeType;
        break;
      }
    }

    mediaRecorder = new MediaRecorder(captureStream, {
      mimeType: selectedMimeType || undefined
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(1000); // Collect data every second
    setRecordingState(true);
    setStatus('Recording... Click Stop when done', 'recording');

    console.log('Recording started with mime type:', selectedMimeType);
  } catch (error) {
    console.error('Capture error:', error);
    setStatus('Error: ' + error.message, 'error');
  }
});

// Stop button click
stopBtn.addEventListener('click', async () => {
  try {
    if (!mediaRecorder) {
      setStatus('Not recording', 'error');
      return;
    }

    setStatus('Stopping capture...', '');

    mediaRecorder.onstop = () => {
      // Stop all tracks
      if (captureStream) {
        captureStream.getTracks().forEach(track => track.stop());
        captureStream = null;
      }

      // Combine audio chunks into a single blob
      const mimeType = mediaRecorder.mimeType || 'audio/webm';
      currentAudioBlob = new Blob(audioChunks, { type: mimeType });
      audioChunks = [];

      // Create URL and set audio source
      if (currentAudioUrl) {
        URL.revokeObjectURL(currentAudioUrl);
      }
      currentAudioUrl = URL.createObjectURL(currentAudioBlob);
      audioEl.src = currentAudioUrl;

      // Show audio player
      audioPlayer.classList.remove('hidden');
      setStatus('Audio captured successfully!', 'success');
      setRecordingState(false);
      mediaRecorder = null;

      console.log('Recording stopped, audio size:', currentAudioBlob.size);
    };

    mediaRecorder.stop();
  } catch (error) {
    console.error('Stop error:', error);
    setStatus('Error: ' + error.message, 'error');
    setRecordingState(false);
  }
});

// Download button click
downloadBtn.addEventListener('click', () => {
  if (!currentAudioBlob) return;

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const extension = currentAudioBlob.type.includes('webm') ? 'webm' :
                    currentAudioBlob.type.includes('ogg') ? 'ogg' : 'mp4';
  const filename = `youtube-audio-${timestamp}.${extension}`;

  const url = URL.createObjectURL(currentAudioBlob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);

  // Save to storage
  saveAudio(filename, currentAudioBlob);
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
  setStatus('Ready to capture audio', '');
});

// Save audio to chrome storage
async function saveAudio(filename, blob) {
  try {
    // Convert blob to base64
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = reader.result.split(',')[1];

      // Get existing audios
      const result = await chrome.storage.local.get(['savedAudios']);
      const savedAudios = result.savedAudios || [];

      // Add new audio (keep only last 5 to save space)
      savedAudios.unshift({
        id: Date.now(),
        filename: filename,
        data: base64,
        type: blob.type,
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
      audioList.innerHTML = '<div class="empty-state">No saved recordings yet</div>';
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
          <button class="btn btn-danger delete-btn" data-id="${audio.id}">Delete</button>
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
      const blob = new Blob([byteArray], { type: audio.type || 'audio/webm' });

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

// Helper functions
function setStatus(message, type) {
  statusEl.textContent = message;
  statusEl.className = 'status' + (type ? ' ' + type : '');
}

function setRecordingState(isRecording) {
  captureBtn.disabled = isRecording;
  stopBtn.disabled = !isRecording;
}
