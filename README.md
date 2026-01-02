# Read Fluent Extension

A Chrome extension that downloads audio from YouTube videos for language learning purposes.

## Features

- Download complete audio from any YouTube video
- Play downloaded audio directly in the extension popup
- Save audio to your device as MP3 files
- Store and manage multiple audio files (up to 5)

## Installation

1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" in the top right corner
3. Click "Load unpacked" and select this extension folder
4. The extension icon will appear in your Chrome toolbar

## Usage

1. Navigate to a YouTube video
2. Click the Read Fluent extension icon
3. Click "Download Audio" to fetch the complete audio
4. Use the built-in player to listen to the audio
5. Click "Save to Device" to download as MP3

## Permissions

- `activeTab`: Access the current tab URL
- `storage`: Save audio files locally

## Development

### Project Structure

```
read-fluent-extension/
├── manifest.json      # Chrome extension manifest
├── popup.html         # Extension popup UI
├── popup.css          # Popup styles
├── popup.js           # Popup logic with download functionality
├── background.js      # Service worker
└── icons/             # Extension icons
```

### Building

No build step required. The extension can be loaded directly in Chrome.

## Future Enhancements

- Integration with OpenAI API for transcription
- Support for other video platforms
- Transcript display and sync

## License

MIT
