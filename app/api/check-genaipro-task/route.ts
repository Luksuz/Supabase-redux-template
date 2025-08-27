import { NextResponse } from "next/server";
import "dotenv/config";

// GenAI Pro configuration
const GENAIPRO_API_KEY = process.env.GENAIPRO_API_KEY;

export const runtime = 'nodejs';

export async function POST(request: Request) {
  try {
    const { taskId } = await request.json();

    console.log(`🔍 Checking GenAI Pro task status: ${taskId}`);

    if (!taskId) {
      return NextResponse.json({ 
        error: "Missing required field: taskId" 
      }, { status: 400 });
    }

    if (!GENAIPRO_API_KEY) {
      return NextResponse.json({ 
        error: "GenAI Pro API key not configured" 
      }, { status: 500 });
    }

    try {
      // Check task status using GenAI Pro API
      const statusResponse = await fetch(`https://genaipro.vn/api/elevenlabs/task/${taskId}`, {
        headers: {
          'Authorization': `Bearer ${GENAIPRO_API_KEY}`,
        }
      });
      
      if (!statusResponse.ok) {
        throw new Error(`GenAI Pro status check failed: ${statusResponse.status} ${statusResponse.statusText}`);
      }
      
      const statusData = await statusResponse.json();
      console.log(`📊 Task ${taskId} status: ${statusData.status}`);
      
      if (statusData.status === 'completed') {
        if (!statusData.result) {
          throw new Error('Task completed but no result URL provided');
        }
        
        console.log(`✅ GenAI Pro task ${taskId} completed, downloading audio from: ${statusData.result}`);
        
        // Download the audio file
        const audioResponse = await fetch(statusData.result);
        if (!audioResponse.ok) {
          throw new Error(`Failed to download audio: ${audioResponse.status} ${audioResponse.statusText}`);
        }
        
        const audioBuffer = await audioResponse.arrayBuffer();
        const base64Audio = Buffer.from(audioBuffer).toString('base64');
        const audioDataUrl = `data:audio/mp3;base64,${base64Audio}`;
        
        console.log(`✅ GenAI Pro audio downloaded successfully (${audioBuffer.byteLength} bytes)`);
        
        return NextResponse.json({
          success: true,
          status: 'completed',
          taskId: taskId,
          audioUrl: audioDataUrl,
          created_at: statusData.created_at,
          updated_at: statusData.updated_at
        });
        
      } else if (statusData.status === 'failed' || statusData.status === 'error') {
        console.error(`❌ GenAI Pro task ${taskId} failed with status: ${statusData.status}`);
        
        return NextResponse.json({
          success: false,
          status: statusData.status,
          taskId: taskId,
          error: `Task failed with status: ${statusData.status}`,
          created_at: statusData.created_at,
          updated_at: statusData.updated_at
        });
        
      } else {
        // Task is still pending or processing
        console.log(`⏳ GenAI Pro task ${taskId} still ${statusData.status}`);
        
        return NextResponse.json({
          success: true,
          status: statusData.status,
          taskId: taskId,
          created_at: statusData.created_at,
          updated_at: statusData.updated_at
        });
      }
      
    } catch (error: any) {
      console.error(`❌ Error checking GenAI Pro task ${taskId}:`, error);
      throw new Error(`Failed to check task status: ${error.message}`);
    }

  } catch (error: any) {
    console.error("❌ Error in GenAI Pro task status check:", error.message);
    return NextResponse.json(
      { error: `Failed to check task status: ${error.message}` },
      { status: 500 }
    );
  }
}





