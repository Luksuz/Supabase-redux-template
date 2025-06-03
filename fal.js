import { fal } from "@fal-ai/client";
import dotenv from "dotenv";

dotenv.config();

fal.config({
    credentials: process.env.FAL_API_KEY,
  });

const result = await fal.subscribe("fal-ai/stable-diffusion-v35-large", {
  input: { prompt: "A crusade of knights riding on horses" },
});

console.log(JSON.stringify(result, null, 2));