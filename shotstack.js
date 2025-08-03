import dotenv from "dotenv";  

dotenv.config();

const SHOTSTACK_API_KEY="bYB2hD8pUENEYuo6C9nPMajjxLVd0t6sei4kaZfL"
const SHOTSTACK_ENDPOINT="https://api.shotstack.io/stage"

const timeline = {
    "timeline": {
      "tracks": [
        {
          "clips": [
            {
              "asset": {
                "type": "video",
                "src": "https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/drive-download-20250803T085638Z-1-001/Fire%20Particles%20Overlay.mov",
              },
              "start": 0,
              "length": 1.558186,
              "fit": "cover",
              "opacity": 0.2
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "image",
                "src": "https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/gen-1754214066555-2svja3x7q-chunk-1-1754214078501.jpg"
              },
              "start": 0,
              "length": 0.779093,
              "fit": "cover"
            },
            {
              "asset": {
                "type": "image",
                "src": "https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/gen-1754214071272-978k51um1-chunk-1-1754214078496.jpg"
              },
              "start": 0.779093,
              "length": 0.779093,
              "fit": "cover"
            }
          ]
        },
        {
          "clips": [
            {
              "asset": {
                "type": "audio",
                "src": "https://wbbhdqthxqdzzdandrfy.supabase.co/storage/v1/object/public/audio/voiceover/joined/original-1754214098129.wav",
                "volume": 1
              },
              "start": 0,
              "length": 1.558186
            }
          ]
        }
      ]
    },
    "output": {
      "format": "mp4",
      "size": {
        "width": 1280,
        "height": 720
      }
    }
  }

const renderResponse = await fetch(`${SHOTSTACK_ENDPOINT}/render`, {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'x-api-key': SHOTSTACK_API_KEY
    },
    body: JSON.stringify(timeline)
});

const renderData = await renderResponse.json();
console.log(renderData);

if (renderData.response && renderData.response.id) {
    const shotstackId = renderData.response.id;
    let currentStatus = renderData.response.status || null;
    let pollCount = 0;
    const maxPolls = 60; // up to 60 tries (3 minutes)
    const pollDelay = 3000; // 3 seconds

    while (currentStatus !== "done" && currentStatus !== "processed" && pollCount < maxPolls) {
        await new Promise(res => setTimeout(res, pollDelay));
        const pollResponse = await fetch(`${SHOTSTACK_ENDPOINT}/render/${shotstackId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SHOTSTACK_API_KEY
            }
        });
        const pollData = await pollResponse.json();
        currentStatus = pollData.response && pollData.response.status ? pollData.response.status : null;
        console.log(`Polling status: ${currentStatus}`);
        pollCount++;
    }

    if (currentStatus === "done" || currentStatus === "processed") {
        // Fetch the final response and show it
        const finalResponse = await fetch(`${SHOTSTACK_ENDPOINT}/render/${shotstackId}`, {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-api-key': SHOTSTACK_API_KEY
            }
        });
        const finalData = await finalResponse.json();
        console.log('Render completed:', finalData);
    } else {
        console.log('Polling stopped before completion. Last status:', currentStatus);
    }
} else {
    console.log('No render id returned from Shotstack.');
}