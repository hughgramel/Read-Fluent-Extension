// Content script for YouTube pages
// This runs on YouTube pages and can interact with the video element

(function() {
  'use strict';

  // Listen for messages from popup or background
  chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'getVideoInfo') {
      const videoInfo = getVideoInfo();
      sendResponse(videoInfo);
      return false;
    }

    if (request.action === 'isVideoPlaying') {
      const video = document.querySelector('video');
      sendResponse({
        isPlaying: video ? !video.paused : false,
        hasVideo: !!video
      });
      return false;
    }
  });

  function getVideoInfo() {
    const video = document.querySelector('video');
    const titleElement = document.querySelector('h1.ytd-video-primary-info-renderer, h1.ytd-watch-metadata');

    return {
      hasVideo: !!video,
      title: titleElement ? titleElement.textContent.trim() : document.title,
      duration: video ? video.duration : 0,
      currentTime: video ? video.currentTime : 0,
      url: window.location.href
    };
  }

  // Notify that content script is loaded
  console.log('Read Fluent Extension: Content script loaded on YouTube');
})();
