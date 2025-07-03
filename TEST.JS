import dotenv from "dotenv";

dotenv.config();

const formData = new FormData();
formData.append('prompt', 'A photo of a cat');
formData.append('rendering_speed', 'TURBO');
// To add style reference images, uncomment the following lines
// formData.append('style_reference_images', '<style_reference_image_1>');
// formData.append('style_reference_images', '<style_reference_image_2>');
const response = await fetch('https://api.ideogram.ai/v1/ideogram-v3/generate', {
  method: 'POST',
  headers: { 'Api-Key': "03de20f7-30df-4a31-928a-b237da28c3c0:219b3278c2f5aa49ffe8661388d5cc25" },
  body: formData
});
const data = await response.json();
console.log(data);
