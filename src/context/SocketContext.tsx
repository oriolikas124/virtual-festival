"use client";

import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  ReactNode,
  useRef,
} from "react";
import { io, Socket } from "socket.io-client";

interface Player {
  id: string;
  x: number;
  y: number;
  color: string;
  name: string;
  currentZone?: string | null;
}

interface VectorData {
  x: number;
  y: number;
  angle: number;
  speed: number;
}

interface SocketContextType {
  socket: Socket | null;
  isConnected: boolean;
  currentPlayer: Player | null;
  nickname: string;
  setNickname: (name: string) => void;
  isNicknameSet: boolean;
  setIsNicknameSet: (value: boolean) => void;
  currentZone: string | null;
  // Helper methods
  emitMovement: (direction: string) => void;
  emitMoveVector: (vectorData: VectorData) => void;
}

const SocketContext = createContext<SocketContextType | undefined>(undefined);

export const SocketProvider = ({ children }: { children: ReactNode }) => {
  const [socket, setSocket] = useState<Socket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [currentPlayer, setCurrentPlayer] = useState<Player | null>(null);
  const [nickname, setNicknameState] = useState("");
  const [isNicknameSet, setIsNicknameSet] = useState(false);
  const [currentZone, setCurrentZone] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  // Wrapper for setNickname that also saves to localStorage
  const setNickname = (name: string) => {
    setNicknameState(name);
    if (typeof window !== "undefined") {
      localStorage.setItem("playerNickname", name);
      console.log("💾 Saved nickname to localStorage:", name);
    }
  };

  // Load nickname from localStorage on mount
  useEffect(() => {
    if (typeof window !== "undefined") {
      const savedNickname = localStorage.getItem("playerNickname");
      if (savedNickname) {
        setNicknameState(savedNickname);
        console.log("📖 Loaded nickname from localStorage:", savedNickname);
      }
    }
  }, []);

  // Helper function to emit movement
  const emitMovement = (direction: string) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("move", { direction });
    }
  };

  // Helper function to emit vector movement
  const emitMoveVector = (vectorData: VectorData) => {
    if (socketRef.current && isConnected) {
      socketRef.current.emit("moveVector", vectorData);
    }
  };

  // Initialize socket connection only when nickname is confirmed
  useEffect(() => {
    if (!isNicknameSet || !nickname.trim()) return;

    // If socket already exists and is connected, don't create a new one
    if (socketRef.current && socketRef.current.connected) {
      console.log("✅ Socket already connected, reusing existing connection");
      return;
    }

    // Get the current host and construct server URL
    const getServerUrl = () => {
      if (typeof window !== "undefined") {
        const hostname = window.location.hostname;
        const protocol = window.location.protocol;

        console.log(
          "📍 Current location - hostname:",
          hostname,
          "protocol:",
          protocol,
          "port:",
          window.location.port
        );

        // If accessing via IP or custom hostname, use that IP for server connection
        if (hostname !== "localhost" && hostname !== "127.0.0.1") {
          // Use same protocol as the page (https or http)
          const url = `${protocol}//${hostname}:3001`;
          console.log("🌐 Using IP connection:", url);
          return url;
        }
        
        // For localhost, check if we're on HTTPS
        if (protocol === "https:") {
          const url = `https://${hostname}:3001`;
          console.log("🔒 Using HTTPS localhost connection:", url);
          return url;
        }
      }
      console.log("🌐 Using localhost connection: http://localhost:3001");
      return "http://localhost:3001";
    };

    const serverUrl = getServerUrl();
    console.log(
      "🔌 Connecting to server:",
      serverUrl,
      "with nickname:",
      nickname
    );

    const newSocket = io(serverUrl, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionAttempts: 5,
    });

    newSocket.on("connect", () => {
      console.log("✅ Connected to server successfully");
      setIsConnected(true);
      // Tell server this is a player controller with nickname
      newSocket.emit("setRole", { role: "player", name: nickname });
    });

    newSocket.on("disconnect", () => {
      console.log("❌ Disconnected from server");
      setIsConnected(false);
    });

    newSocket.on("playerData", (player: Player) => {
      console.log("📊 Received player data:", player);
      setCurrentPlayer(player);
      // Set initial zone if player spawns in a zone
      if (player.currentZone) {
        setCurrentZone(player.currentZone);
      }
    });

    // Listen for zone enter/leave events
    newSocket.on("enterZone", (data: { zone: string }) => {
      console.log("📍 Entered zone:", data.zone);
      setCurrentZone(data.zone);
    });

    newSocket.on("leaveZone", (data: { zone: string }) => {
      console.log("🚪 Left zone:", data.zone);
      setCurrentZone(null);
    });

    newSocket.on("reconnect", () => {
      console.log("🔄 Reconnected to server");
      setIsConnected(true);
    });

    newSocket.on("connect_error", (error: Error | string) => {
      console.error(
        "❌ Connection error:",
        typeof error === "string" ? error : error.message
      );
    });

    socketRef.current = newSocket;
    setSocket(newSocket);

    return () => {
      console.log("🔌 Cleaning up socket connection");
      newSocket.close();
    };
  }, [isNicknameSet, nickname]);

  const value: SocketContextType = {
    socket,
    isConnected,
    currentPlayer,
    nickname,
    setNickname,
    isNicknameSet,
    setIsNicknameSet,
    currentZone,
    emitMovement,
    emitMoveVector,
  };

  return (
    <SocketContext.Provider value={value}>{children}</SocketContext.Provider>
  );
}

export function useSocket() {
  const context = useContext(SocketContext);
  if (context === undefined) {
    throw new Error("useSocket must be used within a SocketProvider");
  }
  return context;
}
