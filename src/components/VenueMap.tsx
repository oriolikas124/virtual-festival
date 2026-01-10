'use client';

import { useEffect, useRef, useCallback } from 'react';
import { io, Socket } from 'socket.io-client';

interface Player {
    id: string;
    socketId: string;
    x: number;
    y: number;
    color: string;
    name: string;
}

interface PlayerSprite {
    container: Phaser.GameObjects.Container;
    sprite: Phaser.GameObjects.Sprite;
    nameText: Phaser.GameObjects.Text;
    targetX: number;
    targetY: number;
    lastDirection: number; // 0-7 for 8 directions
    isMoving: boolean;
}

interface HeartAnimation {
    socketId: string;
    container: Phaser.GameObjects.Container;
    startTime: number;
}

export const VenueMap = () => {
    const containerRef = useRef<HTMLDivElement>(null);
    const gameRef = useRef<Phaser.Game | null>(null);
    const socketRef = useRef<Socket | null>(null);
    const sceneRef = useRef<Phaser.Scene | null>(null);
    const playersRef = useRef<Map<string, PlayerSprite>>(new Map());
    const heartAnimationsRef = useRef<Map<string, HeartAnimation>>(new Map());

    // Function to create a player sprite with nickname
    const createPlayerSprite = useCallback((scene: Phaser.Scene, socketId: string, player: Player) => {
        // Create container for character and name
        const container = scene.add.container(player.x, player.y);

        // Create character sprite with spritesheet animation
        const sprite = scene.add.sprite(0, 0, 'character');
        sprite.setDisplaySize(45, 50);

        // Create nickname text above character
        const nameText = scene.add.text(0, -40, player.name, {
            fontSize: '14px',
            fontFamily: 'Arial, sans-serif',
            color: '#ffffff',
            backgroundColor: player.color,
            padding: { x: 6, y: 3 },
            align: 'center'
        });
        nameText.setOrigin(0.5, 1);

        // Add to container
        container.add([sprite, nameText]);
        container.setDepth(100); // Ensure players are above map tiles

        // Play idle animation (default direction: down = 4)
        sprite.play('char_idle_4');

        // Store player sprite reference
        const playerSprite: PlayerSprite = {
            container,
            sprite,
            nameText,
            targetX: player.x,
            targetY: player.y,
            lastDirection: 4, // Default facing down
            isMoving: false
        };

        playersRef.current.set(socketId, playerSprite);
        console.log(`✨ Player joined map: ${player.name} at (${player.x}, ${player.y})`);
    }, []);

    // Function to update players on the map
    const updatePlayers = useCallback((players: Record<string, Player>) => {
        const scene = sceneRef.current;
        if (!scene) return;

        const currentPlayerIds = new Set(Object.keys(players));

        // Remove players that are no longer connected
        playersRef.current.forEach((playerSprite, socketId) => {
            if (!currentPlayerIds.has(socketId)) {
                playerSprite.container.destroy();
                playersRef.current.delete(socketId);
                console.log(`🚪 Player removed from map: ${socketId}`);
            }
        });

        // Add or update players
        Object.entries(players).forEach(([socketId, player]) => {
            const existingPlayer = playersRef.current.get(socketId);

            if (existingPlayer) {
                // Update existing player position (smooth movement)
                existingPlayer.targetX = player.x;
                existingPlayer.targetY = player.y;
                // Update name if changed
                existingPlayer.nameText.setText(player.name);
            } else {
                // Create new player sprite
                createPlayerSprite(scene, socketId, player);
            }
        });
    }, [createPlayerSprite]);

    // Function to show heart animation above a player
    const showHeartAnimation = useCallback((socketId: string) => {
        const scene = sceneRef.current;
        const playerSprite = playersRef.current.get(socketId);
        if (!scene || !playerSprite) return;

        // Create heart container at player position
        const heartContainer = scene.add.container(
            playerSprite.container.x,
            playerSprite.container.y - 60
        );

        // Create heart text (emoji)
        const heartText = scene.add.text(0, 0, '❤️', {
            fontSize: '48px',
            align: 'center'
        });
        heartText.setOrigin(0.5, 0.5);

        heartContainer.add(heartText);
        heartContainer.setDepth(200); // Above everything
        heartContainer.setAlpha(1);
        heartContainer.setScale(0.3);

        // Store animation reference
        const animation: HeartAnimation = {
            socketId,
            container: heartContainer,
            startTime: Date.now()
        };
        heartAnimationsRef.current.set(`${socketId}_${Date.now()}`, animation);

        // Animate: scale up, float up, then fade out
        scene.tweens.add({
            targets: heartContainer,
            scaleX: 1.2,
            scaleY: 1.2,
            y: heartContainer.y - 50,
            duration: 600,
            ease: 'Back.easeOut',
            onComplete: () => {
                scene.tweens.add({
                    targets: heartContainer,
                    alpha: 0,
                    y: heartContainer.y - 30,
                    duration: 400,
                    ease: 'Power2',
                    onComplete: () => {
                        heartContainer.destroy();
                        heartAnimationsRef.current.delete(`${socketId}_${animation.startTime}`);
                    }
                });
            }
        });
    }, []);

    useEffect(() => {
        const container = containerRef.current;
        if (!container) return;
        
        // Prevent double initialization - check if canvas already exists
        if (container.querySelector('canvas') || gameRef.current) {
            return;
        }

        // Store reference for cleanup
        const players = playersRef.current;
        let handleResize: (() => void) | null = null;
        let isMounted = true;

        // Initialize socket connection
        const getServerUrl = () => {
            if (typeof window !== 'undefined') {
                const hostname = window.location.hostname;
                const protocol = window.location.protocol;
                
                // If accessing via IP or custom hostname, use that IP for server connection
                if (hostname !== 'localhost' && hostname !== '127.0.0.1') {
                    // Use same protocol as the page (https or http)
                    return `${protocol}//${hostname}:3001`;
                }
                
                // For localhost, check if we're on HTTPS
                if (protocol === 'https:') {
                    return `https://${hostname}:3001`;
                }
            }
            return 'http://localhost:3001';
        };

        const socket = io(getServerUrl(), {
            reconnection: true,
            reconnectionDelay: 1000,
            reconnectionAttempts: 5,
            transports: ['websocket', 'polling'],
        });

        socket.on('connect', () => {
            console.log('🎮 VenueMap connected to server');
            socket.emit('setRole', { role: 'viewer' });
        });

        socket.on('players', (players: Record<string, Player>) => {
            updatePlayers(players);
        });

        // Listen for heart animations
        socket.on('playerHeart', (data: { socketId: string; playerName: string }) => {
            showHeartAnimation(data.socketId);
        });

        socketRef.current = socket;

        // Dynamic import Phaser
        import('phaser').then((PhaserModule) => {
            // Check again in case component unmounted during async import
            if (!isMounted || !container) return;
            
            const Phaser = PhaserModule.default;

            class VenueScene extends Phaser.Scene {
                constructor() {
                    super({ key: 'VenueScene' });
                }

                preload() {
                    // Load tileset images
                    this.load.image('spritesheet', '/map/isometric tileset/spritesheet.png');
                    this.load.image('spritesheet02', '/map/isometric tileset/spritesheet02.png');

                    // Load tilemap
                    this.load.tilemapTiledJSON('map', '/map/map.tmj');

                    // Load character spritesheet (38x50 per frame, 8 columns x 3 rows)
                    this.load.spritesheet('character', '/map/character_spritesheet.png', {
                        frameWidth: 45,
                        frameHeight: 50
                    });
                }

                create() {
                    sceneRef.current = this;

                    // Create character animations for 8 directions
                    // Direction mapping (clockwise from up):
                    // 0: up, 1: up-right, 2: right, 3: down-right
                    // 4: down, 5: down-left, 6: left, 7: up-left
                    // Spritesheet layout: 8 columns (directions) x 3 rows (frames)
                    for (let dir = 0; dir < 8; dir++) {
                        // Walk animation (3 frames)
                        this.anims.create({
                            key: `char_walk_${dir}`,
                            frames: [
                                { key: 'character', frame: dir },      // Row 0
                                { key: 'character', frame: dir + 8 },  // Row 1
                                { key: 'character', frame: dir + 16 }  // Row 2
                            ],
                            frameRate: 8,
                            repeat: -1
                        });

                        // Idle animation (single frame from row 0)
                        this.anims.create({
                            key: `char_idle_${dir}`,
                            frames: [{ key: 'character', frame: dir }],
                            frameRate: 1,
                            repeat: 0
                        });
                    }

                    const map = this.make.tilemap({ key: 'map' });

                    const tileset1 = map.addTilesetImage('spritesheet', 'spritesheet');
                    const tileset2 = map.addTilesetImage('spritesheet02', 'spritesheet02');

                    // Create layers
                    ['base', 'buildings', 'trees', 'deer', 'text', 'header_decor'].forEach(name => {
                        map.createLayer(name, [tileset1, tileset2], 0, 0);
                    });

                    // Function to convert cartesian to isometric coordinates
                    // const cartesianToIsometric = (cartX: number, cartY: number) => {
                    //     const isoX = (cartX - cartY);
                    //     const isoY = (cartX + cartY) / 2;
                    //     return { x: isoX, y: isoY };
                    // };

                    // Helper function to draw isometric zone
                    // const drawIsometricZone = (obj: Phaser.Types.Tilemaps.TiledObject, color: number) => {
                    //     if (obj.x === undefined || obj.y === undefined || !obj.width || !obj.height) return;
                        
                    //     const graphics = this.add.graphics();
                    //     graphics.lineStyle(3, color, 1);

                    //     const x = obj.x;
                    //     const y = obj.y;
                    //     const w = obj.width;
                    //     const h = obj.height;

                    //     // Convert 4 corners to isometric
                    //     const topLeft = cartesianToIsometric(x, y);
                    //     const topRight = cartesianToIsometric(x + w, y);
                    //     const bottomRight = cartesianToIsometric(x + w, y + h);
                    //     const bottomLeft = cartesianToIsometric(x, y + h);

                    //     // Draw isometric diamond/rhombus
                    //     graphics.beginPath();
                    //     graphics.moveTo(topLeft.x, topLeft.y);
                    //     graphics.lineTo(topRight.x, topRight.y);
                    //     graphics.lineTo(bottomRight.x, bottomRight.y);
                    //     graphics.lineTo(bottomLeft.x, bottomLeft.y);
                    //     graphics.closePath();
                    //     graphics.strokePath();
                    //     graphics.setDepth(50);
                    // };

                    // // Zone colors mapping
                    // const zoneColors: Record<string, number> = {
                    //     'zone1': 0xff0000,  // Red
                    //     'zone2': 0xff8800,  // Orange
                    //     'zone3': 0xffff00,  // Yellow
                    //     'zone4': 0x00ff00,  // Green
                    //     'zone5': 0x0088ff,  // Blue
                    //     'zone6': 0xff00ff,  // Magenta
                    //     'spawn_zone': 0x00ff00, // Green
                    // };

                    // Render zones from object layer
                    // const zonesLayer = map.getObjectLayer('zones');
                    // if (zonesLayer) {
                    //     zonesLayer.objects.forEach((obj) => {
                    //         if (obj.name && zoneColors[obj.name]) {
                    //             drawIsometricZone(obj, zoneColors[obj.name]);
                    //         }
                    //     });
                    // }

                    // // Render spawn_zone from object layer
                    // const spawnLayer = map.getObjectLayer('spawn');
                    // if (spawnLayer) {
                    //     spawnLayer.objects.forEach((obj) => {
                    //         if (obj.name === 'spawn_zone') {
                    //             drawIsometricZone(obj, zoneColors['spawn_zone']);
                    //         }
                    //     });
                    // }

                    // Helper function to draw polygon (for walkable areas)
                    // Same conversion as zones: Cartesian -> Isometric
                    // const drawPolygon = (obj: Phaser.Types.Tilemaps.TiledObject, color: number) => {
                    //     if (obj.x === undefined || obj.y === undefined) return;
                        
                    //     const polygonData = obj.polygon as Array<{x: number, y: number}> | undefined;
                    //     if (!polygonData || polygonData.length < 3) return;

                    //     const graphics = this.add.graphics();
                    //     graphics.lineStyle(2, color, 0.8);
                    //     graphics.fillStyle(color, 0.1);

                    //     // Convert each point from Cartesian to Isometric (same as zones)
                    //     const points = polygonData.map((point) => {
                    //         const cartX = obj.x! + point.x;
                    //         const cartY = obj.y! + point.y;
                    //         return cartesianToIsometric(cartX, cartY);
                    //     });

                    //     // Draw the polygon
                    //     graphics.beginPath();
                    //     graphics.moveTo(points[0].x, points[0].y);
                        
                    //     for (let i = 1; i < points.length; i++) {
                    //         graphics.lineTo(points[i].x, points[i].y);
                    //     }
                        
                    //     graphics.closePath();
                    //     graphics.fillPath();
                    //     graphics.strokePath();
                    //     graphics.setDepth(50);
                    // };

                    // Render walkable areas with green border for debugging
                    // const walkableLayer = map.getObjectLayer('walkable');
                    // if (walkableLayer) {
                    //     walkableLayer.objects.forEach((obj) => {
                    //         if (obj.polygon) {
                    //             drawPolygon(obj, 0x00ff00);
                    //         }
                    //     });
                    // }

                    // Center the map in the view
                    const worldX = (map.width - map.height) * map.tileWidth * 0.2;
                    const worldY = (map.width + map.height) * map.tileHeight * 0.25;

                    // Center the map in the view
                    this.cameras.main.scrollX = worldX - (this.scale.width / 2);
                    this.cameras.main.scrollY = worldY - (this.scale.height / 2);

                    // Scale up for larger displays (27 inch)
                    // Default to 1.4 for better visibility
                    this.cameras.main.setZoom(1);
                }

                update() {
                    // Smooth interpolation for player movement
                    playersRef.current.forEach((playerSprite) => {
                        const container = playerSprite.container;
                        const targetX = playerSprite.targetX;
                        const targetY = playerSprite.targetY;

                        // Calculate distance to target
                        const dx = targetX - container.x;
                        const dy = targetY - container.y;
                        const distance = Math.sqrt(dx * dx + dy * dy);

                        // Determine if player is moving
                        const isMoving = distance > 1;

                        if (isMoving) {
                            // Calculate direction (0-7) from movement angle
                            // Angle: 0 = right, going counter-clockwise
                            const angle = Math.atan2(dy, dx) * (180 / Math.PI);
                            
                            // Convert angle to 8 directions (clockwise from up)
                            // up=0, up-right=1, right=2, down-right=3, down=4, down-left=5, left=6, up-left=7
                            let direction: number;
                            if (angle >= -112.5 && angle < -67.5) direction = 0;      // up
                            else if (angle >= -67.5 && angle < -22.5) direction = 1;  // up-right
                            else if (angle >= -22.5 && angle < 22.5) direction = 2;   // right
                            else if (angle >= 22.5 && angle < 67.5) direction = 3;    // down-right
                            else if (angle >= 67.5 && angle < 112.5) direction = 4;   // down
                            else if (angle >= 112.5 && angle < 157.5) direction = 5;  // down-left
                            else if (angle >= 157.5 || angle < -157.5) direction = 6; // left
                            else direction = 7; // up-left

                            playerSprite.lastDirection = direction;

                            // Play walk animation if not already playing
                            if (!playerSprite.isMoving) {
                                playerSprite.sprite.play(`char_walk_${direction}`);
                                playerSprite.isMoving = true;
                            } else if (playerSprite.sprite.anims.currentAnim?.key !== `char_walk_${direction}`) {
                                // Direction changed, switch animation
                                playerSprite.sprite.play(`char_walk_${direction}`);
                            }
                        } else {
                            // Player stopped moving - play idle animation
                            if (playerSprite.isMoving) {
                                playerSprite.sprite.play(`char_idle_${playerSprite.lastDirection}`);
                                playerSprite.isMoving = false;
                            }
                        }

                        // Lerp towards target position
                        const lerpFactor = 0.15;
                        container.x += (targetX - container.x) * lerpFactor;
                        container.y += (targetY - container.y) * lerpFactor;
                    });
                }
            }

            const config: Phaser.Types.Core.GameConfig = {
                type: Phaser.AUTO,
                parent: container,
                width: typeof window !== 'undefined' ? window.innerWidth : 800,
                height: typeof window !== 'undefined' ? window.innerHeight : 600,
                render: {
                    pixelArt: true,
                    antialias: false,
                },
                scene: VenueScene,
                physics: {
                    default: 'arcade',
                    arcade: {
                        debug: false,
                    },
                },
            };

            gameRef.current = new Phaser.Game(config);

            // Handle window resize
            handleResize = () => {
                if (gameRef.current) {
                    gameRef.current.scale.resize(window.innerWidth, window.innerHeight);
                }
            };

            window.addEventListener('resize', handleResize);
        }).catch((error) => {
            console.error('Failed to load Phaser:', error);
        });

        // Cleanup
        return () => {
            isMounted = false;
            
            if (handleResize) {
                window.removeEventListener('resize', handleResize);
            }
            if (socketRef.current) {
                socketRef.current.disconnect();
                socketRef.current = null;
            }
            if (gameRef.current) {
                gameRef.current.destroy(true);
                gameRef.current = null;
            }
            // Clear players
            players.clear();
            sceneRef.current = null;
        };
    }, [updatePlayers, showHeartAnimation]);

    return <div ref={containerRef} style={{ width: '100%', height: '100vh' }} />;
};
