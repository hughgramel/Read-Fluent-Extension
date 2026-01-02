// Background service worker for audio capture

let mediaRecorder = null;
let audioChunks = [];
let captureStream = null;
let isRecording = false;

// Listen for messages from popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'startCapture') {
    startCapture(request.tabId)
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true; // Keep channel open for async response
  }

  if (request.action === 'stopCapture') {
    stopCapture()
      .then(result => sendResponse(result))
      .catch(error => sendResponse({ success: false, error: error.message }));
    return true;
  }

  if (request.action === 'getStatus') {
    sendResponse({ isRecording });
    return false;
  }
});

async function startCapture(tabId) {
  try {
    if (isRecording) {
      return { success: false, error: 'Already recording' };
    }

    // Use tabCapture to get audio from the tab
    captureStream = await chrome.tabCapture.capture({
      audio: true,
      video: false
    });

    if (!captureStream) {
      return { success: false, error: 'Failed to capture tab audio' };
    }

    // Set up media recorder
    audioChunks = [];
    mediaRecorder = new MediaRecorder(captureStream, {
      mimeType: 'audio/webm;codecs=opus'
    });

    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };

    mediaRecorder.start(1000); // Collect data every second
    isRecording = true;

    console.log('Recording started');
    return { success: true };
  } catch (error) {
    console.error('Start capture error:', error);
    return { success: false, error: error.message };
  }
}

async function stopCapture() {
  try {
    if (!isRecording || !mediaRecorder) {
      return { success: false, error: 'Not recording' };
    }

    return new Promise((resolve) => {
      mediaRecorder.onstop = async () => {
        // Stop all tracks
        if (captureStream) {
          captureStream.getTracks().forEach(track => track.stop());
          captureStream = null;
        }

        // Combine audio chunks into a single blob
        const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
        audioChunks = [];

        // Convert blob to base64 for sending to popup
        const reader = new FileReader();
        reader.onload = () => {
          const base64 = reader.result.split(',')[1];
          isRecording = false;
          mediaRecorder = null;
          console.log('Recording stopped, audio size:', audioBlob.size);
          resolve({ success: true, audioData: base64 });
        };
        reader.onerror = () => {
          isRecording = false;
          mediaRecorder = null;
          resolve({ success: false, error: 'Failed to process audio' });
        };
        reader.readAsDataURL(audioBlob);
      };

      mediaRecorder.stop();
    });
  } catch (error) {
    console.error('Stop capture error:', error);
    isRecording = false;
    return { success: false, error: error.message };
  }
}

// Clean up on service worker termination
self.addEventListener('beforeunload', () => {
  if (captureStream) {
    captureStream.getTracks().forEach(track => track.stop());
  }
});
