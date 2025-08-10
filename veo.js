const { GoogleGenAI } = require("@google/genai");

async function generateVeoVideo() {
  const ai = new GoogleGenAI({
    apiKey: "AIzaSyDDYr_h9rxVvuzoL1_xhhnTM0wkh8glQAo"
  });

  // Extremely detailed, specific prompt for high-quality video generation
  const prompt = `Cinematic close-up shot, two people, a 32-year-old Caucasian male with short brown hair, stubble, wearing a dark green explorer's jacket, and a 29-year-old Asian female with long black hair in a ponytail, wearing a tan field shirt and cargo pants. Both are standing in a dimly lit, ancient stone chamber. The man and woman are intently studying a large, cryptic drawing etched into a mossy stone wall. The only light source is a flickering torch held by the man, casting dramatic, moving shadows across their faces and the wall. The man murmurs with a sense of awe, "This must be it. That's the secret code." The woman leans in, eyes wide, whispering excitedly, "What did you find?" The environment is filled with dust motes in the air, ancient symbols, and mysterious atmosphere. Camera angle is over-the-shoulder from behind the man, focusing on both faces and the wall. Lighting is warm and low, with strong torchlight contrast. Subtle camera movement, slight handheld shake for realism.`;

  let operation = await ai.models.generateVideos({
    model: "veo-3.0-generate-preview",
    prompt: prompt,
  });

  // Poll the operation status until the video is ready.
  while (!operation.done) {
    console.log("Waiting for video generation to complete...");
    await new Promise((resolve) => setTimeout(resolve, 10000));
    operation = await ai.operations.getVideosOperation({
      operation: operation,
    });
  }

  // Download the generated video.
  await ai.files.download({
    file: operation.response.generatedVideos[0].video,
    downloadPath: "dialogue_example.mp4",
  });
  console.log("Generated video saved to dialogue_example.mp4");
}

generateVeoVideo();