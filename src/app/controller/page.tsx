"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import Header from "@/components/layout/Header";
import Link from "next/link";
import { useSocket } from "@/context/SocketContext";

interface JoystickPosition {
  x: number;
  y: number;
  distance: number;
  angle: number;
}

type StateType = "intro" | "joystick";

// Zone information mapping
const zoneInfo: Record<
  string,
  { name: string; color: string; thumbnail: string }
> = {
  zone1: {
    name: "着物トライオン",
    color: "bg-red-500",
    thumbnail: "/images/Thumbnails/01_Kimono.png",
  },
  zone2: {
    name: "山手線クイズ",
    color: "bg-orange-500",
    thumbnail: "/images/Thumbnails/02_Train.png",
  },
  zone3: {
    name: "アナウンスクイズ",
    color: "bg-yellow-500",
    thumbnail: "/images/Thumbnails/03_.png",
  },
  zone4: {
    name: "富士山パズル",
    color: "bg-green-500",
    thumbnail: "/images/Thumbnails/04_FujiSan.png",
  },
  zone5: {
    name: "鹿せんべい",
    color: "bg-blue-500",
    thumbnail: "/images/Thumbnails/05_Deer.png",
  },
  zone6: {
    name: "納豆混ぜ",
    color: "bg-purple-500",
    thumbnail: "/images/Thumbnails/06_Natto.png",
  },
};

export default function ControllerPage() {
  const {
    socket,
    isConnected,
    setNickname,
    isNicknameSet,
    setIsNicknameSet,
    currentZone,
  } = useSocket();
  const [currentState, setCurrentState] = useState<StateType>("intro");
  const [tempNickname, setTempNickname] = useState("");

  // Joystick state
  const [joystickPosition, setJoystickPosition] = useState<JoystickPosition>({
    x: 0,
    y: 0,
    distance: 0,
    angle: 0,
  });
  const [isDragging, setIsDragging] = useState(false);
  const joystickRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);

  // Update state when nickname is set
  useEffect(() => {
    if (isNicknameSet && isConnected) {
      setCurrentState("joystick");
    }
  }, [isNicknameSet, isConnected]);

  // Handle nickname confirmation
  const handleNicknameConfirm = useCallback(() => {
    if (tempNickname.trim()) {
      setNickname(tempNickname.trim());
      setIsNicknameSet(true);
    }
  }, [tempNickname, setNickname, setIsNicknameSet]);

  // Handle Enter key in nickname input
  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLInputElement>) => {
      if (e.key === "Enter") {
        handleNicknameConfirm();
      }
    },
    [handleNicknameConfirm]
  );

  // Send movement to server based on joystick position
  const sendMovement = useCallback(
    (position: JoystickPosition) => {
      if (socket && isConnected && position.distance > 0.1) {
        // Send continuous movement data with constant speed
        const normalizedX = Math.cos((position.angle * Math.PI) / 180);
        const normalizedY = Math.sin((position.angle * Math.PI) / 180);

        const vectorData = {
          x: normalizedX,
          y: normalizedY,
          angle: position.angle,
          speed: 1, // Constant speed instead of distance-based
        };

        socket.emit("moveVector", vectorData);
      } else if (socket && isConnected && position.distance <= 0.1) {
        // Stop movement when joystick is released
        socket.emit("moveVector", { x: 0, y: 0, angle: 0, speed: 0 });
      }
    },
    [socket, isConnected]
  );

  // Continuous movement while joystick is held
  useEffect(() => {
    let intervalId: NodeJS.Timeout;

    if (isDragging && joystickPosition.distance > 0.1) {
      // Send movement every 16ms (~60fps) while joystick is held
      intervalId = setInterval(() => {
        sendMovement(joystickPosition);
      }, 16);
    }

    return () => {
      if (intervalId) {
        clearInterval(intervalId);
      }
    };
  }, [isDragging, joystickPosition, sendMovement]);

  // Calculate joystick position
  const calculateJoystickPosition = useCallback(
    (clientX: number, clientY: number): JoystickPosition => {
      if (!joystickRef.current) return { x: 0, y: 0, distance: 0, angle: 0 };

      const rect = joystickRef.current.getBoundingClientRect();
      const centerX = rect.left + rect.width / 2;
      const centerY = rect.top + rect.height / 2;

      const deltaX = clientX - centerX;
      const deltaY = clientY - centerY;

      const distance = Math.sqrt(deltaX * deltaX + deltaY * deltaY);
      const maxDistance = rect.width / 2 - 20; // Leave some margin

      const limitedDistance = Math.min(distance, maxDistance);
      const angle = Math.atan2(deltaY, deltaX) * (180 / Math.PI);

      const normalizedDistance = limitedDistance / maxDistance;

      const limitedX = (deltaX / distance) * limitedDistance;
      const limitedY = (deltaY / distance) * limitedDistance;

      return {
        x: isNaN(limitedX) ? 0 : limitedX,
        y: isNaN(limitedY) ? 0 : limitedY,
        distance: normalizedDistance,
        angle: angle,
      };
    },
    []
  );

  // Mouse events
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      setIsDragging(true);
      const position = calculateJoystickPosition(e.clientX, e.clientY);
      setJoystickPosition(position);
      // Send movement immediately for responsiveness
      sendMovement(position);
    },
    [calculateJoystickPosition, sendMovement]
  );

  const handleMouseMove = useCallback(
    (e: MouseEvent) => {
      if (!isDragging) return;

      const position = calculateJoystickPosition(e.clientX, e.clientY);
      setJoystickPosition(position);
      // Send movement immediately when position changes
      sendMovement(position);
    },
    [isDragging, calculateJoystickPosition, sendMovement]
  );

  const handleMouseUp = useCallback(() => {
    setIsDragging(false);
    setJoystickPosition({ x: 0, y: 0, distance: 0, angle: 0 });
    // Send stop command immediately
    if (socket && isConnected) {
      socket.emit("moveVector", { x: 0, y: 0, angle: 0, speed: 0 });
    }
  }, [socket, isConnected]);

  // Touch events
  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      e.preventDefault();
      setIsDragging(true);
      const touch = e.touches[0];
      const position = calculateJoystickPosition(touch.clientX, touch.clientY);
      setJoystickPosition(position);
      // Send movement immediately for responsiveness
      sendMovement(position);
    },
    [calculateJoystickPosition, sendMovement]
  );

  const handleTouchMove = useCallback(
    (e: TouchEvent) => {
      if (!isDragging) return;
      e.preventDefault();

      const touch = e.touches[0];
      const position = calculateJoystickPosition(touch.clientX, touch.clientY);
      setJoystickPosition(position);
      // Send movement immediately when position changes
      sendMovement(position);
    },
    [isDragging, calculateJoystickPosition, sendMovement]
  );

  const handleTouchEnd = useCallback(
    (e: TouchEvent) => {
      e.preventDefault();
      setIsDragging(false);
      setJoystickPosition({ x: 0, y: 0, distance: 0, angle: 0 });
      // Send stop command immediately
      if (socket && isConnected) {
        socket.emit("moveVector", { x: 0, y: 0, angle: 0, speed: 0 });
      }
    },
    [socket, isConnected]
  );

  // Global event listeners
  useEffect(() => {
    if (isDragging) {
      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
      document.addEventListener("touchmove", handleTouchMove, {
        passive: false,
      });
      document.addEventListener("touchend", handleTouchEnd, { passive: false });
    }

    return () => {
      document.removeEventListener("mousemove", handleMouseMove);
      document.removeEventListener("mouseup", handleMouseUp);
      document.removeEventListener("touchmove", handleTouchMove);
      document.removeEventListener("touchend", handleTouchEnd);
    };
  }, [
    isDragging,
    handleMouseMove,
    handleMouseUp,
    handleTouchMove,
    handleTouchEnd,
  ]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2 backdrop-blur-sm">
      <Header />

      {/* Main content */}
      <main className="flex flex-col items-center justify-between gap-16 w-full flex-1 px-6 text-center">
        {/* INTRO STATE */}
        {currentState === "intro" && (
          <div className="flex flex-col items-center justify-center w-full">
            <div className="w-full mt-8">
              <div className="flex flex-col items-center">
                <h1 className="w-full text-2xl bg-theme-purple font-bold py-4">
                  Welcome to <br /> Virtual Festival
                </h1>
                <p className="w-full text-lg bg-theme-yellow py-2">
                  祭りを楽しむためのニックネームを入力してください
                </p>
              </div>
            </div>

            <div className="w-full space-y-4 mt-32">
              <input
                type="text"
                value={tempNickname}
                onChange={(e) => setTempNickname(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="ニックネームを入力..."
                maxLength={20}
                className="w-full px-6 py-4 text-lg text-white rounded-lg border-2 border-theme-purple focus:outline-none focus:border-theme-yellow"
                autoFocus
              />
              <button
                onClick={handleNicknameConfirm}
                disabled={!tempNickname.trim()}
                className="w-fit px-8 py-10 bg-linear-to-tr from-[#2E3D54] from-60% to-[#4a6590] text-theme-yellow font-bold text-2xl rounded-full border border-theme-purple active:scale-95 transition-transform"
              >
                入場
              </button>
            </div>
          </div>
        )}

        {/* JOYSTICK STATE */}
        {currentState === "joystick" && (
          <>
            {/* Banner space */}
            <div className="flex flex-col items-center mb-8 space-y-4">
              <div className="w-full rounded-sm text-xl bg-theme-purple py-4 px-2 mt-8">
                <h2>ジョイスティックを使って、祭りを楽しもう！</h2>
              </div>

              {/* Zone trigger button - only show when in a zone */}
              <div
                className={`w-full h-16 flex justify-center items-center mt-24 transition-opacity duration-300 ${
                  currentZone && zoneInfo[currentZone]
                    ? "opacity-100"
                    : "opacity-0 pointer-events-none"
                }`}
              >
                {currentZone && zoneInfo[currentZone] && (
                  <Link
                    href={`/controller/${currentZone.replace("zone", "zone_")}`}
                  >
                    <motion.div
                      className="relative group cursor-pointer transition-transform active:scale-95"
                      animate={{ y: [0, -20, 0] }}
                      transition={{
                        duration: 0.8,
                        repeat: Infinity,
                        ease: "easeOut",
                        times: [0, 0.3, 1],
                      }}
                    >
                      <Image
                        src={zoneInfo[currentZone].thumbnail}
                        alt={zoneInfo[currentZone].name}
                        width={600}
                        height={600}
                        className="w-66 h-66 object-contain transition-all"
                      />
                    </motion.div>
                  </Link>
                )}
              </div>
            </div>

            {/* Real Joystick */}
            <div className="controller-container mb-8">
              <div className="joystick-wrapper">
                <div
                  ref={joystickRef}
                  className="joystick-base"
                  onMouseDown={handleMouseDown}
                  onTouchStart={handleTouchStart}
                >
                  <div
                    ref={knobRef}
                    className="joystick-knob"
                    style={{
                      transform: `translate(${joystickPosition.x}px, ${joystickPosition.y}px)`,
                    }}
                  ></div>
                </div>
              </div>
            </div>
          </>
        )}
      </main>
      {/* Connection Status */}
      <div className="text-center mb-4">
        {/* {currentPlayer && (
          <div style={{ marginTop: '1rem' }}>
            <p><strong>Your Avatar:</strong></p>
            <div className="player-item">
              <span>{currentPlayer.name}</span>
              <div
                className="player-color"
                style={{ backgroundColor: currentPlayer.color }}
              ></div>
            </div>
            <p><small>Position: ({Math.round(currentPlayer.x)}, {Math.round(currentPlayer.y)})</small></p>
          </div>
        )} */}
        <div className="status-indicator text-white">
          <div
            className={`connection-status ${
              isConnected ? "connected" : "disconnected"
            }`}
          ></div>
          {isConnected ? "🟢 Connected to Festival" : "🔴 Connecting..."}
        </div>
      </div>

      {/* joystick style */}
      <style jsx>{`
        .joystick-wrapper {
          display: flex;
          justify-content: center;
          align-items: center;
          padding: 2rem;
        }

        .joystick-base {
          width: 200px;
          height: 200px;
          border-radius: 50%;
          background: var(--color-theme-yellow);
          border: 3px solid #999;
          position: relative;
          cursor: pointer;
          box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.1),
            0 4px 8px rgba(0, 0, 0, 0.2);
          touch-action: none;
          user-select: none;
        }

        .joystick-knob {
          position: relative;
          width: 60px;
          height: 60px;
          border-radius: 50%;
          background: #242833;
          top: 50%;
          left: 50%;
          margin-top: -30px;
          margin-left: -30px;
          cursor: grab;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 1.2rem;
          box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
          transition: background-color 0.1s ease;
          pointer-events: none;
        }

        .joystick-knob:active {
          cursor: grabbing;
        }

        .joystick-info {
          text-align: center;
          margin-top: 1rem;
          font-family: monospace;
          background: #f5f5f5;
          padding: 1rem;
          border-radius: 8px;
        }

        @media (max-width: 480px) {
          .joystick-base {
            width: 180px;
            height: 180px;
          }

          .joystick-knob {
            width: 50px;
            height: 50px;
            margin-top: -25px;
            margin-left: -25px;
            font-size: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
