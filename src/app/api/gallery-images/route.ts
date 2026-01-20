import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

export async function GET() {
  try {
    const imagesDir = path.join(process.cwd(), "public/images/zone_1");
    
    // Check if directory exists
    if (!fs.existsSync(imagesDir)) {
      return NextResponse.json({ images: [] });
    }

    // Read all files in the directory
    const files = fs.readdirSync(imagesDir);
    
    // Filter only image files (jpg, jpeg, png, webp, gif)
    const imageExtensions = [".jpg", ".jpeg", ".png", ".webp", ".gif"];
    
    // Helper function to extract timestamp from filename
    // Format: kimono-anime-1764901384449-germfm.png -> 1764901384449
    const getTimestamp = (filename: string): number => {
      const parts = filename.split("-");
      // Timestamp is at index 2 (third part)
      if (parts.length >= 3) {
        const timestamp = parseInt(parts[2], 10);
        if (!isNaN(timestamp)) {
          return timestamp;
        }
      }
      return 0;
    };

    const images = files
      .filter((file) => {
        const ext = path.extname(file).toLowerCase();
        return imageExtensions.includes(ext);
      })
      .sort((a, b) => {
        // Sort by timestamp in filename (newest first - descending order)
        return getTimestamp(b) - getTimestamp(a);
      })
      .map((file) => `/images/zone_1/${file}`);

    return NextResponse.json({ images });
  } catch (error) {
    console.error("Error reading gallery images:", error);
    return NextResponse.json({ images: [] }, { status: 500 });
  }
}
