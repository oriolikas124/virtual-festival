"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Gap between images
const GAP = 30;
const ROW_GAP = 24;
const VERTICAL_PADDING = 16; // Padding from top and bottom edges
const BUFFER_ITEMS = 3;

export const InfiniteGallery = ({
  images,
  direction = "left",
  speed = 50,
  className,
}: {
  images: string[];
  direction?: "left" | "right";
  speed?: number;
  pauseOnHover?: boolean;
  stagger?: boolean;
  staggerAmount?: number;
  className?: string;
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const animationRef = useRef<number | null>(null);
  const positionRef = useRef(0);
  const lastTimeRef = useRef<number | null>(null);
  const isPausedRef = useRef(false);
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 20 });
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [itemWidth, setItemWidth] = useState(150);

  // Images are already sorted by API (newest first), use directly
  const sortedImages = images;

  // Split images into two rows
  const row1Images = React.useMemo(
    () => sortedImages.filter((_, i) => i % 2 === 0),
    [sortedImages]
  );
  const row2Images = React.useMemo(
    () => sortedImages.filter((_, i) => i % 2 === 1),
    [sortedImages]
  );

  // Calculate item width based on container height (responsive)
  useEffect(() => {
    const updateItemWidth = () => {
      if (!containerRef.current) return;
      const containerHeight = containerRef.current.offsetHeight;
      // Each row takes ~50% of height minus gaps and vertical padding
      const availableHeight = containerHeight - ROW_GAP - VERTICAL_PADDING * 2;
      const rowHeight = availableHeight / 2;
      // Image width from height with 3:4 aspect ratio
      const calculatedWidth = rowHeight * (3 / 4);
      setItemWidth(Math.floor(calculatedWidth));
    };

    updateItemWidth();
    window.addEventListener("resize", updateItemWidth);
    return () => window.removeEventListener("resize", updateItemWidth);
  }, []);

  // Calculate item width for positioning
  const avgItemWidth = itemWidth + GAP;

  // Calculate how many items fit in viewport + buffer
  const calculateVisibleRange = useCallback(
    (scrollPosition: number, containerWidth: number, imageCount: number) => {
      if (imageCount === 0) return { start: 0, end: 10 };

      const totalWidth = imageCount * avgItemWidth;
      const normalizedPos =
        ((scrollPosition % totalWidth) + totalWidth) % totalWidth;
      const startIdx = Math.floor(normalizedPos / avgItemWidth) - BUFFER_ITEMS;
      const visibleCount =
        Math.ceil(containerWidth / avgItemWidth) + BUFFER_ITEMS * 2;
      const endIdx = startIdx + visibleCount;

      return { start: startIdx, end: endIdx };
    },
    [avgItemWidth]
  );

  // Get items to render for a specific row
  const getVisibleItems = useCallback(
    (rowLength: number) => {
      if (rowLength === 0) return [];

      const items: {
        imageIndex: number;
        virtualIndex: number;
      }[] = [];

      for (let i = visibleRange.start; i <= visibleRange.end; i++) {
        const originalIndex = ((i % rowLength) + rowLength) % rowLength;
        items.push({
          imageIndex: originalIndex,
          virtualIndex: i,
        });
      }

      return items;
    },
    [visibleRange]
  );

  // Handle image click
  const handleImageClick = useCallback((imageSrc: string) => {
    setSelectedImage(imageSrc);
    isPausedRef.current = true;
  }, []);

  // Handle lightbox close
  const handleCloseLightbox = useCallback(() => {
    setSelectedImage(null);
    // Resume scrolling after 250ms delay
    setTimeout(() => {
      isPausedRef.current = false;
      lastTimeRef.current = null;
    }, 250);
  }, []);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    if (!containerRef.current || row1Images.length === 0) return;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const totalWidth = row1Images.length * avgItemWidth;

    const animate = (currentTime: number) => {
      if (isPausedRef.current) {
        lastTimeRef.current = null;
        animationRef.current = requestAnimationFrame(animate);
        return;
      }

      if (lastTimeRef.current === null) {
        lastTimeRef.current = currentTime;
      }

      const deltaTime = (currentTime - lastTimeRef.current) / 1000;
      lastTimeRef.current = currentTime;

      const movement = speed * deltaTime;
      if (direction === "left") {
        positionRef.current += movement;
      } else {
        positionRef.current -= movement;
      }

      if (positionRef.current > totalWidth) {
        positionRef.current -= totalWidth;
      } else if (positionRef.current < 0) {
        positionRef.current += totalWidth;
      }

      const newRange = calculateVisibleRange(
        positionRef.current,
        containerWidth,
        row1Images.length
      );
      setVisibleRange((prev) => {
        if (prev.start !== newRange.start || prev.end !== newRange.end) {
          return newRange;
        }
        return prev;
      });

      if (scrollerRef.current) {
        const offset = -(positionRef.current % totalWidth);
        scrollerRef.current.style.transform = `translateX(${offset}px)`;
      }

      animationRef.current = requestAnimationFrame(animate);
    };

    animationRef.current = requestAnimationFrame(animate);

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
      lastTimeRef.current = null;
    };
  }, [
    row1Images.length,
    speed,
    direction,
    calculateVisibleRange,
    avgItemWidth,
  ]);

  const row1Items = getVisibleItems(row1Images.length);
  const row2Items = getVisibleItems(row2Images.length);

  // Calculate row height
  const rowHeight = itemWidth * (4 / 3);

  // Render a single row
  const renderRow = (
    items: ReturnType<typeof getVisibleItems>,
    rowImages: string[],
    rowKey: string,
    topOffset: number
  ) => (
    <div
      className="absolute w-full"
      style={{
        top: `${topOffset}px`,
        height: `${rowHeight}px`,
      }}
    >
      {items.map(({ imageIndex, virtualIndex }) => {
        const image = rowImages[imageIndex];
        if (!image) return null;

        const left = virtualIndex * avgItemWidth;

        return (
          <div
            key={`${rowKey}-${virtualIndex}`}
            className="absolute shrink-0 cursor-pointer transition-all duration-200 hover:scale-105 hover:z-20 hover:shadow-xl flex items-center justify-center"
            style={{
              left: `${left}px`,
              width: `${itemWidth}px`,
              height: `${rowHeight}px`,
              transformOrigin: "center center",
            }}
            onClick={() => handleImageClick(image)}
          >
            <div className="rounded-xl overflow-hidden max-w-full max-h-full">
              <Image
                src={image}
                alt={`Gallery ${imageIndex}`}
                width={1024}
                height={1536}
                className="max-w-full max-h-full object-contain"
                style={{ borderRadius: "0.75rem" }}
                loading="lazy"
              />
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <>
      <div
        ref={containerRef}
        className={cn(
          "relative overflow-hidden h-full [mask-image:linear-gradient(to_right,transparent,white_5%,white_95%,transparent)]",
          className
        )}
      >
        <div ref={scrollerRef} className="absolute w-full h-full">
          {/* Row 1 - Top with padding */}
          {renderRow(row1Items, row1Images, "row1", VERTICAL_PADDING)}
          {/* Row 2 - Bottom with padding */}
          {renderRow(
            row2Items,
            row2Images,
            "row2",
            VERTICAL_PADDING + rowHeight + ROW_GAP
          )}
        </div>
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {selectedImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 cursor-pointer"
            onClick={handleCloseLightbox}
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.8, opacity: 0 }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative p-2 rounded-2xl"
              style={{
                border: "3px solid #B3A0FF",
                backgroundColor: "#242833",
              }}
              onClick={(e) => e.stopPropagation()}
            >
              <Image
                src={selectedImage}
                alt="Gallery fullscreen"
                width={1024}
                height={1536}
                className="max-h-[85vh] w-auto rounded-xl"
                priority
              />
            </motion.div>
            {/* Click anywhere overlay hint */}
            <div className="absolute bottom-8 left-1/2 -translate-x-1/2 text-white/60 text-sm">
              タップして閉じる
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
