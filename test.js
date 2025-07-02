import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";  

dotenv.config();

console.log(process.env.GOOGLE_API_KEY);

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY);
const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash-preview-05-20" });
const result = await model.generateContent([
  "find all mentions and appearances of messi and give me a timestamp for each. also tell me the end score of the game. after that, summaroize the key findings and details a bout the game. include some bullet points and final conclusion",
  {
    fileData: {
      fileUri: "https://www.youtube.com/watch?v=6kqaYeY4Sew",
    },
  },
]);
console.log(result.response.text());