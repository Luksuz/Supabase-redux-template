// This script lists YouTube channels using only an API key and standard JavaScript (no Node.js).
// To use, include this file in an HTML page that also loads the GAPI script:
// <script src="https://apis.google.com/js/api.js"></script>
// Then call loadClient() to initialize and execute() to fetch channel info.

// Replace 'YOUR_API_KEY' with your actual API key.
const API_KEY = 'AIzaSyBZxCR32V4JAWYUF0dZmh1lNAPqlW1e-Ew';

// Loads the GAPI client and YouTube Data API v3 discovery document.
function loadClient() {
  if (typeof gapi === 'undefined') {
    console.error('GAPI script not loaded. Please include https://apis.google.com/js/api.js in your HTML.');
    return;
  }
  gapi.load('client', () => {
    gapi.client.setApiKey(API_KEY);
    gapi.client.load('https://www.googleapis.com/discovery/v1/apis/youtube/v3/rest')
      .then(() => {
        console.log('GAPI client loaded for API');
        // Optionally, you can call execute() here or from a button.
      }, (err) => {
        console.error('Error loading GAPI client for API', err);
      });
  });
}

// Lists YouTube channels by channel ID.
function execute() {
  if (typeof gapi === 'undefined' || !gapi.client || !gapi.client.youtube) {
    console.error('GAPI client not loaded. Call loadClient() first.');
    return;
  }
  gapi.client.youtube.channels.list({
    part: 'snippet,contentDetails,statistics',
    id: 'UC_x5XG1OV2P6uZZ5FSM9Ttw' // Example channel ID
  })
  .then((response) => {
    // Handle the results here (response.result has the parsed body).
    console.log('Response', response.result);
  }, (err) => {
    console.error('Execute error', err);
  });
}


