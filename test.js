import fs from "fs";
import OpenAI from "openai";
import dotenv from "dotenv";
dotenv.config();

const openai = new OpenAI();

const transcription = await openai.audio.transcriptions.create({
  file: fs.createReadStream("/Users/lukamindek/Downloads/1.1.1.mp3"),
  model: "whisper-1",
  format: "srt",
});

console.log(transcription.text);