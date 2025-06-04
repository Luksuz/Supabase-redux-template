import dotenv from 'dotenv';
import fs from 'fs';

dotenv.config();

async function uploadDocument(filePath, targetLang = 'en') {
  // Read the file as a buffer
  const fileBuffer = fs.readFileSync(filePath);
  
  // Create a Blob from the buffer (for fetch API compatibility)
  const fileBlob = new Blob([fileBuffer], { type: 'text/plain' });
  
  const uploadFormData = new FormData();
  uploadFormData.append('target_lang', targetLang);
  uploadFormData.append('file', fileBlob, filePath);

  try {
    const uploadResponse = await fetch('https://api.deepl.com/v2/document', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        // Don't set Content-Type header - let FormData handle it automatically
      },
      body: uploadFormData
    });

    console.log('Response:', uploadResponse);
    if (!uploadResponse.ok) {
      const errorText = await uploadResponse.text();
      console.error('❌ DeepL upload failed:', errorText);
      throw new Error(`HTTP error! status: ${uploadResponse.status}`);
    }

    const responseData = await uploadResponse.json();
    console.log('Response Data:', responseData);
  } catch (error) {
    console.error('Error uploading document:', error);
  }
}

uploadDocument('test.txt');