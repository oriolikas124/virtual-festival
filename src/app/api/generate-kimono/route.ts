import { NextRequest, NextResponse } from 'next/server';
import OpenAI, { toFile } from 'openai';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export async function POST(request: NextRequest) {
  let tempFilePath = '';
  
  try {
    const { imageBase64, style } = await request.json();

    if (!imageBase64 || !style) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: imageBase64 and style' },
        { status: 400 }
      );
    }

    console.log('[KIMONO] Received request for style:', style);
    console.log('[KIMONO] API Key present:', !!process.env.OPENAI_API_KEY);
    console.log('[KIMONO] Base64 size:', (imageBase64.length / 1024).toFixed(2), 'KB');

    // Convert base64 to buffer
    const inputImageBuffer = Buffer.from(imageBase64, 'base64');
    console.log('[KIMONO] Image buffer size:', inputImageBuffer.length, 'bytes');

    // Create temporary directory
    const tempDir = path.join(process.cwd(), 'tmp');
    if (!fs.existsSync(tempDir)) {
      fs.mkdirSync(tempDir, { recursive: true });
      console.log('[KIMONO] Created temp directory:', tempDir);
    }
    
    // Save temp file
    tempFilePath = path.join(tempDir, `temp-image-${Date.now()}.png`);
    fs.writeFileSync(tempFilePath, inputImageBuffer);
    console.log('[KIMONO] Temp file created:', tempFilePath);

    // Style-specific prompts - optimized for efficiency (reduced tokens by ~50%)
    const stylePrompts: Record<string, string> = {
      'Anime': 'Person wearing vibrant Japanese festival kimono, anime-style patterns. Anime art style on kimono and background, preserve face exactly. Festival lanterns backdrop.',

      'Art': 'Person in elegant traditional Japanese kimono, intricate patterns. Ukiyo-e woodblock style on clothing and background, face unchanged. Serene cherry blossom scene.',

      'Cyber': 'Person in magical cyberpunk Japanese kimono, ethereal glowing patterns. Cyberpunk art style on outfit and surroundings, preserve face. Futuristic festival with neon lights.',

      'Ghibli': 'Person in beautiful Japanese festival kimono. Studio Ghibli watercolor style on clothing and background, preserve face. Nostalgic festival with paper lanterns.'
    };

    const prompt = stylePrompts[style] || stylePrompts['Anime'];
    console.log('[KIMONO] Using prompt for style:', style);

    // Convert file to FormData for multipart upload
    console.log('[KIMONO] Converting image to file for upload...');
    const imageFile = await toFile(
      fs.createReadStream(tempFilePath),
      'image.png',
      { type: 'image/png' }
    );

    // Call gpt-image-1 edit API
    console.log('[KIMONO] Calling gpt-image-1 edit API...');
    console.log('[KIMONO] Model: gpt-image-1');
    console.log('[KIMONO] Size: 1024x1536 (portrait format)');
    console.log('[KIMONO] Quality: standard');
    
    const editResponse = await openai.images.edit({
      model: 'gpt-image-1',
      image: imageFile,
      prompt: prompt,
      n: 1,
      size: '1024x1536',
      quality: 'medium'
    });

    console.log('[KIMONO] Edit API response received');
    console.log('[KIMONO] Response status: OK');

    let imageBuffer: Buffer | null = null;
    
    // Method 1: If URL is provided
    const generatedImageUrl = editResponse.data?.[0]?.url;

    // Method 2: If b64_json is present (for streaming or other response formats  )
    const b64Json = editResponse.data?.[0]?.b64_json;

    if (generatedImageUrl) {
      console.log('[KIMONO] Found URL in response, downloading...');
      console.log('[KIMONO] Generated image URL:', generatedImageUrl);

      // Download image from URL
      console.log('[KIMONO] Downloading image from URL...');
      const imageResponseFetch = await fetch(generatedImageUrl);
      
      if (!imageResponseFetch.ok) {
        console.error('[KIMONO] ERROR: Failed to fetch image:', imageResponseFetch.statusText);
        fs.unlinkSync(tempFilePath);
        return NextResponse.json(
          { success: false, error: `Failed to download image: ${imageResponseFetch.statusText}` },
          { status: 500 }
        );
      }
      
      const downloadedImageBuffer = await imageResponseFetch.arrayBuffer();
      console.log('[KIMONO] Image downloaded, size:', downloadedImageBuffer.byteLength, 'bytes');
      imageBuffer = Buffer.from(downloadedImageBuffer);
      
    } else if (b64Json) {
      console.log('[KIMONO] Found b64_json in response');
      imageBuffer = Buffer.from(b64Json, 'base64');
      console.log('[KIMONO] Decoded base64 image, size:', imageBuffer.length, 'bytes');
      
    } else {
      console.error('[KIMONO] ERROR: No URL or b64_json in response');
      console.error('[KIMONO] Full response:', JSON.stringify(editResponse, null, 2));
      fs.unlinkSync(tempFilePath);
      return NextResponse.json(
        { success: false, error: 'No image generated from gpt-image-1' },
        { status: 500 }
      );
    }

    // Save to public/images/zone_1/
    const timestamp = Date.now();
    const randomId = Math.random().toString(36).substring(2, 8);
    const filename = `kimono-${style.toLowerCase()}-${timestamp}-${randomId}.png`;
    const filepath = path.join(process.cwd(), 'public', 'images', 'zone_1', filename);
    
    console.log('[KIMONO] Saving image to:', filepath);
    
    // Ensure directory exists
    const dir = path.dirname(filepath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log('[KIMONO] Created directory:', dir);
    }
    
    // Save image file
    if (!imageBuffer) {
      console.error('[KIMONO] ERROR: No image buffer to save');
      fs.unlinkSync(tempFilePath);
      return NextResponse.json(
        { success: false, error: 'Failed to get image buffer' },
        { status: 500 }
      );
    }
    
    fs.writeFileSync(filepath, imageBuffer);
    console.log('[KIMONO] Image saved successfully');
    
    // Clean up temp file
    try {
      fs.unlinkSync(tempFilePath);
      console.log('[KIMONO] Temp file deleted');
    } catch (e) {
      console.error('[KIMONO] Error deleting temp file:', e);
    }
    
    // Return local URL path
    const imageUrl = `/images/zone_1/${filename}`;
    console.log('[KIMONO] Returning image URL:', imageUrl);

    return NextResponse.json({
      success: true,
      imageUrl: imageUrl,
      style: style,
      timestamp: timestamp
    });

  } catch (error: unknown) {
    console.error('[KIMONO] ERROR:', error);
    
    if (error instanceof Error) {
      console.error('[KIMONO] Error message:', error.message);
      console.error('[KIMONO] Error stack:', error.stack);
    }
    
    let errorMessage = 'Failed to generate image';
    let statusCode = 500;

    // Check if it's an OpenAI API error
    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      console.error('[KIMONO] Error object:', JSON.stringify(errorObj, null, 2));
      
      if (typeof errorObj.status === 'number') {
        statusCode = errorObj.status;
        console.error('[KIMONO] API Status:', errorObj.status);
      }
      
      const errorData = errorObj.error as Record<string, string> | undefined;
      if (errorData?.message) {
        errorMessage = errorData.message;
        console.error('[KIMONO] API Error Message:', errorData.message);
      }
      
      if (typeof errorObj.message === 'string') {
        errorMessage = errorObj.message;
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
    }

    // Clean up temp file if still exists
    try {
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
        console.log('[KIMONO] Temp file cleaned up after error');
      }
    } catch (e) {
      console.error('[KIMONO] Error deleting temp file after error:', e);
    }

    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage
      },
      { status: statusCode }
    );
  }
}
