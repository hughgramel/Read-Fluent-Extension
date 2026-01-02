# Read Fluent Extension

A Chrome extension that captures audio from YouTube videos for language learning purposes.

## Features

- Capture audio from YouTube videos using tab capture
- Play captured audio directly in the extension popup
- Download captured audio as WebM files
- Save and manage multiple recordings (up to 5)

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this extension folder
4. The extension icon will appear in your Chrome toolbar

## Usage

1. Navigate to a YouTube video
2. Click the Read Fluent extension icon
3. Click "Capture Audio" to start recording
4. The video audio will be captured in real-time
5. Click "Stop Recording" when done
6. Use the built-in player to listen to the captured audio
7. Download the audio or save it for later

## Permissions

- `activeTab`: Access the current tab for capturing audio
- `tabCapture`: Capture audio from browser tabs
- `storage`: Save captured audio recordings locally
- `scripting`: Inject content scripts on YouTube pages

## Development

### Project Structure

```
read-fluent-extension/
├── manifest.json      # Chrome extension manifest
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic
├── background.js      # Service worker for audio capture
├── content.js         # Content script for YouTube pages
└── icons/             # Extension icons
```

### Building

No build step required. The extension can be loaded directly in Chrome.

## Future Enhancements

- Integration with OpenAI API for transcription
- Support for other video platforms
- Audio trimming and editing
- Transcript display and sync

## License

MIT
