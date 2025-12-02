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

// Load walkable polygon and spawn zone from map.tmj
let walkablePolygon = null; // Single polygon with points (already in isometric screen space from Tiled)
let spawnZone = null;

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
    const walkableLayer = mapData.layers.find(layer => layer.name === "walkable");
    if (walkableLayer && walkableLayer.objects) {
      const polygonObj = walkableLayer.objects.find(obj => obj.polygon && obj.polygon.length > 2);
      
      if (polygonObj) {
        // Get absolute Cartesian coordinates, then convert to Isometric
        const points = polygonObj.polygon.map(point => {
          const cartX = polygonObj.x + point.x;
          const cartY = polygonObj.y + point.y;
          return cartesianToIsometric(cartX, cartY);
        });
        
        // Calculate bounding box
        const minX = Math.min(...points.map(p => p.x));
        const maxX = Math.max(...points.map(p => p.x));
        const minY = Math.min(...points.map(p => p.y));
        const maxY = Math.max(...points.map(p => p.y));
        
        walkablePolygon = { points, minX, maxX, minY, maxY };
        
        console.log(`✅ Loaded walkable polygon with ${points.length} vertices`);
        console.log(`   Bounds: X(${minX.toFixed(0)} ~ ${maxX.toFixed(0)}), Y(${minY.toFixed(0)} ~ ${maxY.toFixed(0)})`);
      }
    }
    
    // Load spawn zone (rectangle - same conversion as zones)
    const spawnLayer = mapData.layers.find(layer => layer.name === "spawn");
    if (spawnLayer && spawnLayer.objects) {
      const spawn = spawnLayer.objects.find(obj => obj.name === "spawn_zone" && obj.width > 0 && obj.height > 0);
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
        
        const minX = Math.min(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
        const maxX = Math.max(topLeft.x, topRight.x, bottomRight.x, bottomLeft.x);
        const minY = Math.min(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
        const maxY = Math.max(topLeft.y, topRight.y, bottomRight.y, bottomLeft.y);
        
        spawnZone = {
          centerX: (minX + maxX) / 2,
          centerY: (minY + maxY) / 2,
          minX, maxX, minY, maxY,
          diamond: [topLeft, topRight, bottomRight, bottomLeft]
        };
        console.log(`✅ Loaded spawn zone at center (${spawnZone.centerX.toFixed(0)}, ${spawnZone.centerY.toFixed(0)})`);
      }
    }
    
    if (!walkablePolygon) {
      console.log("⚠️ No walkable layer found - movement unrestricted");
    }
    if (!spawnZone) {
      console.log("⚠️ No spawn_zone found - using default spawn");
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
    const xi = points[i].x, yi = points[i].y;
    const xj = points[j].x, yj = points[j].y;
    
    const intersect = ((yi > py) !== (yj > py)) &&
                      (px < (xj - xi) * (py - yi) / (yj - yi) + xi);
    if (intersect) inside = !inside;
  }
  
  return inside;
}

// Check if a point is inside the isometric diamond spawn zone
function isInSpawnZone(x, y) {
  if (!spawnZone || !spawnZone.diamond) return false;
  
  // Quick bounding box check first
  if (x < spawnZone.minX || x > spawnZone.maxX ||
      y < spawnZone.minY || y > spawnZone.maxY) {
    return false;
  }
  
  // Precise diamond check using ray casting
  return isPointInPolygon(x, y, spawnZone.diamond);
}

// Check if a point is inside the walkable polygon
function isInWalkableArea(x, y) {
  // If no walkable polygon defined, allow movement everywhere
  if (!walkablePolygon) return true;
  
  // Quick bounding box check first
  if (x < walkablePolygon.minX || x > walkablePolygon.maxX ||
      y < walkablePolygon.minY || y > walkablePolygon.maxY) {
    return false;
  }
  
  // Precise polygon check using ray casting
  return isPointInPolygon(x, y, walkablePolygon);
}

// Check collision (returns true if movement is BLOCKED)
function checkCollision(x, y) {
  return !isInWalkableArea(x, y);
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
      const x = spawnZone.minX + Math.random() * (spawnZone.maxX - spawnZone.minX);
      const y = spawnZone.minY + Math.random() * (spawnZone.maxY - spawnZone.minY);
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
      const x = walkablePolygon.minX + Math.random() * (walkablePolygon.maxX - walkablePolygon.minX);
      const y = walkablePolygon.minY + Math.random() * (walkablePolygon.maxY - walkablePolygon.minY);
      if (isInWalkableArea(x, y)) {
        return { x, y };
      }
    }
    // Fallback to center of walkable area
    return { 
      x: (walkablePolygon.minX + walkablePolygon.maxX) / 2,
      y: (walkablePolygon.minY + walkablePolygon.maxY) / 2
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
        connectedAt: new Date().toISOString(),
      };

      // Store player
      players.set(socket.id, newPlayer);
      gameState.players[socket.id] = newPlayer;

      console.log(
        `✅ Player ${newPlayer.name} spawned at (${newPlayer.x}, ${newPlayer.y})`
      );

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
      const moveSpeed = 1;
      let newX = player.x;
      let newY = player.y;

      switch (direction) {
        case "up":
          newY = player.y - moveSpeed;
          break;
        case "down":
          newY = player.y + moveSpeed;
          break;
        case "left":
          newX = player.x - moveSpeed;
          break;
        case "right":
          newX = player.x + moveSpeed;
          break;
      }

      // Check collision before updating position
      if (!checkCollision(newX, newY)) {
        player.x = newX;
        player.y = newY;
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
      const moveSpeed = 2; // Slower constant speed (reduced from 5)
      const moveX = x * moveSpeed;
      const moveY = y * moveSpeed;

      // Calculate new position - NO rectangular bounds, only walkable polygon check
      const newX = player.x + moveX;
      const newY = player.y + moveY;

      // Check collision before updating position
      if (!checkCollision(newX, newY)) {
        player.x = newX;
        player.y = newY;
      }

      // Update game state
      gameState.players[socket.id] = { ...player };
      broadcastGameState();
    }
  });

  // Handle player name update
  socket.on("updateName", (newName) => {
    const player = players.get(socket.id);
    if (player && newName && newName.trim()) {
      player.name = newName.trim();
      gameState.players[socket.id] = { ...player };

      console.log(`📝 Player ${player.name} changed name to: ${player.name}`);
      broadcastGameState();
    }
  });

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
});

// HTTP routes
app.get("/", (req, res) => {
  res.json({
    message: "🎎 Virtual Festival Server",
    status: "running",
    players: Object.keys(gameState.players).length,
    uptime: process.uptime(),
  });
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
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});

process.on("SIGINT", () => {
  console.log("📴 Server shutting down gracefully...");
  server.close(() => {
    console.log("✅ Server closed");
    process.exit(0);
  });
});
