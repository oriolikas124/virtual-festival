"use client";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import Header from "@/components/layout/Header";
import BackBtn from "@/components/ui/BackBtn";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";

// Sticker selection based on score
const getResultSticker = (score: number): string => {
  if (score >= 140) return "/emojis/やった.png"; // 70+ rotations - excellent!
  if (score >= 90) return "/emojis/verygood.png"; // 50+ rotations - great!
  if (score >= 60) return "/emojis/いいね.png"; // 30+ rotations - good
  return "/emojis/残念.png"; // needs more practice
};

// Dynamically import Phaser only on client side
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let Phaser: any = null;
if (typeof window !== "undefined") {
  import("phaser").then((module) => {
    Phaser = module.default;
  });
}

type GameState = "description" | "playing" | "result";

export default function NattoGamePage() {
  const gameContainerRef = useRef<HTMLDivElement>(null);
  const gameRef = useRef<Phaser.Game | null>(null);
  const [gameState, setGameState] = useState<GameState>("description");
  const [score, setScore] = useState(0);
  const [timeLeft, setTimeLeft] = useState(20);
  const [mixingQuality, setMixingQuality] = useState(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const [hasMixingStarted, setHasMixingStarted] = useState(false);
  const timerStarted = useRef(false);
  const scoreRef = useRef(0);

  const startGame = () => {
    setGameState("playing");
    setScore(0);
    setMixingQuality(0);
    setTimeLeft(20);
    setHasMixingStarted(false);
  };

  // Game timer - starts only when mixing begins, then runs continuously
  useEffect(() => {
    if (gameState !== "playing") return;

    // Start timer only when mixing begins for the first time
    if (hasMixingStarted && !timerStarted.current) {
      timerStarted.current = true;

      if (timerRef.current) clearInterval(timerRef.current);

      timerRef.current = setInterval(() => {
        setTimeLeft((prev) => {
          if (prev <= 1) {
            setGameState("result");
            if (timerRef.current) clearInterval(timerRef.current);

            // Save score to API
            const playerName =
              typeof window !== "undefined"
                ? localStorage.getItem("playerNickname") || "Player"
                : "Player";

            console.log("🎮 Saving score to API:", scoreRef.current);
            fetch("/api/scores", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                zone: "zone_6",
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

            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    }

    return () => {
      if (gameState !== "playing" && timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
        timerStarted.current = false;
      }
    };
  }, [gameState, hasMixingStarted, score]);

  useEffect(() => {
    if (gameState === "playing" && hasMixingStarted && !timerStarted.current) {
      setScore((prev) => prev);
    }
  }, [hasMixingStarted, gameState]);

  // Phaser game setup
  useEffect(() => {
    if (
      !gameContainerRef.current ||
      typeof window === "undefined" ||
      !Phaser ||
      gameState !== "playing"
    )
      return;

    class NattoScene extends Phaser.Scene {
      private beans: Phaser.Physics.Matter.Image[] = [];
      private beanConnections: Set<string> = new Set();
      private beanConnectionCount: Map<number, number> = new Map();
      private connectionsArray: string[] = [];
      private connectionCheckCounter = 0;
      private pointer: Phaser.Input.Pointer | null = null;
      private mixingProgress = 0;
      private lastPointerPos = { x: 0, y: 0 };
      private pointerSpeed = 0;
      private instantMixingQuality = 0;
      private mixingQualitySmoothed = 0;
      private graphics: Phaser.GameObjects.Graphics | null = null;
      private bowlGraphics: Phaser.GameObjects.Graphics | null = null;
      private particles: Phaser.GameObjects.Particles.ParticleEmitter | null =
        null;
      private bowlRadius = 0;
      private centerX = 0;
      private centerY = 0;
      private totalRotation = 0;
      private lastAngle = 0;
      private onMixingStart?: () => void;

      constructor(onMixingStartCallback?: () => void) {
        super({ key: "NattoScene" });
        this.onMixingStart = onMixingStartCallback;
      }

      create() {
        const { width, height } = this.cameras.main;
        this.centerX = width / 2;
        this.centerY = width < 768 ? height * 0.65 - 80 : height / 2;
        this.bowlRadius = 150;

        this.bowlGraphics = this.add.graphics();
        if (this.bowlGraphics) {
          this.bowlGraphics.setDepth(-1);
          this.drawBowl();
        }

        this.graphics = this.add.graphics();
        this.scale.on("resize", this.handleResize, this);

        this.input.setTopOnly(false);

        // Create simple particle texture
        const particleTexture = this.add.graphics();
        particleTexture.fillStyle(0xffffff);
        particleTexture.fillCircle(2, 2, 2);
        particleTexture.generateTexture("simpleParticle", 4, 4);
        particleTexture.destroy();

        // Create particle system for mixing effects
        this.particles = this.add.particles(0, 0, "simpleParticle", {
          lifespan: 600,
          speed: { min: 30, max: 80 },
          scale: { start: 0.8, end: 0 },
          alpha: { start: 0.7, end: 0 },
          gravityY: 50,
          emitting: false,
        });
        if (this.particles) {
          this.particles.setDepth(5);
        }

        // Create circular boundary (matches visual bowl)
        const segments = 32;
        const boundaryRadius = this.bowlRadius - 2; // Just slightly inside visual bowl
        for (let i = 0; i < segments; i++) {
          const angle1 = (i / segments) * Math.PI * 2;
          const angle2 = ((i + 1) / segments) * Math.PI * 2;
          const x1 = this.centerX + Math.cos(angle1) * boundaryRadius;
          const y1 = this.centerY + Math.sin(angle1) * boundaryRadius;
          const x2 = this.centerX + Math.cos(angle2) * boundaryRadius;
          const y2 = this.centerY + Math.sin(angle2) * boundaryRadius;

          const wall = this.matter.add.rectangle(
            (x1 + x2) / 2,
            (y1 + y2) / 2,
            Phaser.Math.Distance.Between(x1, y1, x2, y2),
            10,
            {
              isStatic: true,
              angle: Math.atan2(y2 - y1, x2 - x1),
            }
          );
          wall.render.visible = false;
        }

        // Create beans
        const beanCount = 200;
        const beanRadius = 5;
        const beanConfig = {
          restitution: 0.2,
          friction: 0.9,
          frictionAir: 0.2,
          density: 0.003,
        };

        for (let i = 0; i < beanCount; i++) {
          const angle = (i / beanCount) * Math.PI * 2;
          const radius =
            Math.random() * (this.bowlRadius - beanRadius * 3) + beanRadius * 2;
          const x = this.centerX + Math.cos(angle) * radius;
          const y = this.centerY + Math.sin(angle) * radius;

          const bean = this.matter.add.circle(x, y, beanRadius, beanConfig);
          this.beans.push(bean as unknown as Phaser.Physics.Matter.Image);
        }

        this.pointer = this.input.pointer1;
        this.lastPointerPos = { x: this.centerX, y: this.centerY };
        this.lastAngle = 0;
      }

      drawBowl() {
        if (!this.bowlGraphics) return;
        this.bowlGraphics.fillStyle(0x4a3728, 1);
        this.bowlGraphics.fillCircle(
          this.centerX,
          this.centerY,
          this.bowlRadius + 10
        );
        this.bowlGraphics.fillStyle(0xd4c5b0, 1);
        this.bowlGraphics.fillCircle(
          this.centerX,
          this.centerY,
          this.bowlRadius
        );
        this.bowlGraphics.fillStyle(0xbfae96, 0.5);
        this.bowlGraphics.fillCircle(
          this.centerX,
          this.centerY + 3,
          this.bowlRadius - 5
        );
      }

      handleResize(gameSize: { width: number; height: number }) {
        this.centerX = gameSize.width / 2;
        // Move center up by 30 pixels on mobile to allow beans to reach top
        this.centerY =
          gameSize.width < 768
            ? gameSize.height * 0.6 - 30
            : gameSize.height / 2;
        if (this.bowlGraphics) {
          this.bowlGraphics.clear();
          this.drawBowl();
        }
      }

      update() {
        this.pointer = this.input.pointer1.isDown
          ? this.input.pointer1
          : this.input.activePointer;
        if (!this.pointer) return;

        const dx = this.pointer.x - this.lastPointerPos.x;
        const dy = this.pointer.y - this.lastPointerPos.y;
        this.pointerSpeed = Math.sqrt(dx * dx + dy * dy);

        const currentPointerAngle = Math.atan2(
          this.pointer.y - this.centerY,
          this.pointer.x - this.centerX
        );

        if (this.pointer.isDown) {
          if (!hasMixingStarted) {
            this.onMixingStart?.();
          }

          let deltaAngle = currentPointerAngle - this.lastAngle;
          if (deltaAngle > Math.PI) deltaAngle -= Math.PI * 2;
          if (deltaAngle < -Math.PI) deltaAngle += Math.PI * 2;
          this.totalRotation += deltaAngle;
          this.lastAngle = currentPointerAngle;
        }

        this.lastPointerPos = { x: this.pointer.x, y: this.pointer.y };

        if (this.pointer.isDown && this.pointerSpeed > 1) {
          this.instantMixingQuality = Math.min(
            100,
            (this.pointerSpeed / 60) * 100
          );
        } else {
          this.instantMixingQuality = Math.max(
            0,
            this.instantMixingQuality - 10
          );
        }

        const smoothingFactor = 0.1;
        this.mixingQualitySmoothed =
          this.mixingQualitySmoothed * (1 - smoothingFactor) +
          this.instantMixingQuality * smoothingFactor;

        if (this.particles && this.pointer!.isDown && this.pointerSpeed > 25) {
          const emitX =
            this.centerX + (Math.random() - 0.5) * this.bowlRadius * 0.8;
          const emitY =
            this.centerY + (Math.random() - 0.5) * this.bowlRadius * 0.8;
          this.particles.emitParticleAt(emitX, emitY);
        }

        this.beans.forEach((bean) => {
          const body = bean as unknown as MatterJS.BodyType;
          const bx = body.position.x;
          const by = body.position.y;

          if (this.pointer!.isDown && this.pointerSpeed > 1) {
            const beanAngleFromCenter = Math.atan2(
              by - this.centerY,
              bx - this.centerX
            );

            const crossProduct =
              dx * (this.pointer!.y - this.centerY) -
              dy * (this.pointer!.x - this.centerX);
            const rotationDirection = -Math.sign(crossProduct);

            const tangentAngle =
              beanAngleFromCenter + (Math.PI / 2) * rotationDirection;
            const rotationForce = this.pointerSpeed * 0.000009;

            this.matter.applyForce(body, {
              x: Math.cos(tangentAngle) * rotationForce,
              y: Math.sin(tangentAngle) * rotationForce,
            });

            const distToPointer = Phaser.Math.Distance.Between(
              this.pointer!.x,
              this.pointer!.y,
              bx,
              by
            );
            const influence = Math.max(0, 1 - distToPointer / 150);

            if (influence > 0.2) {
              const angle = Math.atan2(
                this.pointer!.y - by,
                this.pointer!.x - bx
              );
              const force = this.pointerSpeed * influence * 0.00002;

              this.matter.applyForce(body, {
                x: Math.cos(angle) * force,
                y: Math.sin(angle) * force,
              });

              this.mixingProgress += influence * this.pointerSpeed * 0.000375;
            }
          }

          const distFromCenter = Phaser.Math.Distance.Between(
            bx,
            by,
            this.centerX,
            this.centerY
          );
          if (distFromCenter > this.bowlRadius - 5) {
            const angleToCenter = Math.atan2(
              this.centerY - by,
              this.centerX - bx
            );
            const pushForce = 0.01;

            this.matter.applyForce(body, {
              x: Math.cos(angleToCenter) * pushForce,
              y: Math.sin(angleToCenter) * pushForce,
            });

            const velocity = body.velocity;
            const speed = Math.sqrt(
              velocity.x * velocity.x + velocity.y * velocity.y
            );
            if (speed > 3) {
              this.matter.setVelocity(
                body,
                (velocity.x / speed) * 3,
                (velocity.y / speed) * 3
              );
            }
          }
        });

        if (this.graphics) {
          this.graphics.clear();
          this.graphics.setDepth(0);

          this.connectionCheckCounter++;
          const shouldCheckConnections = this.connectionCheckCounter % 5 === 0;

          if (
            this.mixingProgress > 150 &&
            shouldCheckConnections &&
            this.pointer!.isDown
          ) {
            const connectionRadius = 30;
            const maxConnectionsPerBean = 6;
            const connectionRadiusSq = connectionRadius * connectionRadius;
            const beansToCheck = Math.min(50, this.beans.length);
            const startIndex =
              (this.connectionCheckCounter * beansToCheck) % this.beans.length;

            for (let i = 0; i < beansToCheck; i++) {
              const beanIndex = (startIndex + i) % this.beans.length;
              const currentConnections =
                this.beanConnectionCount.get(beanIndex) || 0;

              if (currentConnections >= maxConnectionsPerBean) continue;

              const bean1 = this.beans[
                beanIndex
              ] as unknown as MatterJS.BodyType;
              const nearbyBeans: {
                bean: MatterJS.BodyType;
                distSq: number;
                index: number;
              }[] = [];

              for (let j = 1; j <= 30 && j < this.beans.length; j++) {
                const checkIndex = (beanIndex + j) % this.beans.length;
                const targetConnections =
                  this.beanConnectionCount.get(checkIndex) || 0;

                if (targetConnections >= maxConnectionsPerBean) continue;

                const bean2 = this.beans[
                  checkIndex
                ] as unknown as MatterJS.BodyType;
                const dx = bean1.position.x - bean2.position.x;
                const dy = bean1.position.y - bean2.position.y;
                const distSq = dx * dx + dy * dy;

                if (distSq < connectionRadiusSq) {
                  nearbyBeans.push({ bean: bean2, distSq, index: checkIndex });
                }
              }

              if (nearbyBeans.length === 0) continue;

              nearbyBeans.sort((a, b) => a.distSq - b.distSq);

              const availableSlots = maxConnectionsPerBean - currentConnections;
              const connectionsToCreate = Math.min(
                availableSlots,
                nearbyBeans.length
              );

              for (let k = 0; k < connectionsToCreate; k++) {
                const targetBean = nearbyBeans[k];
                if (!targetBean) continue;

                const dist = Math.sqrt(targetBean.distSq);
                const connectionKey =
                  beanIndex < targetBean.index
                    ? `${beanIndex}-${targetBean.index}`
                    : `${targetBean.index}-${beanIndex}`;

                if (this.beanConnections.has(connectionKey)) continue;

                const distanceFactor = 1 - dist / connectionRadius;
                const progressFactor = Math.min(1, this.mixingProgress / 800);
                const stringStrength = distanceFactor * progressFactor;

                if (stringStrength > 0.15 && dist < connectionRadius) {
                  this.beanConnections.add(connectionKey);
                  this.beanConnectionCount.set(
                    beanIndex,
                    currentConnections + 1
                  );
                  this.beanConnectionCount.set(
                    targetBean.index,
                    (this.beanConnectionCount.get(targetBean.index) || 0) + 1
                  );
                  this.connectionsArray = Array.from(this.beanConnections);
                }
              }
            }
          }

          // Check and remove overstretched connections
          const maxConnectionDistance = 30 * 4; // connectionRadius * 1.5
          const maxDistanceSq = maxConnectionDistance * maxConnectionDistance;

          for (const connectionKey of this.beanConnections) {
            const [index1, index2] = connectionKey.split("-").map(Number);
            if (index1 >= this.beans.length || index2 >= this.beans.length)
              continue;

            const bean1 = this.beans[index1] as unknown as MatterJS.BodyType;
            const bean2 = this.beans[index2] as unknown as MatterJS.BodyType;

            const dx = bean1.position.x - bean2.position.x;
            const dy = bean1.position.y - bean2.position.y;
            const distanceSq = dx * dx + dy * dy;

            if (distanceSq > maxDistanceSq) {
              // Remove the connection
              this.beanConnections.delete(connectionKey);
              this.beanConnectionCount.set(
                index1,
                (this.beanConnectionCount.get(index1) || 0) - 1
              );
              this.beanConnectionCount.set(
                index2,
                (this.beanConnectionCount.get(index2) || 0) - 1
              );
            }
          }

          // Draw strings under beans (80%)
          if (this.beanConnections.size > 0) {
            if (this.connectionsArray.length !== this.beanConnections.size) {
              this.connectionsArray = Array.from(this.beanConnections);
            }

            const splitIndex = Math.floor(this.connectionsArray.length * 0.8);

            for (let i = 0; i < splitIndex; i++) {
              const connectionKey = this.connectionsArray[i];
              const [index1, index2] = connectionKey.split("-").map(Number);
              if (index1 >= this.beans.length || index2 >= this.beans.length)
                continue;

              const bean1 = this.beans[index1] as unknown as MatterJS.BodyType;
              const bean2 = this.beans[index2] as unknown as MatterJS.BodyType;

              this.graphics.lineStyle(2, 0xffffff, 0.5);
              this.graphics.beginPath();
              this.graphics.moveTo(bean1.position.x, bean1.position.y);
              this.graphics.lineTo(bean2.position.x, bean2.position.y);
              this.graphics.strokePath();
            }
          }

          // Draw beans
          this.beans.forEach((bean) => {
            const body = bean as unknown as MatterJS.BodyType;
            this.graphics!.fillStyle(0x8b7355, 1);
            this.graphics!.fillCircle(body.position.x, body.position.y, 7);
            this.graphics!.fillStyle(0xffe5b4, 0.6);
            this.graphics!.fillCircle(
              body.position.x - 2,
              body.position.y - 2,
              3
            );
          });

          // Draw strings on top (20%)
          if (this.beanConnections.size > 0) {
            const splitIndex = Math.floor(this.connectionsArray.length * 0.8);

            for (let i = splitIndex; i < this.connectionsArray.length; i++) {
              const connectionKey = this.connectionsArray[i];
              const [index1, index2] = connectionKey.split("-").map(Number);
              if (index1 >= this.beans.length || index2 >= this.beans.length)
                continue;

              const bean1 = this.beans[index1] as unknown as MatterJS.BodyType;
              const bean2 = this.beans[index2] as unknown as MatterJS.BodyType;

              this.graphics.lineStyle(2, 0xffffff, 0.5);
              this.graphics.beginPath();
              this.graphics.moveTo(bean1.position.x, bean1.position.y);
              this.graphics.lineTo(bean2.position.x, bean2.position.y);
              this.graphics.strokePath(); 
            }
          }

          this.graphics.setAlpha(1);
        }

        if (this.mixingQualitySmoothed > 85) {
          this.cameras.main.shake(200, 0.005);
        }

        const totalDegrees = Math.abs((this.totalRotation * 180) / Math.PI);
        const completeRotations = Math.floor(totalDegrees / 360);
        const newScore = Math.min(150, completeRotations * 2); // Max 150 points

        scoreRef.current = newScore;
        setScore(newScore);
        setMixingQuality(Math.floor(this.mixingQualitySmoothed));
      }
    }

    const config: Phaser.Types.Core.GameConfig = {
      type: Phaser.AUTO,
      parent: gameContainerRef.current,
      width: window.innerWidth,
      height: window.innerHeight,
      transparent: true,
      physics: {
        default: "matter",
        matter: {
          gravity: { x: 0, y: 0 },
          debug: false,
          enableSleeping: false,
          positionIterations: 6,
          velocityIterations: 4,
        },
      },
      scene: new NattoScene(() => setHasMixingStarted(true)),
      scale: {
        mode: Phaser.Scale.RESIZE,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        pixelArt: false,
        antialias: false,
        roundPixels: true,
      },
      input: {
        activePointers: 1,
        touch: {
          capture: true,
        },
      },
    };

    gameRef.current = new Phaser.Game(config);

    const handleResize = () => {
      if (gameRef.current) {
        gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
      }
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (gameRef.current) {
        gameRef.current.destroy(true);
        gameRef.current = null;
      }
    };
  }, [gameState, hasMixingStarted]);

  // Reset game state when leaving result screen
  useEffect(() => {
    if (gameState !== "result") {
      setScore(0);
      setTimeLeft(20);
      setMixingQuality(0);
      setHasMixingStarted(false);
      timerStarted.current = false;
    }
  }, [gameState]);

  const fadeVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen py-2">
      <Header />
      <div className="w-full h-16 flex items-center justify-between px-8 relative z-50">
        <BackBtn />
      </div>
      {gameState === "playing" && (
        <div className="w-full h-16 flex items-center justify-between px-8 mt-4 relative z-50 pointer-events-none">
          <div className="px-4 py-2 bg-theme-purple text-white rounded-full font-semibold text-sm pointer-events-auto">
            スコア: {score}
          </div>
          <div className="px-4 py-2 bg-theme-purple text-white rounded-full font-semibold text-sm pointer-events-auto">
            時間: {timeLeft}s
          </div>
        </div>
      )}

      <main className="flex flex-col items-center justify-center px-8 w-full flex-1 text-center">
        <AnimatePresence mode="wait">
          {gameState === "description" && (
            <motion.div
              key="description"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center space-y-6"
            >
              <div className="space-y-4 p-6 bg-theme-purple rounded-3xl">
                <div className="relative flex items-center justify-center">
                  <h1 className="text-3xl font-bold">納豆を混ぜ</h1>
                  <Image
                    src="/emojis/頑張れ.png"
                    alt="頑張れ"
                    width={60}
                    height={60}
                  />
                </div>
                <p className="text-lg text-gray-900 font-semibold leading-relaxed">
                  指で円を描いて納豆をかき混ぜよう！
                  <br />
                  制限時間内に速く
                  <br />
                  均等に混ぜるほど
                  <br />
                  ポイントが増えます
                  <br />
                </p>
              </div>
              <button
                onClick={startGame}
                className="px-8 py-3 bg-theme-yellow rounded-full font-semibold active:scale-95 transition-transform"
              >
                始める
              </button>
            </motion.div>
          )}

          {gameState === "result" && (
            <motion.div
              key="result"
              variants={fadeVariants}
              initial="initial"
              animate="animate"
              exit="exit"
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center space-y-6"
            >
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{
                  type: "spring",
                  stiffness: 200,
                  damping: 15,
                  delay: 0.2,
                }}
              >
                <Image
                  src={getResultSticker(score)}
                  alt="Result sticker"
                  width={300}
                  height={300}
                  className="drop-shadow-lg"
                />
              </motion.div>
              <div className="space-y-4 p-6 bg-theme-purple rounded-2xl relative overflow-hidden">
                {/* Rainbow Congratulations */}
                <h1 className="text-2xl font-bold flex justify-center flex-wrap">
                  {"Congratulations!".split("").map((letter, i) => (
                    <motion.span
                      key={i}
                      initial={{ y: -20, opacity: 0 }}
                      animate={{ y: 0, opacity: 1 }}
                      transition={{
                        delay: 0.5 + i * 0.05,
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
                </h1>

                <div className="relative">
                  <motion.p
                    className="text-lg text-gray-900 font-bold leading-relaxed"
                    initial={{ scale: 0.5, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.8, type: "spring", stiffness: 200 }}
                  >
                    {score} points!
                  </motion.p>
                </div>
              </div>
              <Link
                href="/controller/"
                className="px-8 py-3 bg-theme-yellow text-black rounded-full font-semibold active:scale-95 transition-transform"
              >
                コントローラーに戻る
              </Link>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* Game overlay */}
      <AnimatePresence mode="wait">
        {gameState === "playing" && (
          <motion.div
            key="playing"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            className="fixed inset-0 z-40"
          >
            {/* Phaser Game Container */}
            <div
              ref={gameContainerRef}
              className="w-full h-full touch-none"
              style={{ touchAction: "none" }}
            />

            {/* Game UI */}
            <div className="absolute bottom-4 left-1/2 transform -translate-x-1/2 z-50 px-4 py-2 bg-theme-purple text-white rounded-full font-semibold text-sm pointer-events-none">
              混ぜ具合: {mixingQuality}%
            </div>

            {/* START button - positioned below the bowl */}
            <AnimatePresence>
              {!hasMixingStarted && (
                <motion.div
                  className="absolute top-[77%] left-1/2 transform -translate-x-1/2 z-50"
                  initial={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.8 }}
                  transition={{ duration: 0.2 }}
                >
                  <button className="px-6 py-1 bg-theme-yellow text-theme-brown rounded-full font-bold text-lg shadow-md border-none">
                    START
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
