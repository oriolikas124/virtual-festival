import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI } from '@google/genai';
import fs from 'fs';
import path from 'path';
import { Buffer } from 'buffer';

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
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
    console.log('[KIMONO] API Key present:', !!process.env.GEMINI_API_KEY);
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

    // Style-specific prompts
    const stylePrompts: Record<string, string> = {
      'Anime': 'Person wearing vibrant Japanese festival kimono, anime-style patterns. Anime art style on kimono and background, preserve facial features. Festival lanterns backdrop.',

      'Art': 'Person in elegant traditional Japanese kimono, intricate patterns. Ukiyo-e woodblock style on clothing and background, preserve facial features. Serene cherry blossom scene.',

      'Cyber': 'Person wearing Japanese kimono, cyberpunk-style patterns with neon circuits. Cyberpunk style on kimono and background, futuristic glowing hair, preserve facial features. Futuristic neon lights backdrop.',

      'Ghibli': 'Person in beautiful Japanese festival kimono. Studio Ghibli watercolor style on clothing and background, preserve facial features. Nostalgic festival with paper lanterns.'
    };

    const prompt = stylePrompts[style] || stylePrompts['Anime'];
    console.log('[KIMONO] Using prompt for style:', style);

    // Call Gemini API with image
    console.log('[KIMONO] Calling Gemini API...');
    console.log('[KIMONO] Model: gemini-3-pro-image-preview');

    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: [
        {
          text: prompt
        },
        {
          inlineData: {
            mimeType: 'image/png',
            data: imageBase64,
          },
        },
      ],
      config: {
        imageConfig: {
          aspectRatio: "3:4",
          imageSize: "1K",
        }
      }
    });

    console.log('[KIMONO] Gemini API response received');

    let imageBuffer: Buffer | null = null;
    const generatedImageUrl = '';

    // Extract generated image from response
    if (response.candidates && response.candidates[0]) {
      const parts = response.candidates[0].content.parts;

      for (const part of parts) {
        if (part.inlineData) {
          console.log('[KIMONO] Found inline image data in response');
          const imageData = part.inlineData.data;
          imageBuffer = Buffer.from(imageData, 'base64');
          console.log('[KIMONO] Decoded image, size:', imageBuffer.length, 'bytes');
          break;
        }
      }
    }

    if (!imageBuffer) {
      console.error('[KIMONO] ERROR: No image generated from Gemini');
      console.error('[KIMONO] Full response:', JSON.stringify(response, null, 2));
      if (tempFilePath && fs.existsSync(tempFilePath)) {
        fs.unlinkSync(tempFilePath);
      }
      return NextResponse.json(
        { success: false, error: 'No image generated from Gemini API' },
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

    if (error && typeof error === 'object') {
      const errorObj = error as Record<string, unknown>;
      console.error('[KIMONO] Error object:', JSON.stringify(errorObj, null, 2));

      if (typeof errorObj.status === 'number') {
        statusCode = errorObj.status;
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