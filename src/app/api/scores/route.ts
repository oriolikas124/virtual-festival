import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";

interface ScoreEntry {
  name: string;
  score: number;
  timestamp: number;
}

interface Scores {
  zone_1: ScoreEntry[];
  zone_2: ScoreEntry[];
  zone_3: ScoreEntry[];
  zone_4: ScoreEntry[];
  zone_6: ScoreEntry[];
}

const SCORES_FILE = path.join(process.cwd(), "data", "scores.json");

// Ensure data directory exists
function ensureDataDir() {
  const dataDir = path.join(process.cwd(), "data");
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }
}

// Load scores from file
function loadScores() {
  ensureDataDir();
  if (!fs.existsSync(SCORES_FILE)) {
    const defaultScores = {
      zone_1: [],
      zone_2: [],
      zone_3: [],
      zone_4: [],
      zone_6: [],
    };
    fs.writeFileSync(SCORES_FILE, JSON.stringify(defaultScores, null, 2));
    return defaultScores;
  }
  const data = fs.readFileSync(SCORES_FILE, "utf-8");
  return JSON.parse(data);
}

// Save scores to file
function saveScores(scores: Scores) {
  ensureDataDir();
  fs.writeFileSync(SCORES_FILE, JSON.stringify(scores, null, 2));
}

// GET - retrieve all scores
export async function GET() {
  try {
    const scores = loadScores();

    // Calculate total rankings
    const totalScores = new Map<string, number>();
    
    (Object.values(scores) as ScoreEntry[][]).forEach((zoneScores) => {
      if (Array.isArray(zoneScores)) {
        zoneScores.forEach((entry: ScoreEntry) => {
          const current = totalScores.get(entry.name) || 0;
          totalScores.set(entry.name, current + entry.score);
        });
      }
    });

    const total = Array.from(totalScores.entries())
      .map(([name, score]) => ({ name, score }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 5);

    return NextResponse.json({
      zone_1: scores.zone_1.slice(0, 8),
      zone_2: scores.zone_2.slice(0, 8),
      zone_3: scores.zone_3.slice(0, 8),
      zone_4: scores.zone_4.slice(0, 8),
      zone_6: scores.zone_6.slice(0, 8),
      total,
    });
  } catch (error) {
    console.error("Error loading scores:", error);
    return NextResponse.json({ error: "Failed to load scores" }, { status: 500 });
  }
}

// POST - save a new score
export async function POST(request: NextRequest) {
  try {
    const { zone, name, score } = await request.json();

    if (!zone || !name || score === undefined) {
      return NextResponse.json(
        { error: "Missing required fields: zone, name, score" },
        { status: 400 }
      );
    }

    const scores = loadScores();

    if (!scores[zone]) {
      return NextResponse.json({ error: `Invalid zone: ${zone}` }, { status: 400 });
    }

    // Find existing entry for this player in this zone
    const existingIndex = scores[zone].findIndex((entry: ScoreEntry) => entry.name === name);

    if (existingIndex >= 0) {
      // Update if new score is better
      if (score > scores[zone][existingIndex].score) {
        scores[zone][existingIndex].score = score;
        scores[zone][existingIndex].timestamp = Date.now();
      }
    } else {
      // Add new entry
      scores[zone].push({
        name,
        score,
        timestamp: Date.now(),
      });
    }

    // Sort by score descending and keep top 10
    scores[zone].sort((a: ScoreEntry, b: ScoreEntry) => b.score - a.score);
    scores[zone] = scores[zone].slice(0, 10);

    saveScores(scores);

    return NextResponse.json({ success: true, scores: scores[zone] });
  } catch (error) {
    console.error("Error saving score:", error);
    return NextResponse.json({ error: "Failed to save score" }, { status: 500 });
  }
}
