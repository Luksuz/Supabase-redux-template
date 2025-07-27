import dotenv from 'dotenv';
dotenv.config();

fetch('https://cloud.leonardo.ai/api/rest/v1/generations', {
  method: 'POST',
  headers: {
    'accept': 'application/json',
    'authorization': `Bearer ${process.env.LEONARDO_API_KEY}`,
    'content-type': 'application/json'
  },
  body: JSON.stringify({
    modelId: "de7d3faf-762f-48e0-b3b7-9d0ac3a3fcf3",
    contrast: 3.5,
    prompt: "an orange cat standing on a blue basketball with the text PAWS",
    num_images: 4,
    width: 1472,
    height: 832,
    alchemy: true,
    styleUUID: "111dc692-d470-4eec-b791-3475abac4c46",
    enhancePrompt: false
  })
})
  .then(response => response.json())
  .then(data => {
    console.log('Leonardo API response:', data);
  })
  .catch(error => {
    console.error('Error:', error);
  });