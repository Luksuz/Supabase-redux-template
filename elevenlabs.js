import { fal } from "@fal-ai/client";

const result = await fal.subscribe("fal-ai/veo3", {
  input: {
    prompt: "A person recording a selfie in new york, VHS aesthetics, other faces are blurred, glitch effects",
    image_url: "https://nzyjcdflnedryynxzaqy.supabase.co/storage/v1/object/public/hair-dataset/o_9404481_1280.jpg"
  },
  logs: true,
  onQueueUpdate: (update) => {
    if (update.status === "IN_PROGRESS") {
      update.logs.map((log) => log.message).forEach(console.log);
    }
  },
});
console.log(result.data);
console.log(result.requestId);