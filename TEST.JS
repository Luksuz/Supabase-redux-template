import Replicate from "replicate";
import dotenv from "dotenv";
import { writeFile, readFile } from "fs/promises";
dotenv.config();

const data = (await readFile("./audi.jpeg")).toString("base64");
const image = `data:application/octet-stream;base64,${data}`;

const input = {
  prompt: "a woman sits in the car and drives off",
  image: image,
  duration: 10
};

const replicate = new Replicate();


const output = await replicate.run("bytedance/seedance-1-lite", { input });

// To access the file URL:
console.log(output.url());
//=> "https://replicate.delivery/.../output.mp4"

// To write the file to disk:
await writeFile("output.mp4", output);
//=> output.mp4 written to disk