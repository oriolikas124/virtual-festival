"use client";
import { useEffect, useState } from "react";
import { InfiniteGallery } from "@/components/ui/infinite-gallery";
import Link from "next/link";
import Image from "next/image";

interface GameRanking {
  title: string;
  players: Array<{ name: string; points: number }>;
}

interface RankingEntry {
  name: string;
  score: number;
}

export default function DashboardPage() {
  const [gameRankings, setGameRankings] = useState<GameRanking[]>([
    {
      title: "東京電車アナウンス",
      players: [],
    },
    {
      title: "富士山パズル",
      players: [],
    },
    {
      title: "鹿せんべいチャレンジ",
      players: [],
    },
    {
      title: "納豆混ぜゲーム",
      players: [],
    },
  ]);

  const [totalRanking, setTotalRanking] = useState<
    Array<{ name: string; points: number }>
  >([]);

  const [galleryImages, setGalleryImages] = useState<string[]>([]);

  // Fetch gallery images
  useEffect(() => {
    const fetchImages = async () => {
      try {
        const response = await fetch("/api/gallery-images");
        const data = await response.json();
        setGalleryImages(data.images || []);
      } catch (error) {
        console.error("❌ Error fetching gallery images:", error);
      }
    };

    fetchImages();
    // Refresh every 60 seconds to pick up new images
    const interval = setInterval(fetchImages, 60000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    // Fetch scores from API
    const fetchScores = async () => {
      try {
        const response = await fetch("/api/scores");
        const data = await response.json();

        console.log("📊 Scores fetched from API:", data);

        setGameRankings([
          {
            title: "東京電車アナウンス",
            players: (data.zone_2 || []).map((p: RankingEntry) => ({
              name: p.name,
              points: p.score,
            })),
          },
          {
            title: "富士山パズル",
            players: (data.zone_3 || []).map((p: RankingEntry) => ({
              name: p.name,
              points: p.score,
            })),
          },
          {
            title: "鹿せんべいチャレンジ",
            players: (data.zone_4 || []).map((p: RankingEntry) => ({
              name: p.name,
              points: p.score,
            })),
          },
          {
            title: "納豆混ぜゲーム",
            players: (data.zone_6 || []).map((p: RankingEntry) => ({
              name: p.name,
              points: p.score,
            })),
          },
        ]);

        setTotalRanking(
          (data.total || []).map((p: RankingEntry) => ({
            name: p.name,
            points: p.score,
          }))
        );
      } catch (error) {
        console.error("❌ Error fetching scores:", error);
      }
    };

    // Fetch immediately
    fetchScores();

    // Then fetch every 20 seconds
    const interval = setInterval(fetchScores, 20000);

    return () => clearInterval(interval);
  }, []);

  // Rankings will be populated from live data in the future; mock logic removed

  return (
    <div
      className="flex flex-col min-h-screen p-6 bg-cover bg-center bg-no-repeat"
      style={{ backgroundImage: "url(/background/db_background.jpg)" }}
    >
      {/* Top Section: 4 Ranking Tables + 1 Image */}
      <div className="h-110 grid grid-cols-5 gap-4 mb-8">
        {gameRankings.map((game, idx) => (
          <div
            key={idx}
            className="rounded-2xl shadow-lg border-2 flex flex-col"
            style={{ borderColor: "#B3A0FF", backgroundColor: "#242833" }}
          >
            <div
              className="text-center font-bold text-black text-xl py-3 px-4 m-0"
              style={{
                backgroundColor: "#B3A0FF",
                borderTopLeftRadius: "14px",
                borderTopRightRadius: "14px",
              }}
            >
              {game.title}
            </div>
            <div className="relative flex-1">
              <table className="w-full text-sm border-collapse">
                <colgroup>
                  <col className="w-12" />
                  <col />
                  <col className="w-20" />
                </colgroup>
                <thead>
                  <tr className="border-b border-white bg-[#242833]">
                    <th className="px-3 py-3"></th>
                    <th className="px-3 py-3 text-center font-semibold text-white text-lg">
                      Player
                    </th>
                    <th className="px-3 py-3 text-center font-semibold text-white text-lg">
                      Points
                    </th>
                  </tr>
                </thead>
                <tbody className="min-h-[200px]">
                  {game.players.slice(0, 3).map((p, i) => (
                    <tr key={i}>
                      <td className="px-3 pt-2 pb-2 text-center text-white text-xl font-semibold">
                        {i + 1}
                      </td>
                      <td className="px-3 pt-2 pb-2 text-center text-white text-xl font-semibold">
                        {p.name}
                      </td>
                      <td className="px-3 pt-2 pb-2 text-center text-white text-xl font-semibold">
                        {p.points}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {/* Vertical lines overlay to extend to bottom regardless of rows */}
              <div className="pointer-events-none absolute inset-0">
                <div className="absolute top-0 bottom-0 left-12 w-px bg-white" />
                <div className="absolute top-0 bottom-0 right-20 w-px bg-white" />
              </div>
            </div>
          </div>
        ))}
        {/* 5th Column: Fighting Image */}
        <div
          className="rounded-2xl shadow-lg border-2 flex items-center justify-center overflow-hidden"
          style={{ borderColor: "#B3A0FF", backgroundColor: "#242833" }}
        >
          <Image
            src="/fighting.png"
            width={300}
            height={300}
            alt="Fighting"
            className="w-full h-full object-contain p-4"
          />
        </div>
      </div>

      {/* Bottom Section: Gallery + Total Ranking */}
      <div className="flex-1 grid grid-cols-11 gap-6">
        {/* Gallery Section */}
        <div
          className="col-span-8 rounded-2xl p-1 shadow-lg"
          style={{ backgroundColor: "#B3A0FF" }}
        >
          <div
            className="rounded-xl p-4 h-full flex items-center justify-center"
            style={{ backgroundColor: "#242833" }}
          >
            {/* Gallery Grid with Infinite Scroll */}
            {galleryImages.length > 0 ? (
              <InfiniteGallery
                images={galleryImages}
                direction="left"
                speed={70}
                stagger={true}
                staggerAmount={64}
                className="w-full h-full"
              />
            ) : (
              <p className="text-white/50">Loading gallery...</p>
            )}
          </div>
        </div>
        {/* Total Ranking Section - 1.5x wider than game tables */}
        <div
          className="col-span-3 rounded-2xl shadow-lg border-2 flex flex-col"
          style={{ borderColor: "#B3A0FF", backgroundColor: "#242833" }}
        >
          <div
            className="text-center font-bold text-black text-xl py-3 px-4 m-0"
            style={{
              backgroundColor: "#B3A0FF",
              borderTopLeftRadius: "14px",
              borderTopRightRadius: "14px",
            }}
          >
            <Link href="/">
              Total Ranking
            </Link>
          </div>
          <div className="relative flex-1">
            <table className="w-full border-collapse">
              <colgroup>
                <col className="w-12" />
                <col />
                <col className="w-20" />
              </colgroup>
              <thead>
                <tr className="border-b border-white bg-[#242833]">
                  <th className="px-3 py-3"></th>
                  <th className="px-3 py-3 text-center font-semibold text-white text-lg">
                    Player
                  </th>
                  <th className="px-3 py-3 text-center font-semibold text-white text-lg">
                    Points
                  </th>
                </tr>
              </thead>
              <tbody>
                {totalRanking.map((player, index) => (
                  <tr key={index} className="border-b border-white/20">
                    <td className="px-3 py-4 text-center text-white text-xl font-semibold">
                      {index + 1}
                    </td>
                    <td className="px-3 py-4 text-center text-white text-xl font-semibold">
                      {player.name}
                    </td>
                    <td className="px-3 py-4 text-center text-white text-xl font-semibold">
                      {player.points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {/* Vertical lines overlay for full height */}
            <div className="pointer-events-none absolute inset-0">
              <div className="absolute top-0 bottom-0 left-12 w-px bg-white" />
              <div className="absolute top-0 bottom-0 right-20 w-px bg-white" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
