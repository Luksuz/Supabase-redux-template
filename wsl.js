import fs from "fs";
import fetch from "node-fetch";
import AbortController from "abort-controller";

async function ttsRequestHandler(text, speakerId, model) {
  const ttsAbortController = new AbortController();
  const ttsEndPoint = "https://api.wellsaidlabs.com/v1/tts/stream";
  let ttsResponse;
  try {
    ttsResponse = await fetch(ttsEndPoint, {
      signal: ttsAbortController.signal,
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "X-Api-Key": "4f74b2f4-80bf-405e-b4b2-f480bf505e85"
      },
      body: JSON.stringify({
        speaker_id: speakerId,
        text,
        model
      })
    });
  } catch (error) {
    throw new Error("Service is currently unavailable");
  }

  if (!ttsResponse.ok) {
    let errorMessage = "Failed to render";
    try {
      const { message } = await ttsResponse.json();
      errorMessage = message;
    } catch (error) {}
    throw new Error(errorMessage);
  }

  const storageWriteStream = fs.createWriteStream("audio.mp3");
  ttsResponse.body.pipe(storageWriteStream);

  try {
    await new Promise((resolve, reject) => {
      storageWriteStream.on("finish", resolve);
      storageWriteStream.on("error", reject);
    });
  } catch (error) {
    ttsAbortController.abort();
    throw error;
  }
}

// Example usage
ttsRequestHandler("what a nice day today", 3, "caruso")
  .then(() => console.log("Audio file saved successfully"))
  .catch(error => console.error("Error:", error.message));