"use client";

import { cn } from "@/lib/utils";
import Image from "next/image";
import React, { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";

// Gap between images
const GAP = 16;
const ROW_GAP = 16;
const BUFFER_ITEMS = 3;

export const FullscreenGallery = ({
  images,
  direction = "left",
  speed = 40,
  rows = 4,
  className,
}: {
  images: string[];
  direction?: "left" | "right";
  speed?: number;
  rows?: number;
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

  // Split images into multiple rows
  const rowImages = React.useMemo(() => {
    const result: string[][] = Array.from({ length: rows }, () => []);
    sortedImages.forEach((img, i) => {
      result[i % rows].push(img);
    });
    return result;
  }, [sortedImages, rows]);

  // Calculate item width based on container height (responsive)
  useEffect(() => {
    const updateItemWidth = () => {
      if (!containerRef.current) return;
      const containerHeight = containerRef.current.offsetHeight;
      // Calculate available height for each row
      const totalGaps = ROW_GAP * (rows - 1);
      const availableHeight = containerHeight - totalGaps;
      const rowHeight = availableHeight / rows;
      // Image width from height with 3:4 aspect ratio
      const calculatedWidth = rowHeight * (3 / 4);
      setItemWidth(Math.floor(calculatedWidth));
    };

    updateItemWidth();
    window.addEventListener("resize", updateItemWidth);
    return () => window.removeEventListener("resize", updateItemWidth);
  }, [rows]);

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

  // Get max row length for animation
  const maxRowLength = Math.max(...rowImages.map((r) => r.length), 1);

  // Animation loop using requestAnimationFrame
  useEffect(() => {
    if (!containerRef.current || maxRowLength === 0) return;

    const container = containerRef.current;
    const containerWidth = container.offsetWidth;
    const totalWidth = maxRowLength * avgItemWidth;

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
        maxRowLength
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
  }, [maxRowLength, speed, direction, calculateVisibleRange, avgItemWidth]);

  // Calculate row height
  const rowHeight = itemWidth * (4 / 3);

  // Render a single row
  const renderRow = (
    items: ReturnType<typeof getVisibleItems>,
    images: string[],
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
        const image = images[imageIndex];
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
            <div className="rounded-lg overflow-hidden max-w-full max-h-full">
              <Image
                src={image}
                alt={`Gallery ${imageIndex}`}
                width={1024}
                height={1536}
                className="max-w-full max-h-full object-contain"
                style={{ borderRadius: "0.5rem" }}
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
          "relative overflow-hidden h-full [mask-image:linear-gradient(to_right,transparent,white_2%,white_98%,transparent)]",
          className
        )}
      >
        <div ref={scrollerRef} className="absolute w-full h-full">
          {rowImages.map((imgs, rowIndex) => {
            const topOffset = rowIndex * (rowHeight + ROW_GAP);
            const items = getVisibleItems(imgs.length);
            return (
              <React.Fragment key={`row${rowIndex}`}>
                {renderRow(items, imgs, `row${rowIndex}`, topOffset)}
              </React.Fragment>
            );
          })}
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 cursor-pointer"
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
                className="max-h-[90vh] w-auto rounded-xl"
                priority
              />
            </motion.div>
            {/* Click anywhere overlay hint */}
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 text-white/50 text-sm">
              タップして閉じる
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
