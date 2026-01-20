"use client";

import { useEffect, useState } from "react";
import { FullscreenGallery } from "@/components/ui/fullscreen-gallery";
import { useSocket } from "@/context/SocketContext";

export default function GalleryPage() {
  const [images, setImages] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const { socket } = useSocket();

  // Fetch images from API
  const fetchImages = async () => {
    try {
      const response = await fetch("/api/gallery-images");
      const data = await response.json();
      setImages(data.images || []);
    } catch (error) {
      console.error("Failed to fetch gallery images:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchImages();
  }, []);

  // Listen for real-time gallery updates
  useEffect(() => {
    if (!socket) return;

    const handleGalleryUpdate = () => {
      fetchImages();
    };

    socket.on("gallery-update", handleGalleryUpdate);

    return () => {
      socket.off("gallery-update", handleGalleryUpdate);
    };
  }, [socket]);

  if (loading) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-white/60 text-lg">Loading gallery...</div>
      </div>
    );
  }

  if (images.length === 0) {
    return (
      <div className="h-screen w-screen bg-black flex items-center justify-center">
        <div className="text-white/60 text-lg">No images yet</div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      <FullscreenGallery
        images={images}
        direction="left"
        speed={35}
        rows={4}
        className="h-full w-full"
      />
    </div>
  );
}
