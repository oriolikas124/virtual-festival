"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import * as headbreaker from "headbreaker";
import Header from "@/components/layout/Header";
// import MuteBtn from '@/components/ui/MuteBtn';
import BackBtn from "@/components/ui/BackBtn";
import Link from "next/link";

const imageList = [
  "/images/zone_4/zone_4_pz01.jpg",
  "/images/zone_4/zone_4_pz04.jpg",
  "/images/zone_4/zone_4_pz03.jpg",
];

function formatTime(totalSeconds: number) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  const ss = s.toString().padStart(2, "0");
  return `${m}:${ss}`;
}

export default function Zone4() {
  const puzzleRef = useRef<HTMLDivElement>(null);

  const [level, setLevel] = useState(0);
  const [score, setScore] = useState(0);

  const [isFinished, setIsFinished] = useState(false);
  const [showNextPrompt, setShowNextPrompt] = useState(false);
  const [showStart, setShowStart] = useState(true);

  const [totalSeconds, setTotalSeconds] = useState(0);
  const [ticking, setTicking] = useState(false);

  const connectedRef = useRef<Set<string>>(new Set());
  const scoreRef = useRef(0);

  useEffect(() => {
    connectedRef.current = new Set();
  }, [level, showStart]);

  const [canvasSize, setCanvasSize] = useState({ width: 800, height: 600 });

  // Responsive canvas size calculation
  const calculateCanvasSize = useCallback(() => {
    const vw = window.innerWidth;
    const isTablet = vw >= 768;

    let width: number;

    if (isTablet) {
      // Tablet portrait
      width = Math.min(vw - 48, 700);
    } else {
      // Phone
      width = Math.min(vw - 32, 500);
    }

    const height = width * 0.75;
    setCanvasSize({ width: Math.floor(width), height: Math.floor(height) });
  }, []);

  useEffect(() => {
    calculateCanvasSize();
    window.addEventListener("resize", calculateCanvasSize);
    return () => {
      window.removeEventListener("resize", calculateCanvasSize);
    };
  }, [calculateCanvasSize]);

  // Save score when puzzle is finished
  useEffect(() => {
    if (isFinished && scoreRef.current > 0) {
      const playerName =
        typeof window !== "undefined"
          ? localStorage.getItem("playerNickname") || "Player"
          : "Player";

      console.log("🎮 Saving score to API:", scoreRef.current);
      fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: "zone_4",
          name: playerName,
          score: scoreRef.current,
        }),
      })
        .then((res) => res.json())
        .then((data) => {
          console.log("✅ Score saved:", data);
        })
        .catch((err) => {
          console.error("❌ Error saving score:", err);
        });
    }
  }, [isFinished]);

  useEffect(() => {
    if (!ticking) return;
    const id = setInterval(() => setTotalSeconds((t) => t + 1), 1000);
    return () => clearInterval(id);
  }, [ticking]);

  useEffect(() => {
    const container = puzzleRef.current;

    if (!container || level >= imageList.length || showNextPrompt || showStart)
      return;

    container.innerHTML = "";

    const { width, height } = canvasSize;
    const horiz = 4;
    const vert = 3;

    const pieceSize = Math.min(
      Math.floor(width / horiz),
      Math.floor(height / vert)
    );

    type Meta = { pid: string; r: number; c: number };
    const metadata: Meta[] = Array.from({ length: horiz * vert }, (_, i) => ({
      pid: `L${level}-P${i}`,
      r: Math.floor(i / horiz),
      c: i % horiz,
    }));

    const img = new Image();
    img.src = imageList[level];
    img.onload = () => {
      const canvas = new headbreaker.Canvas(container.id, {
        width,
        height,
        pieceSize,
        proximity: 20,
        borderFill: 5,
        strokeWidth: 2,
        lineSoftness: 0.25,
        painter: new headbreaker.painters.Konva(),
        outline: new headbreaker.outline.Rounded(),
        image: img,
        preventOffstageDrag: true,
        fixed: true,
      });

      canvas.adjustImagesToPuzzleHeight();

      canvas.autogenerate({
        horizontalPiecesCount: horiz,
        verticalPiecesCount: vert,
        metadata,
      });

      const pidAt = (r: number, c: number) => {
        if (r < 0 || r >= vert || c < 0 || c >= horiz) return undefined;
        return metadata[r * horiz + c]?.pid;
      };

      const neighbors = new Map<string, Set<string>>();
      for (const m of metadata) {
        const set = new Set<string>();
        const left = pidAt(m.r, m.c - 1);
        const right = pidAt(m.r, m.c + 1);
        const up = pidAt(m.r - 1, m.c);
        const down = pidAt(m.r + 1, m.c);
        if (left) set.add(left);
        if (right) set.add(right);
        if (up) set.add(up);
        if (down) set.add(down);
        neighbors.set(m.pid, set);
      }

      const getPid = (obj: unknown): string | undefined => {
        if (obj && typeof obj === "object" && "metadata" in obj) {
          const meta = (obj as { metadata?: unknown }).metadata;
          if (meta && typeof meta === "object" && "pid" in meta) {
            const pid = (meta as { pid?: unknown }).pid;
            return typeof pid === "string" ? pid : undefined;
          }
        }
        return undefined;
      };

      canvas.attachConnectionRequirement((one: unknown, other: unknown) => {
        const a = getPid(one);
        const b = getPid(other);
        if (!a || !b) return false;
        return (
          neighbors.get(a)?.has(b) === true || neighbors.get(b)?.has(a) === true
        );
      });

      canvas.reframeWithinDimensions();
      canvas.shuffle(0.7);
      canvas.draw();

      canvas.onConnect(
        (piece: unknown, _fig: unknown, targetPiece: unknown) => {
          const a = getPid(piece);
          const b = getPid(targetPiece);
          const isNeighbor =
            !!a &&
            !!b &&
            (neighbors.get(a)?.has(b) === true ||
              neighbors.get(b)?.has(a) === true);
          if (!isNeighbor) return;

          if (a) connectedRef.current.add(a);
          if (b) connectedRef.current.add(b);
        }
      );

      canvas.onDisconnect((piece: unknown) => {
        const a = getPid(piece);
        if (a) connectedRef.current.delete(a);
      });

      // Add boundary constraint for dragged pieces
      const stageObj = (canvas as unknown as { stage?: unknown }).stage;
      if (stageObj) {
        const stage = stageObj as {
          on: (event: string, handler: (e: unknown) => void) => void;
        };
        stage.on("dragmove", (e: unknown) => {
          const evt = e as {
            target?: {
              x?: (val?: number) => number;
              y?: (val?: number) => number;
              width?: () => number;
              height?: () => number;
              getParent?: () => unknown;
            };
          };
          const target = evt.target;
          if (
            !target ||
            typeof target.x !== "function" ||
            typeof target.y !== "function"
          )
            return;

          const margin = 150;
          const x = target.x?.();
          const y = target.y?.();
          const w = target.width?.() || 0;
          const h = target.height?.() || 0;

          // Constrain x
          if (x !== undefined && x > width + margin) {
            target.x?.(width + margin);
          }
          if (x !== undefined && x + w < -margin) {
            target.x?.(-margin - w);
          }

          // Constrain y
          if (y !== undefined && y > height + margin) {
            target.y?.(height + margin);
          }
          if (y !== undefined && y + h < -margin) {
            target.y?.(-margin - h);
          }
        });
      }

      canvas.attachSolvedValidator();
      canvas.onValid(() => {
        if (level < imageList.length - 1) {
          setScore((s) => {
            const newScore = s + 20;
            scoreRef.current = newScore;
            return newScore;
          });
          setShowNextPrompt(true);
        } else {
          setScore((s) => {
            const newScore = s + 20;
            scoreRef.current = newScore;
            return newScore;
          });
          setTicking(false);
          setIsFinished(true);
        }
      });
    };
  }, [level, canvasSize, showNextPrompt, showStart]);

  const handleStart = () => {
    setShowStart(false);
    setTicking(true);
  };

  const handleNextLevel = () => {
    setShowNextPrompt(false);
    setLevel((prev) => prev + 1);
  };

  // Auto next level after 2 seconds when completed
  useEffect(() => {
    if (!showNextPrompt) return;

    const timer = setTimeout(() => {
      handleNextLevel();
    }, 1000);

    return () => clearTimeout(timer);
  }, [showNextPrompt]);

  const handleSkip = () => {
    const gained = connectedRef.current.size;
    if (gained > 0)
      setScore((s) => {
        const newScore = s + gained;
        scoreRef.current = newScore;
        return newScore;
      });

    if (level < imageList.length - 1) {
      setShowNextPrompt(false);
      setLevel((prev) => prev + 1);
    } else {
      setTicking(false);
      setIsFinished(true);
    }
  };

  const startBg = imageList[level] ?? "";

  return (
    <div className="flex flex-col min-h-[100dvh] bg-gradient-to-b from-[#1a1f2e] to-[#0d1117]">
      <Header />

      {/* Navigation bar */}
      <div className="shrink-0 w-full h-12 md:h-14 flex items-center justify-between px-4 md:px-6">
        <BackBtn />
        {/* <MuteBtn /> */}
      </div>

      {/* Main content area */}
      <main className="flex-1 flex items-center justify-center px-4 md:px-6 pb-4 overflow-hidden">
        {/* スタートページ */}
        {showStart && !isFinished && (
          <div
            className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl max-w-full"
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${startBg})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(8px) brightness(0.7)",
              }}
            />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-8">
              <div className="w-fit bg-theme-purple rounded-2xl md:rounded-3xl px-6 md:px-10 py-4 md:py-8 mb-4 md:mb-6 text-black text-center shadow-xl">
                <h1 className="text-xl md:text-3xl lg:text-4xl font-bold mb-3 md:mb-4">
                  富士山パズルゲーム
                </h1>
                <p className="text-base md:text-lg lg:text-xl leading-relaxed">
                  次のパズルを解いてください
                  <br />
                  早いほどポイントが取れます
                </p>
              </div>
              <button
                onClick={handleStart}
                className="px-8 md:px-12 py-3 md:py-4 bg-theme-yellow rounded-full font-semibold text-base md:text-lg active:scale-95 transition-transform shadow-lg hover:shadow-xl"
              >
                スタート
              </button>
            </div>
          </div>
        )}

        {/* Game UI */}
        {!showStart && !isFinished && (
          <div className="flex flex-col gap-3 items-center justify-center w-full max-w-[700px]">
            {/* Top controls bar */}
            <div className="flex items-center justify-center gap-2 md:gap-4 flex-wrap">
              <div className="flex items-center gap-3 md:gap-4 px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl bg-white/10 backdrop-blur-sm border border-white/10">
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm md:text-base">⏱</span>
                  <span className="text-white font-mono font-bold md:text-lg">{formatTime(totalSeconds)}</span>
                </div>
                <div className="w-px h-4 md:h-5 bg-white/20" />
                <div className="flex items-center gap-2">
                  <span className="text-white/60 text-sm md:text-base">★</span>
                  <span className="text-theme-yellow font-mono font-bold md:text-lg">{score}</span>
                </div>
                <div className="w-px h-4 md:h-5 bg-white/20" />
                <span className="text-white/80 text-sm md:text-base">
                  Lv.{Math.min(level + 1, imageList.length)}/{imageList.length}
                </span>
              </div>
              <button
                onClick={handleSkip}
                className="px-4 md:px-6 py-2 md:py-3 rounded-xl md:rounded-2xl bg-red-500/80 text-white text-sm md:text-base font-semibold active:scale-[0.98]"
              >
                Skip
              </button>
            </div>

            {/* Preview image - always visible */}
            <div className="w-full bg-white/5 rounded-xl md:rounded-2xl border border-white/10 p-2 md:p-3">
              <div
                className="w-full rounded-lg md:rounded-xl overflow-hidden"
                style={{
                  aspectRatio: "4/3",
                  backgroundImage: `url(${imageList[level]})`,
                  backgroundSize: "cover",
                  backgroundPosition: "center",
                }}
              />
            </div>

            {/* Puzzle canvas */}
            <div
              ref={puzzleRef}
              id="puzzle"
              className="relative rounded-xl md:rounded-2xl overflow-hidden shadow-xl"
              style={{
                width: `${canvasSize.width}px`,
                height: `${canvasSize.height}px`,
                backgroundColor: "rgba(100,100,120,0.3)",
                border: "2px solid rgba(255,255,255,0.1)",
              }}
            />
          </div>
        )}

        {/* 結算 - Finish screen */}
        {isFinished && (
          <div
            className="relative rounded-2xl md:rounded-3xl overflow-hidden shadow-2xl"
            style={{
              width: `${canvasSize.width}px`,
              height: `${canvasSize.height}px`,
            }}
          >
            <div
              className="absolute inset-0"
              style={{
                backgroundImage: `url(${imageList[imageList.length - 1]})`,
                backgroundSize: "cover",
                backgroundPosition: "center",
                filter: "blur(6px) brightness(0.8)",
              }}
            />
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 flex flex-col items-center justify-center p-4 md:p-8">
              <div className="text-3xl md:text-5xl lg:text-6xl font-bold text-white mb-3 md:mb-4 drop-shadow-lg">
                🎉 Congratulation!
              </div>
              <div className="text-lg md:text-xl text-white font-medium mb-2">
                <span className="text-2xl md:text-3xl text-red-400 font-bold mr-1">
                  {formatTime(totalSeconds)}
                </span>
                でクリアしました！
              </div>
              <div className="text-3xl md:text-5xl font-bold text-green-400 mb-6 md:mb-8 drop-shadow-lg">
                {score} Points
              </div>

              <Link
                href="/controller/"
                className="px-8 md:px-12 py-3 md:py-4 bg-theme-yellow text-black rounded-xl md:rounded-2xl font-semibold text-base md:text-lg shadow-lg hover:shadow-xl transition-shadow active:scale-[0.98]"
              >
                コントローラーに戻る
              </Link>
            </div>

            {/* Confetti animation */}
            <style jsx>{`
              @keyframes confetti {
                0% {
                  transform: translateY(-40%) rotate(0deg);
                  opacity: 0;
                }
                10% {
                  opacity: 1;
                }
                100% {
                  transform: translateY(140%) rotate(720deg);
                  opacity: 0;
                }
              }
            `}</style>
            {[...Array(24)].map((_, i) => (
              <span
                key={i}
                className="absolute pointer-events-none"
                style={{
                  top: `${Math.random() * 20 - 10}%`,
                  left: `${(i / 24) * 100}%`,
                  width: "4px",
                  height: `${8 + Math.random() * 20}px`,
                  background: [
                    "#ff4d4f",
                    "#36cfc9",
                    "#597ef7",
                    "#73d13d",
                    "#faad14",
                  ][i % 5],
                  animation: `confetti ${2.8 + Math.random()}s ease-in forwards`,
                  animationDelay: `${Math.random() * 0.6}s`,
                  borderRadius: "2px",
                }}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}
