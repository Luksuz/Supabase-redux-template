import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function POST(req: NextRequest) {
  console.log("Streaming upload request received");
  const token = await getToken({ req, secret: process.env.NEXTAUTH_SECRET });

  if (!token || !token.accessToken) {
    console.error("Upload failed: Not authenticated");
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const parentId = (formData.get('parentId') as string) || 'root';

    if (!file) {
      console.error("Upload failed: No file provided in form data");
      return NextResponse.json({ error: 'No file uploaded' }, { status: 400 });
    }

    console.log(`Starting streaming upload for '${file.name}' (${(file.size / 1024 / 1024).toFixed(2)} MB)`);

    // Create a readable stream for Server-Sent Events
    const stream = new ReadableStream({
      async start(controller) {
        const encoder = new TextEncoder();
        
        const sendProgress = (progress: number, message: string) => {
          const data = `data: ${JSON.stringify({ progress, message })}\n\n`;
          controller.enqueue(encoder.encode(data));
        };

        try {
          sendProgress(10, 'Preparing file for upload...');

          // Read file content
          const fileBuffer = Buffer.from(await file.arrayBuffer());
          
          sendProgress(20, 'Creating resumable upload session...');

          // Create resumable upload session
          const resumableResponse = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable', {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${token.accessToken}`,
              'Content-Type': 'application/json',
              'X-Upload-Content-Type': file.type,
              'X-Upload-Content-Length': file.size.toString(),
            },
            body: JSON.stringify({
              name: file.name,
              parents: [parentId],
            }),
          });

          if (!resumableResponse.ok) {
            throw new Error(`Failed to create resumable upload session: ${resumableResponse.status}`);
          }

          const uploadUrl = resumableResponse.headers.get('Location');
          if (!uploadUrl) {
            throw new Error('No upload URL received from Google Drive');
          }

          sendProgress(30, 'Upload session created, uploading file...');

          // Simulate progress during upload since Google Drive doesn't provide chunked progress
          const progressInterval = setInterval(() => {
            // This will be cleared when upload completes
          }, 100);

          let currentProgress = 30;
          const progressStep = (90 - 30) / 10; // Divide remaining progress into steps

          // Send periodic progress updates
          const updateProgress = () => {
            if (currentProgress < 85) {
              currentProgress += progressStep;
              sendProgress(Math.round(currentProgress), `Uploading to Google Drive... ${Math.round(currentProgress)}%`);
            }
          };

          // Start progress updates
          const progressTimer = setInterval(updateProgress, 500);

          try {
            // Upload the file content in one go (Google Drive handles the actual chunking internally)
            const uploadResponse = await fetch(uploadUrl, {
              method: 'PUT',
              headers: {
                'Content-Type': file.type,
                'Content-Length': file.size.toString(),
              },
              body: fileBuffer,
            });

            // Clear progress timer
            clearInterval(progressTimer);
            clearInterval(progressInterval);

            if (!uploadResponse.ok) {
              throw new Error(`Upload failed: ${uploadResponse.status} ${uploadResponse.statusText}`);
            }

            sendProgress(95, 'Upload completed, processing...');

            const result = await uploadResponse.json();
            console.log(`Upload successful: ID=${result.id}, Name=${result.name}`);
            
            sendProgress(100, 'Upload completed successfully!');
            
            const finalData = `data: ${JSON.stringify({ 
              success: true, 
              fileId: result.id, 
              fileName: result.name,
              fileLink: `https://drive.google.com/file/d/${result.id}/view?usp=drivesdk`,
              progress: 100 
            })}\n\n`;
            controller.enqueue(encoder.encode(finalData));

          } catch (uploadError) {
            clearInterval(progressTimer);
            clearInterval(progressInterval);
            throw uploadError;
          }
          
        } catch (error: any) {
          console.error('Streaming upload error:', error);
          const errorData = `data: ${JSON.stringify({ 
            error: error.message, 
            progress: 0 
          })}\n\n`;
          controller.enqueue(encoder.encode(errorData));
        } finally {
          controller.close();
        }
      }
    });

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
      },
    });

  } catch (error: any) {
    console.error('Error setting up streaming upload:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
} 