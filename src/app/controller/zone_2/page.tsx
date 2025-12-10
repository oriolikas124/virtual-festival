"use client";
// this is quiz games page

import Header from "@/components/layout/Header";
import BackBtn from "@/components/ui/BackBtn";
import Link from "next/link";
import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import quizData from "@/../data/zone_2/data.json";
import Image from "next/image";

interface Question {
  id: number;
  question: string;
  hint: string;
  answers: string[];
  correct_answer: string;
  scores: number[];
}

interface QuestionResult {
  questionNumber: number;
  userAnswer: string | null;
  correctAnswer: string;
  isCorrect: boolean;
}

type StateType = "start" | "quiz" | "result";

export default function Page() {
  const [QData, setQData] = useState<Question[]>([]);
  const [currentState, setCurrentState] = useState<StateType>("start");
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [miniTimer, setMiniTimer] = useState(15);
  const [totalTimer, setTotalTimer] = useState(0);
  const [totalScore, setTotalScore] = useState(0);
  const [selectedAnswer, setSelectedAnswer] = useState<string | null>(null);
  const [isAnswered, setIsAnswered] = useState(false);
  const [quizResults, setQuizResults] = useState<QuestionResult[]>([]);

  const miniTimerRef = useRef<NodeJS.Timeout | null>(null);
  const totalTimerRef = useRef<NodeJS.Timeout | null>(null);
  const isProcessingTimeout = useRef<boolean>(false);
  const scoreRef = useRef(0);

  // Load and shuffle questions
  useEffect(() => {
    const shuffled = [...quizData].sort(() => Math.random() - 0.5);
    setQData(shuffled);
  }, []);

  // Save score when quiz finishes
  useEffect(() => {
    if (currentState === "result" && scoreRef.current > 0) {
      const playerName =
        typeof window !== "undefined"
          ? localStorage.getItem("playerNickname") || "Player"
          : "Player";

      console.log("🎮 Saving score to API:", scoreRef.current);
      fetch("/api/scores", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          zone: "zone_2",
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
  }, [currentState]);

  const moveToNextQuestion = useCallback(() => {
    // Check if we should move to next question or end quiz
    if (currentQuestionIndex < QData.length - 1) {
      // Still have more questions, move to next
      // Reset state in batch
      setCurrentQuestionIndex((prev) => {
        return prev + 1;
      });
      setMiniTimer(15);
      setSelectedAnswer(null);
      setIsAnswered(false);
    } else {
      console.log("Quiz finished, going to result");
      // This was the last question, go to result
      setCurrentState("result");
      // Clear timers when quiz ends
      if (miniTimerRef.current) clearInterval(miniTimerRef.current);
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    }
  }, [currentQuestionIndex, QData.length]);

  const handleTimeout = useCallback(() => {
    // Prevent double timeout calls
    if (isProcessingTimeout.current) {
      return;
    }

    isProcessingTimeout.current = true;

    // When timeout, show correct answer briefly then move to next (no points added)
    setIsAnswered(true);
    // Don't set selectedAnswer - this marks it as a timeout

    const currentQuestion = QData[currentQuestionIndex];
    const result: QuestionResult = {
      questionNumber: currentQuestionIndex + 1,
      userAnswer: null,
      correctAnswer: currentQuestion.correct_answer,
      isCorrect: false,
    };
    setQuizResults((prev) => [...prev, result]);

    // Wait 1.5 seconds before moving to next question (same as when answering)
    setTimeout(() => {
      isProcessingTimeout.current = false; // Reset flag
      moveToNextQuestion();
    }, 1500);
  }, [moveToNextQuestion, QData, currentQuestionIndex]);

  // Mini timer countdown (15 seconds per question)
  useEffect(() => {
    if (currentState === "quiz" && !isAnswered) {
      miniTimerRef.current = setInterval(() => {
        setMiniTimer((prev) => {
          if (prev <= 1) {
            handleTimeout();
            return 15;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      // Clear mini timer if not in quiz state
    }

    return () => {
      if (miniTimerRef.current) {
        clearInterval(miniTimerRef.current);
      }
    };
  }, [
    currentState,
    currentQuestionIndex,
    isAnswered,
    miniTimer,
    handleTimeout,
  ]);

  // Total timer (counts up from start to end)
  useEffect(() => {
    if (currentState === "quiz") {
      totalTimerRef.current = setInterval(() => {
        setTotalTimer((prev) => prev + 1);
      }, 1000);
    }

    return () => {
      if (totalTimerRef.current) clearInterval(totalTimerRef.current);
    };
  }, [currentState]);

  const handleAnswerClick = (answer: string) => {
    if (isAnswered) return;

    setSelectedAnswer(answer);
    setIsAnswered(true);

    const currentQuestion = QData[currentQuestionIndex];
    const isCorrect = answer === currentQuestion.correct_answer;

    if (isCorrect) {
      // Calculate score based on remaining time
      const timeLeft = miniTimer;
      let score = 0;

      if (timeLeft > 12) score = currentQuestion.scores[4]; // 20 points
      else if (timeLeft > 9) score = currentQuestion.scores[3]; // 15 points
      else if (timeLeft > 6) score = currentQuestion.scores[2]; // 12 points
      else if (timeLeft > 3) score = currentQuestion.scores[1]; // 7 points
      else score = currentQuestion.scores[0]; // 3 points

      setTotalScore((prev) => {
        const newScore = prev + score;
        scoreRef.current = newScore;
        return newScore;
      });
    }

    const result: QuestionResult = {
      questionNumber: currentQuestionIndex + 1,
      userAnswer: answer,
      correctAnswer: currentQuestion.correct_answer,
      isCorrect: isCorrect,
    };
    setQuizResults((prev) => [...prev, result]);

    // Wait 1.5 seconds before moving to next question
    setTimeout(() => {
      moveToNextQuestion();
    }, 1500);
  };

  const startQuiz = () => {
    setCurrentState("quiz");
    setCurrentQuestionIndex(0);
    setMiniTimer(15);
    setTotalTimer(0);
    setTotalScore(0);
    setSelectedAnswer(null);
    setIsAnswered(false);
    setQuizResults([]);
  };

  const restartQuiz = () => {
    // Reshuffle questions
    const shuffled = [...QData].sort(() => Math.random() - 0.5);
    setQData(shuffled);
    startQuiz();
  };

  const fadeVariants = {
    initial: { opacity: 0, y: 20 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0, y: -20 },
  };

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}:${secs.toString().padStart(2, "0")}`;
  };

  const renderContent = () => {
    switch (currentState) {
      case "start":
        return (
          <motion.div
            key="start"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center space-y-6"
          >
            <div className="space-y-4 p-6 bg-theme-purple rounded-3xl">
              <h1 className="text-3xl font-bold">山手線クイズ</h1>
              <p className="text-lg font-semibold leading-relaxed text-gray-900 max-w-md">
                山手線について{QData.length}問のクイズです。
                <br />
                各問題は15秒以内に答えてください。
                <br />
                早く答えるほど高得点！
              </p>
            </div>
            <button
              onClick={startQuiz}
              className="px-8 py-3 bg-theme-yellow rounded-full font-semibold active:scale-95 transition-transform"
            >
              スタート
            </button>
          </motion.div>
        );

      case "quiz":
        // Check if we have a valid question
        if (!QData[currentQuestionIndex]) {
          // If no question exists, it means we're transitioning to result
          return null;
        }
        const currentQuestion = QData[currentQuestionIndex];

        return (
          <motion.div
            key={`quiz-${currentQuestionIndex}`}
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center space-y-6 w-full max-w-3xl"
          >
            {/* Timers */}
            <div className="w-full flex justify-between items-center px-4">
              <div className="text-lg text-white font-semibold">
                問題 {currentQuestionIndex + 1}/{QData.length}
              </div>
              <div className="flex gap-4">
                <div
                  className={`flex gap-2 px-4 py-2 rounded-lg font-bold ${
                    miniTimer <= 5
                      ? "bg-red-400/60 text-white"
                      : "bg-theme-purple/80 text-white"
                  }`}
                >
                  <Image
                    src="/icons/time.svg"
                    alt="Mini Timer Icon"
                    width={24}
                    height={24}
                  />
                  {miniTimer}秒
                </div>
              </div>
            </div>

            {/* Question */}
            <div className="w-full h-60 p-4 bg-linear-to-r bg-gray-200/80 rounded-2xl overflow-hidden relative">
              <Image
                src={`/images/zone_2/zone_2_bg.jpg`}
                alt="Question Image"
                fill
                className="object-cover absolute inset-0 blur-xs"
                priority
              />
              <div className="relative z-10 flex flex-col justify-center h-full">
                <h2 className="text-2xl font-bold text-white mb-6 drop-shadow-lg">
                  {currentQuestion.question}
                </h2>
                <p className="text-md text-white italic drop-shadow-lg">
                  <strong>ヒント: </strong>
                  {currentQuestion.hint}
                </p>
              </div>
            </div>

            {/* Answers */}
            <div className="grid grid-cols-2 gap-4 w-full">
              {currentQuestion.answers.map((answer, index) => {
                const isSelected = selectedAnswer === answer;
                const isCorrect = answer === currentQuestion.correct_answer;
                const showResult = isAnswered;
                const isTimeout = isAnswered && !selectedAnswer; // Timeout case

                let buttonClass =
                  "p-6 border-4 bg-theme-yellow rounded-lg font-semibold transition-all";

                if (!showResult) {
                  buttonClass += "";
                } else if (isTimeout) {
                  // Timeout: only highlight correct answer
                  if (isCorrect) {
                    buttonClass +=
                      " border-green-500 bg-green-100 text-green-700 shadow-lg shadow-green-500/50";
                  } else {
                    buttonClass +=
                      " border-gray-400 bg-gray-100 text-gray-500 opacity-40";
                  }
                } else if (isSelected) {
                  if (isCorrect) {
                    buttonClass +=
                      " border-green-500 bg-green-100 text-green-700 shadow-lg shadow-green-500/50";
                  } else {
                    buttonClass +=
                      " border-red-500 bg-red-100 text-red-700 shadow-lg shadow-red-500/50";
                  }
                } else if (isCorrect) {
                  buttonClass +=
                    " border-green-500 bg-green-100 text-green-700 shadow-lg shadow-green-500/50";
                } else {
                  buttonClass +=
                    " border-gray-400 bg-gray-100 text-gray-500 opacity-40";
                }

                return (
                  <motion.button
                    key={index}
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    transition={{ delay: index * 0.1, duration: 0.3 }}
                    onClick={() => handleAnswerClick(answer)}
                    disabled={isAnswered}
                    className={buttonClass}
                  >
                    {answer}
                  </motion.button>
                );
              })}
            </div>

            <div className="px-4 py-2 bg-gray-400 text-white rounded-full font-bold">
              合計: {formatTime(totalTimer)}
            </div>

            {/* Score display */}
            <div className="text-xl font-bold text-theme-purple">
              現在のスコア: {totalScore}点
            </div>
          </motion.div>
        );

      case "result":
        return (
          <motion.div
            key="result"
            variants={fadeVariants}
            initial="initial"
            animate="animate"
            exit="exit"
            transition={{ duration: 0.3 }}
            className="flex flex-col items-center space-y-6 w-full max-w-3xl"
          >
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.4 }}
              className="w-full p-8 bg-purple-300/60 rounded-4xl flex flex-col items-center justify-center space-y-2"
            >
              <h1 className="text-5xl font-bold text-black">Congratulation</h1>
              <p className="text-xl text-black font-bold">
                <span className="text-2xl text-red-500 font-bold mr-1">
                  {formatTime(totalTimer)}
                </span>
                秒でクリアしました！
              </p>
              <p className="text-4xl font-bold text-green-500">
                {totalScore}
                <span className="text-2xl text-black"> Points</span>
              </p>

              <div className="w-full mt-1">
                <div className="bg-purple-200/60 rounded-xl p-6">
                  <div className="grid grid-cols-2 gap-4 pb-2">
                    <div className="text-center font-bold text-black">
                      あなたの選択
                    </div>
                    <div className="text-center font-bold text-black">正解</div>
                  </div>
                  <div className="border-b-2 border-black mb-4"></div>
                  <div className="grid grid-cols-2 gap-4 max-h-96 overflow-y-auto">
                    <div className="space-y-2">
                      {quizResults.map((result, index) => (
                        <div key={index} className="text-center text-black">
                          問{result.questionNumber}.{" "}
                          <span
                            className={
                              result.isCorrect
                                ? "text-green-600 font-bold"
                                : "text-red-600 font-bold"
                            }
                          >
                            {result.userAnswer || "~~駅"}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className="space-y-2 border-l-2 border-black pl-4">
                      {quizResults.map((result, index) => (
                        <div
                          key={index}
                          className="text-center text-green-600 font-bold"
                        >
                          {result.correctAnswer}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
            {/* <button
              onClick={restartQuiz}
              className="px-8 py-3 bg-violet-500 text-white rounded-lg font-semibold hover:bg-violet-600 transition-colors"
            >
              もう一度挑戦
            </button> */}
            <Link
              href="/controller/"
              className="px-8 py-3 bg-theme-yellow text-black rounded-full font-semibold active:scale-95 transition-transform"
            >
              コントローラーに戻る
            </Link>
          </motion.div>
        );

      default:
        return null;
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
