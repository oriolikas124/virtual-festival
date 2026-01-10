import express from "express";
import { createServer } from "http";
import { Server } from "socket.io";
import cors from "cors";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const server = createServer(app);

// CORS configuration - Simple for development
app.use(
  cors({
    origin: "*",
    credentials: false,
  })
);

// Serve static files from public directory
app.use(express.static(path.join(__dirname, "../public")));

// Socket.io configuration - Simple for development
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
    credentials: false,
  },
  transports: ["websocket", "polling"],
});

// In-memory storage for players
const players = new Map();
const gameState = {
  players: {},
  mapSize: { width: 960, height: 480 },
};

// Load walkable polygon, spawn zone and trigger zones from map.tmj
let walkablePolygon = null; // Single polygon with points (already in isometric screen space from Tiled)
let spawnZone = null;
let triggerZones = []; // Array of zones with trigger property

function loadMapData() {
  try {
    const mapPath = path.join(__dirname, "../public/map/map.tmj");
    const mapData = JSON.parse(fs.readFileSync(mapPath, "utf-8"));

    // Convert Cartesian to Isometric (same as VenueMap.tsx)
    const cartesianToIsometric = (cartX, cartY) => {
      const isoX = cartX - cartY;
      const isoY = (cartX + cartY) / 2;
      return { x: isoX, y: isoY };
    };

    // Load walkable polygon
    const walkableLayer = mapData.layers.find(
      (layer) => layer.name === "walkable"
    );
    if (walkableLayer && walkableLayer.objects) {
      const polygonObj = walkableLayer.objects.find(
        (obj) => obj.polygon && obj.polygon.length > 2
      );

      if (polygonObj) {
        // Get absolute Cartesian coordinates, then convert to Isometric
        const points = polygonObj.polygon.map((point) => {
          const cartX = polygonObj.x + point.x;
          const cartY = polygonObj.y + point.y;
          return cartesianToIsometric(cartX, cartY);
        });

        // Calculate bounding box
        const minX = Math.min(...points.map((p) => p.x));
        const maxX = Math.max(...points.map((p) => p.x));
        const minY = Math.min(...points.map((p) => p.y));
        const maxY = Math.max(...points.map((p) => p.y));

        walkablePolygon = { points, minX, maxX, minY, maxY };
      }
    }

    // Load spawn zone (rectangle - same conversion as zones)
    const spawnLayer = mapData.layers.find((layer) => layer.name === "spawn");
    if (spawnLayer && spawnLayer.objects) {
      const spawn = spawnLayer.objects.find(
        (obj) => obj.name === "spawn_zone" && obj.width > 0 && obj.height > 0
      );
      if (spawn) {
        const x = spawn.x;
        const y = spawn.y;
        const w = spawn.width;
        const h = spawn.height;

        // Convert 4 corners to isometric
        const topLeft = cartesianToIsometric(x, y);
        const topRight = cartesianToIsometric(x + w, y);
        const bottomRight = cartesianToIsometric(x + w, y + h);
        const bottomLeft = cartesianToIsometric(x, y + h);

        const minX = Math.min(
          topLeft.x,
          topRight.x,
          bottomRight.x,
          bottomLeft.x
        );
        const maxX = Math.max(
          topLeft.x,
          topRight.x,
          bottomRight.x,
          bottomLeft.x
        );
        const minY = Math.min(
          topLeft.y,
          topRight.y,
          bottomRight.y,
          bottomLeft.y
        );
        const maxY = Math.max(
          topLeft.y,
          topRight.y,
          bottomRight.y,
          bottomLeft.y
        );

        spawnZone = {
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          minX,
          maxX,
          minY,
          maxY,
          diamond: [topLeft, topRight, bottomRight, bottomLeft],
        };
      }
    }

    // Load trigger zones from zones layer
    const zonesLayer = mapData.layers.find((layer) => layer.name === "zones");
    if (zonesLayer && zonesLayer.objects) {
      zonesLayer.objects.forEach((obj) => {
        // Only process objects with trigger property and valid dimensions
        if (obj.properties && obj.width > 0 && obj.height > 0) {
          const triggerProp = obj.properties.find((p) => p.name === "trigger");
          if (triggerProp) {
            const x = obj.x;
            const y = obj.y;
            const w = obj.width;
            const h = obj.height;

            // Convert 4 corners to isometric (same as spawn zone)
            const topLeft = cartesianToIsometric(x, y);
            const topRight = cartesianToIsometric(x + w, y);
            const bottomRight = cartesianToIsometric(x + w, y + h);
            const bottomLeft = cartesianToIsometric(x, y + h);

            const minX = Math.min(
              topLeft.x,
              topRight.x,
              bottomRight.x,
              bottomLeft.x
            );
            const maxX = Math.max(
              topLeft.x,
              topRight.x,
              bottomRight.x,
              bottomLeft.x
            );
            const minY = Math.min(
              topLeft.y,
              topRight.y,
              bottomRight.y,
              bottomLeft.y
            );
            const maxY = Math.max(
              topLeft.y,
              topRight.y,
              bottomRight.y,
              bottomLeft.y
            );

            triggerZones.push({
              name: obj.name,
              trigger: triggerProp.value,
              minX,
              maxX,
              minY,
              maxY,
              diamond: [topLeft, topRight, bottomRight, bottomLeft],
            });
          }
        }
      });
    }
  } catch (error) {
    console.error("❌ Failed to load map data:", error.message);
  }
}

// Check if point is inside a polygon using ray casting algorithm
function isPointInPolygon(px, py, polygon) {
  const points = polygon.points || polygon;
  let inside = false;

  for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
    const xi = points[i].x,
      yi = points[i].y;
    const xj = points[j].x,
      yj = points[j].y;

    const intersect =
      yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }

  return inside;
}

// Check if a point is inside the isometric diamond spawn zone
function isInSpawnZone(x, y) {
  if (!spawnZone || !spawnZone.diamond) return false;

  // Quick bounding box check first
  if (
    x < spawnZone.minX ||
    x > spawnZone.maxX ||
    y < spawnZone.minY ||
    y > spawnZone.maxY
  ) {
    return false;
  }

  // Precise diamond check using ray casting
  return isPointInPolygon(x, y, spawnZone.diamond);
}

// Check which trigger zone a point is in (returns trigger value or null)
function getPlayerZone(x, y) {
  for (const zone of triggerZones) {
    // Quick bounding box check first
    if (x < zone.minX || x > zone.maxX || y < zone.minY || y > zone.maxY) {
      continue;
    }

    // Precise diamond check using ray casting
    if (isPointInPolygon(x, y, zone.diamond)) {
      return zone.trigger;
    }
  }
  return null;
}

// Check if a point is inside the walkable polygon
function isInWalkableArea(x, y) {
  // If no walkable polygon defined, allow movement everywhere
  if (!walkablePolygon) return true;

  // Quick bounding box check first
  if (
    x < walkablePolygon.minX ||
    x > walkablePolygon.maxX ||
    y < walkablePolygon.minY ||
    y > walkablePolygon.maxY
  ) {
    return false;
  }

  // Precise polygon check using ray casting
  return isPointInPolygon(x, y, walkablePolygon);
}

// Check collision (returns true if movement is BLOCKED)
function checkCollision(x, y) {
  return !isInWalkableArea(x, y);
}

// Advanced collision response - tries to slide along walls
// When direct movement is blocked, try moving only in X or only in Y direction
function moveWithCollisionResponse(player, moveX, moveY) {
  const newX = player.x + moveX;
  const newY = player.y + moveY;

  // If the full movement is valid, apply it
  if (!checkCollision(newX, newY)) {
    return { x: newX, y: newY, moved: true };
  }

  // Full movement is blocked, try sliding along walls
  // Try moving only in X direction
  const newXOnly = player.x + moveX;
  if (!checkCollision(newXOnly, player.y)) {
    return { x: newXOnly, y: player.y, moved: true };
  }

  // Try moving only in Y direction
  if (!checkCollision(player.x, player.y + moveY)) {
    return { x: player.x, y: player.y + moveY, moved: true };
  }

  // If both fail, no movement possible
  return { x: player.x, y: player.y, moved: false };
}

// Load map data on startup
loadMapData();

// Utility functions
function generatePlayerId() {
  return `player_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
}

function getRandomSpawnPosition() {
  if (spawnZone) {
    // Random position within spawn zone isometric diamond
    for (let i = 0; i < 100; i++) {
      const x =
        spawnZone.minX + Math.random() * (spawnZone.maxX - spawnZone.minX);
      const y =
        spawnZone.minY + Math.random() * (spawnZone.maxY - spawnZone.minY);
      // Check if point is inside the diamond AND walkable area
      if (isInSpawnZone(x, y) && isInWalkableArea(x, y)) {
        return { x, y };
      }
    }
    // Fallback to center if rejection sampling fails
    return { x: spawnZone.centerX, y: spawnZone.centerY };
  }

  // If no spawn zone, spawn inside walkable area
  if (walkablePolygon) {
    for (let i = 0; i < 100; i++) {
      const x =
        walkablePolygon.minX +
        Math.random() * (walkablePolygon.maxX - walkablePolygon.minX);
      const y =
        walkablePolygon.minY +
        Math.random() * (walkablePolygon.maxY - walkablePolygon.minY);
      if (isInWalkableArea(x, y)) {
        return { x, y };
      }
    }
    // Fallback to center of walkable area
    return {
      x: (walkablePolygon.minX + walkablePolygon.maxX) / 2,
      y: (walkablePolygon.minY + walkablePolygon.maxY) / 2,
    };
  }

  // Default fallback
  return {
    x: Math.random() * (gameState.mapSize.width - 100) + 50,
    y: Math.random() * (gameState.mapSize.height - 100) + 50,
  };
}

function broadcastGameState() {
  io.emit("players", gameState.players);
}

// Check distance between two players
function getDistanceBetweenPlayers(player1, player2) {
  const dx = player1.x - player2.x;
  const dy = player1.y - player2.y;
  return Math.sqrt(dx * dx + dy * dy);
}

// Get nearby players for a given player (within a certain distance)
const NEARBY_DISTANCE = 80; // Distance threshold for "nearby" players

function getNearbyPlayers(socketId) {
  const player = players.get(socketId);
  if (!player) return [];

  const nearbyPlayers = [];
  players.forEach((otherPlayer, otherSocketId) => {
    if (otherSocketId !== socketId) {
      const distance = getDistanceBetweenPlayers(player, otherPlayer);
      if (distance <= NEARBY_DISTANCE) {
        nearbyPlayers.push({
          socketId: otherSocketId,
          name: otherPlayer.name,
          distance: distance,
        });
      }
    }
  });

  return nearbyPlayers;
}

// Check and notify players about nearby players
function checkAndNotifyNearbyPlayers() {
  players.forEach((player, socketId) => {
    const nearbyPlayers = getNearbyPlayers(socketId);
    const socket = io.sockets.sockets.get(socketId);
    if (socket) {
      socket.emit("nearbyPlayers", nearbyPlayers);
    }
  });
}

// Socket.io event handlers
io.on("connection", (socket) => {
  console.log(`🔌 Client connected: ${socket.id}`);

  let isPlayer = false; // Track if this connection is a player

  // Handle role setting with nickname
  socket.on("setRole", (roleData) => {
    const role = roleData.role || roleData; // Support both old and new format
    const nickname = roleData.name || `Player ${players.size + 1}`; // Get nickname from roleData

    if (role === "player") {
      isPlayer = true;

      // Generate unique player ID and spawn position
      const playerId = generatePlayerId();
      const spawnPosition = getRandomSpawnPosition();

      // Create new player with nickname
      const newPlayer = {
        id: playerId,
        socketId: socket.id,
        x: spawnPosition.x,
        y: spawnPosition.y,
        color: `hsl(${Math.random() * 360}, 70%, 60%)`, // Random color
        name: nickname,
        currentZone: null, // Track which zone player is in
        connectedAt: new Date().toISOString(),
      };

      // Store player
      players.set(socket.id, newPlayer);
      gameState.players[socket.id] = newPlayer;

      console.log(
        `✅ Player ${newPlayer.name} spawned at (${newPlayer.x}, ${newPlayer.y})`
      );

      // Check initial zone
      const initialZone = getPlayerZone(newPlayer.x, newPlayer.y);
      if (initialZone) {
        newPlayer.currentZone = initialZone;
        gameState.players[socket.id].currentZone = initialZone;
        socket.emit("enterZone", { zone: initialZone });
        console.log(
          `📍 Player ${newPlayer.name} spawned in zone: ${initialZone}`
        );
      }

      // Send player their own data
      socket.emit("playerData", newPlayer);

      // Broadcast updated game state to all clients
      broadcastGameState();
    } else if (role === "viewer") {
      console.log(`👁️ Viewer connected: ${socket.id}`);
      // Just send current game state to viewer
      broadcastGameState();
    }
  });

  // Handle player movement (discrete directions)
  socket.on("move", (moveData) => {
    const player = players.get(socket.id);
    if (!player) return;

    const { direction, x, y } = moveData;

    if (direction) {
      // Handle directional movement (from controller)
      const moveSpeed = 0.1;
      let moveX = 0;
      let moveY = 0;

      switch (direction) {
        case "up":
          moveY = -moveSpeed;
          break;
        case "down":
          moveY = moveSpeed;
          break;
        case "left":
          moveX = -moveSpeed;
          break;
        case "right":
          moveX = moveSpeed;
          break;
      }

      // Use collision response for smooth wall sliding
      const moveResult = moveWithCollisionResponse(player, moveX, moveY);

      if (moveResult.moved) {
        player.x = moveResult.x;
        player.y = moveResult.y;
      }
    } else if (x !== undefined && y !== undefined) {
      // Handle absolute position (from venue map clicks)
      // No rectangular bounds - only walkable polygon check
      if (!checkCollision(x, y)) {
        player.x = x;
        player.y = y;
      }
    }

    // Update game state
    gameState.players[socket.id] = { ...player };
    broadcastGameState();
  });

  // Handle 360° vector movement (from joystick)
  socket.on("moveVector", (vectorData) => {
    const player = players.get(socket.id);
    if (!player) return;

    const { x, y, speed } = vectorData;

    if (speed > 0) {
      // Calculate movement based on vector with slow constant speed
      const moveSpeed = 0.9; // Low speed
      const moveX = x * moveSpeed;
      const moveY = y * moveSpeed;

      // Use collision response to handle wall sliding
      const moveResult = moveWithCollisionResponse(player, moveX, moveY);

      if (moveResult.moved) {
        const oldZone = player.currentZone;
        player.x = moveResult.x;
        player.y = moveResult.y;

        // Check if player entered or left a zone
        const newZone = getPlayerZone(moveResult.x, moveResult.y);

        if (newZone !== oldZone) {
          player.currentZone = newZone;

          if (oldZone && !newZone) {
            // Left a zone
            socket.emit("leaveZone", { zone: oldZone });
          } else if (!oldZone && newZone) {
            // Entered a zone
            socket.emit("enterZone", { zone: newZone });
          } else if (oldZone && newZone) {
            // Changed from one zone to another
            socket.emit("leaveZone", { zone: oldZone });
            socket.emit("enterZone", { zone: newZone });
          }
        }
      }

      // Update game state
      gameState.players[socket.id] = { ...player };
      broadcastGameState();
      
      // Check and notify about nearby players after movement
      checkAndNotifyNearbyPlayers();
    }
  });

  // Handle player name update
  // socket.on("updateName", (newName) => {
  //   const player = players.get(socket.id);
  //   if (player && newName && newName.trim()) {
  //     player.name = newName.trim();
  //     gameState.players[socket.id] = { ...player };

  //     broadcastGameState();
  //   }
  // });

  // Handle disconnect
  socket.on("disconnect", () => {
    if (isPlayer) {
      const player = players.get(socket.id);
      if (player) {
        console.log(`❌ Player ${player.name} disconnected`);

        // Remove player from storage
        players.delete(socket.id);
        delete gameState.players[socket.id];

        // Broadcast updated game state
        broadcastGameState();
      }
    } else {
      console.log(`👁️ Viewer disconnected: ${socket.id}`);
    }
  });

  // Add manual player removal for dashboard
  socket.on("removePlayer", (targetSocketId) => {
    const player = players.get(targetSocketId);
    if (player) {
      console.log(`🗑️ Manually removing player ${player.name}`);

      // Remove player from storage
      players.delete(targetSocketId);
      delete gameState.players[targetSocketId];

      // Disconnect the target socket
      const targetSocket = io.sockets.sockets.get(targetSocketId);
      if (targetSocket) {
        targetSocket.disconnect();
      }

      // Broadcast updated game state
      broadcastGameState();

      // Confirm removal
      socket.emit("playerRemoved", {
        playerId: targetSocketId,
        playerName: player.name,
      });
    }
  });

  // Handle ping/pong for connection monitoring
  socket.on("ping", () => {
    socket.emit("pong");
  });

  // Handle sending heart to nearby players
  socket.on("sendHeart", () => {
    const player = players.get(socket.id);
    if (!player) return;

    // Broadcast heart animation to all viewers/players
    io.emit("playerHeart", {
      socketId: socket.id,
      playerName: player.name,
      x: player.x,
      y: player.y,
    });
  });
});

// HTTP routes
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Virtual Festival Server</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
          min-height: 100vh;
          padding: 20px;
          display: flex;
          justify-content: center;
          align-items: center;
          color: #fff;
        }
        .container {
          background: rgba(255, 255, 255, 0.1);
          backdrop-filter: blur(10px);
          border-radius: 20px;
          padding: 40px;
          text-align: center;
          box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
          border: 1px solid rgba(255, 255, 255, 0.1);
        }
        h1 { font-size: 2rem; margin-bottom: 20px; color: #fff; }
        .status {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          background: rgba(46, 213, 115, 0.2);
          padding: 8px 16px;
          border-radius: 20px;
          margin-bottom: 30px;
        }
        .status-dot {
          width: 10px;
          height: 10px;
          background: #2ed573;
          border-radius: 50%;
          animation: pulse 2s infinite;
        }
        .notice {
          font-size: 1.5rem;
          line-height: 1.5;
          font-weight: bold;
          margin-bottom: 20px;
          color: #dff9fb;
        }
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
        .footer {
          margin-top: 30px;
          font-size: 12px;
          color: rgba(255, 255, 255, 0.5);
        }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="logo">
          <img src="/logo.svg" alt="Virtual Festival" width="250" height="auto">
        </div>
        <h1>Virtual Festival Server</h1>
        <div class="status">
          <div class="status-dot"></div>
          <span>Running</span>
        </div>
        <div class="notice">
          サーバーに接続しました。</br>
          このページを閉じてStep 3.に進んでください。
        </div>
        <div class="footer">
          Socket.io server ready • Port ${PORT}
        </div>
      </div>
    </body>
    </html>
  `);
});

app.get("/status", (req, res) => {
  res.json({
    players: gameState.players,
    totalPlayers: Object.keys(gameState.players).length,
    mapSize: gameState.mapSize,
    serverTime: new Date().toISOString(),
  });
});

// Start server
const PORT = process.env.PORT || 3001;

server.listen(PORT, "0.0.0.0", () => {
  console.log("===================================");
  console.log("Virtual Festival Server Started");
  console.log("===================================");
  console.log(`🔗 Server running on port ${PORT} (all interfaces)`);
  console.log(`🌐 HTTP: http://localhost:${PORT}`);
  console.log(`📱 Mobile: Find your IP and use http://YOUR_IP:${PORT}`);
  console.log(`⚡ Socket.io ready for connections`);
  console.log("===================================");
});

// Graceful shutdown
process.on("SIGTERM", () => {
  console.log("📴 Server shutting down gracefully...");
  process.exit(0);
});

process.on("SIGINT", () => {
  console.log("📴 Server shutting down...");
  process.exit(0);
});
