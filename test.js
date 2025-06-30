
import { SpeechifyClient } from "@speechify/api";

import dotenv from 'dotenv';
dotenv.config();

const SPEECHIFY_API_KEY = process.env.SPEECHIFY_API_KEY;
console.log(SPEECHIFY_API_KEY);


const speechClient = new SpeechifyClient({ token: SPEECHIFY_API_KEY });
const voices = await speechClient.tts.voices.list();
console.log(voices);



// Expected voices response format:
// [
//   {
//     "display_name": "display_name",
//     "gender": "male",
//     "locale": "locale",
//     "id": "id",
//     "models": [
//       {
//         "languages": [
//           {
//             "locale": "locale"
//           }
//         ],
//         "name": "simba-base"
//       }
//     ],
//     "type": "shared",
//     "avatar_image": "avatar_image",
//     "preview_audio": "preview_audio",
//     "tags": [
//       "tags"
//     ]
//   }
// ]