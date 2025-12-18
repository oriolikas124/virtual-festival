"use client";

import Header from "@/components/layout/Header";
import BackBtn from "@/components/ui/BackBtn";
import Link from "next/link";
import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import Story from "@/../data/zone_5/story.json";

type StateType = "intro" | "playing" | "result";

interface StoryNode {
  type: string;
  video: string;
  duration: number;
  choices?: Array<{ text: string; next: string }>;
  autoNext?: boolean;
  next?: string;
  status?: string;
  end?: boolean;
  endingType?: string;
}

interface StoryData {
  start: string;
  metadata: {
    title: string;
    videoCount: number;
    endings: string[];
  };
  nodes: Record<string, StoryNode>;
}

export default function Page() {
  const [state, setState] = useState<StateType>("intro");
  const [storyData, setStoryData] = useState<StoryData | null>(null);
  const [currentNodeId, setCurrentNodeId] = useState<string>("");
  const [isLoading, setIsLoading] = useState(true);
  const [videoPlaying, setVideoPlaying] = useState(false);
  const [endingType, setEndingType] = useState<string>("");
  const [videoKey, setVideoKey] = useState<number>(0);
  const [nodeHistory, setNodeHistory] = useState<string[]>([]);

  // Load story data
  useEffect(() => {
    setStoryData(Story as StoryData);
    setCurrentNodeId((Story as StoryData).start);
    setIsLoading(false);
  }, []);

  // Set videoPlaying to true when currentNodeId changes during gameplay
  useEffect(() => {
    if (state === "playing" && currentNodeId) {
      setVideoPlaying(true);
    }
  }, [currentNodeId, state]);

  const getCurrentNode = (): StoryNode | null => {
    if (!storyData) return null;
    return storyData.nodes[currentNodeId] || null;
  };

  const handleVideoEnd = () => {
    const currentNode = getCurrentNode();
    if (!currentNode) return;

    if (currentNode.autoNext && currentNode.next) {
      // Auto play next
      setCurrentNodeId(currentNode.next);
    } else if (currentNode.end) {
      // Game ended
      setEndingType(currentNode.endingType || "normal");
      setState("result");
    } else {
      // Show choices
      setVideoPlaying(false);
    }
  };

  const handleChoice = (nextNodeId: string) => {
    // Save current node to history
    setNodeHistory((prev) => [...prev, currentNodeId]);
    setCurrentNodeId(nextNodeId);
    // videoPlaying will be set to true by useEffect
    // Reset video key to trigger fade animation
    setVideoKey((prev) => prev + 1);
  };

  const goBack = () => {
    if (nodeHistory.length === 0) return;

    // Get the previous node ID
    const previousNodeId = nodeHistory[nodeHistory.length - 1];
    // Remove that node from history
    setNodeHistory((prev) => prev.slice(0, -1));
    // Go back to the previous node
    setCurrentNodeId(previousNodeId);
    setVideoPlaying(false);
    setVideoKey((prev) => prev + 1);
  };

  const startGame = () => {
    setState("playing");
    setVideoPlaying(true);
  };

  const resetGame = () => {
    setState("intro");
    setCurrentNodeId(storyData?.start || "");
    setEndingType("");
    setVideoPlaying(false);
    setNodeHistory([]);
  };

  const renderContent = () => {
    switch (state) {
      case "intro":
        return (
          <motion.div
            key="intro"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            <div className="space-y-4 p-6 bg-theme-purple rounded-3xl">
              <div className="relative flex items-center justify-center">
                <h1 className="text-3xl font-bold">
                  {storyData?.metadata.title}
                </h1>
                <Image
                  src="/emojis/頑張れ.png"
                  alt="頑張れ"
                  width={70}
                  height={70}
                  className="absolute -right-2 -top-4"
                />
              </div>
              <p className="text-lg font-semibold text-gray-800 leading-relaxed mb-8 max-w-2xl">
                小鹿との出会いを体験してください。あなたの選択が物語を決めます。
              </p>
              <p className="text-md italic text-gray-800 max-w-2xl">
                *
                ヘッドホンまたはイヤホンを使用して、より没入感のある体験をお楽しみください。*
              </p>
              <div className="flex gap-4 justify-center text-sm text-gray-800">
                <span>ビデオ: {storyData?.metadata.videoCount}</span>
                <span>エンディング: {storyData?.metadata.endings.length}</span>
              </div>
            </div>
            <button
              onClick={startGame}
              className="px-8 py-3 bg-theme-yellow rounded-full font-semibold active:scale-95 transition-transform"
            >
              ゲームを始める
            </button>
          </motion.div>
        );

      case "playing":
        const currentNode = getCurrentNode();
        if (!currentNode) return null;

        return (
          <motion.div
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-6 w-full"
          >
            {/* Status */}
            <motion.p
              animate={{ opacity: currentNode.status ? 1 : 0.3 }}
              transition={{ duration: 0.3 }}
              className="text-lg text-white font-semibold h-6"
            >
              {currentNode.status || ""}
            </motion.p>

            {/* Video container 16:9 */}
            <div className="w-full max-w-4xl bg-black rounded-lg overflow-hidden">
              <div className="aspect-video relative">
                <motion.video
                  key={videoKey}
                  src={`/${currentNode.video}`}
                  playsInline
                  autoPlay
                  onEnded={handleVideoEnd}
                  className="w-full h-full object-cover"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.5, duration: 0.8 }}
                />
                {/* Loading overlay */}
                {isLoading && (
                  <motion.div
                    className="absolute inset-0 bg-white/10 backdrop-blur-md flex items-center justify-center"
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 0 }}
                    transition={{ delay: 0.5 }}
                  >
                    <div className="w-12 h-12 border-4 border-theme-yellow border-t-transparent rounded-full animate-spin" />
                  </motion.div>
                )}
              </div>
            </div>

            {/* Choices */}
            <motion.div
              animate={{
                opacity:
                  !videoPlaying &&
                  currentNode.choices &&
                  currentNode.choices.length > 0
                    ? 1
                    : 0,
              }}
              transition={{ duration: 0.3 }}
              className="flex flex-col gap-3 w-full max-w-2xl pointer-events-none"
              style={{
                pointerEvents:
                  !videoPlaying &&
                  currentNode.choices &&
                  currentNode.choices.length > 0
                    ? "auto"
                    : "none",
              }}
            >
              {currentNode.choices &&
                currentNode.choices.map((choice, index) => (
                  <button
                    key={index}
                    onClick={() => handleChoice(choice.next)}
                    className="px-6 py-3 bg-theme-yellow text-black rounded-full font-semibold text-center active:scale-95 transition-transform"
                  >
                    {choice.text}
                  </button>
                ))}
            </motion.div>

            {/* Back button */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: nodeHistory.length > 0 ? 1 : 0.3 }}
              className="mt-4"
            >
              <button
                onClick={goBack}
                disabled={nodeHistory.length === 0}
                className={`px-6 py-2 rounded-full font-semibold text-center transition-all ${
                  nodeHistory.length > 0
                    ? "bg-gray-600 text-white active:scale-95"
                    : "bg-gray-400 text-gray-200 cursor-not-allowed"
                }`}
              >
                ← 前の選択に戻る
              </button>
            </motion.div>
          </motion.div>
        );

      case "result":
        const endingText: Record<string, { title: string; message: string }> = {
          happy: {
            title: "ハッピーエンディング",
            message: "小鹿と素敵な友達になりました！",
          },
          normal: {
            title: "ノーマルエンディング",
            message: "小鹿と普通の出会いを体験しました。",
          },
          bad: {
            title: "バッドエンディング",
            message: "小鹿に逃げられてしまいました...",
          },
        };

        const getEndingSticker = (type: string): string => {
          switch (type) {
            case "happy":
              return "/emojis/やった.png";
            case "normal":
              return "/emojis/いいね.png";
            case "bad":
              return "/emojis/残念.png";
            default:
              return "/emojis/いいね.png";
          }
        };

        const ending = endingText[endingType] || endingText.normal;

        return (
          <motion.div
            key="result"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center justify-center gap-8"
          >
            <div className="space-y-4 p-6 bg-theme-purple rounded-3xl relative overflow-hidden">
              {endingType === "happy" && (
                <div className="absolute inset-0 pointer-events-none">
                  {[...Array(20)].map((_, i) => (
                    <motion.div
                      key={i}
                      className="absolute w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: [
                          "#FF0000",
                          "#FF6600",
                          "#FFCC00",
                          "#00CC00",
                          "#0099FF",
                          "#6600FF",
                          "#FF0099",
                          "#FFFFFF",
                        ][i % 8],
                        left: `${Math.random() * 100}%`,
                        top: `${Math.random() * 100}%`,
                      }}
                      initial={{ y: 0, opacity: 0, scale: 0 }}
                      animate={{
                        y: -100 - Math.random() * 50,
                        opacity: [0, 1, 1, 0],
                        scale: [0, 1, 1, 0],
                      }}
                      transition={{
                        duration: 2 + Math.random() * 2,
                        delay: Math.random() * 2,
                        repeat: Infinity,
                        repeatDelay: 1 + Math.random() * 2,
                      }}
                    />
                  ))}
                </div>
              )}
              <div className="flex items-center justify-center gap-4 mb-4 relative z-10">
                {endingType === "happy" ? (
                  <h2 className="text-4xl font-bold flex justify-center flex-wrap">
                    {ending.title.split("").map((letter, i) => (
                      <motion.span
                        key={i}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: 0.3 + i * 0.05,
                          type: "spring",
                          stiffness: 300,
                        }}
                        style={{
                          color: [
                            "#FF0000",
                            "#FF6600",
                            "#FFCC00",
                            "#00CC00",
                            "#0099FF",
                            "#6600FF",
                            "#FF0099",
                            "#FF0000",
                            "#FF6600",
                            "#FFCC00",
                            "#00CC00",
                            "#0099FF",
                            "#6600FF",
                            "#FF0099",
                            "#FF0000",
                          ][i % 15],
                        }}
                        className="inline-block drop-shadow-md"
                      >
                        {letter === " " ? "\u00A0" : letter}
                      </motion.span>
                    ))}
                  </h2>
                ) : endingType === "normal" ? (
                  <h2 className="text-4xl font-bold flex justify-center flex-wrap">
                    {ending.title.split("").map((letter, i) => (
                      <motion.span
                        key={i}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: 0.3 + i * 0.05,
                          type: "spring",
                          stiffness: 300,
                        }}
                        style={{
                          color: [
                            "#0066CC",
                            "#1a237e",
                            "#4a148c",
                            "#6a1b9a",
                            "#8e24aa",
                            "#ba68c8",
                            "#0066CC",
                            "#1a237e",
                            "#4a148c",
                            "#6a1b9a",
                            "#8e24aa",
                            "#ba68c8",
                            "#0066CC",
                            "#1a237e",
                          ][i % 14],
                        }}
                        className="inline-block drop-shadow-md"
                      >
                        {letter === " " ? "\u00A0" : letter}
                      </motion.span>
                    ))}
                  </h2>
                ) : (
                  <h2 className="text-4xl font-bold flex justify-center flex-wrap">
                    {ending.title.split("").map((letter, i) => (
                      <motion.span
                        key={i}
                        initial={{ y: -20, opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        transition={{
                          delay: 0.3 + i * 0.05,
                          type: "spring",
                          stiffness: 300,
                        }}
                        style={{
                          color: [
                            "#1a1a1a",
                            "#2a2a2a",
                            "#3a3a3a",
                            "#4a4a4a",
                            "#5a5a5a",
                            "#6a6a6a",
                            "#7a7a7a",
                            "#8a8a8a",
                            "#1a1a1a",
                            "#2a2a2a",
                            "#3a3a3a",
                            "#4a4a4a",
                            "#5a5a5a",
                            "#6a6a6a",
                          ][i % 14],
                        }}
                        className="inline-block drop-shadow-md"
                      >
                        {letter === " " ? "\u00A0" : letter}
                      </motion.span>
                    ))}
                  </h2>
                )}
                <motion.div
                  initial={{ scale: 0, rotate: -180 }}
                  animate={{ scale: 1, rotate: 0 }}
                  transition={{
                    type: "spring",
                    stiffness: 200,
                    damping: 15,
                    delay: 0.5,
                  }}
                >
                  <Image
                    src={getEndingSticker(endingType)}
                    alt="Ending sticker"
                    width={70}
                    height={70}
                    className="drop-shadow-lg"
                  />
                </motion.div>
              </div>
              <p className="text-xl text-gray-700 mb-8">{ending.message}</p>
            </div>

            <div className="flex gap-4">
              <button
                onClick={resetGame}
                className="px-8 py-3 bg-theme-yellow text-black rounded-full font-semibold active:scale-95 transition-transform"
              >
                もう一度プレイ
              </button>
              <Link
                href="/controller/"
                className="px-8 py-3 bg-gray-300 text-black rounded-full font-semibold active:scale-95 transition-transform"
              >
                戻る
              </Link>
            </div>
          </motion.div>
        );
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Header />
      {/* Back and mute button */}
      <div className="w-full h-16 flex items-center justify-between px-8">
        <BackBtn />
      </div>
      {/* Main content */}
      <main className="flex flex-col items-center justify-center w-full flex-1 px-8 text-center">
        <AnimatePresence mode="wait">{renderContent()}</AnimatePresence>
      </main>
    </div>
  );
}
