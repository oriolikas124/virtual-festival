# Virtual Festival

A virtual Japanese festival where visitors use their smartphones to control avatars and enjoy interactive attractions themed around different regions of Japan.

**Theme:** Japanese Festival (Japonism + festive atmosphere)

## Overview

The festival features multiple zones inspired by real Japanese prefectures and culture. Participants earn points in real-time, which are displayed on a shared dashboard. The experience requires multiple screens (venue map, QR page, dashboard) and a smartphone as a controller.

## Zones

- **Kyoto Kimono Try-on**: Capture a photo of your face and use AI (Gemini) to generate an image of yourself wearing a kimono.
- **Tokyo Yamanote Line Quiz**: A quiz about Tokyo's famous Yamanote train line.
- **Tokyo Train Announcement Quiz**: Listen to train announcements and identify which line it is.
- **Shizuoka Mt. Fuji Puzzle**: An interactive puzzle featuring Mt. Fuji.
- **Nara Deer Senbei Story**: Choose-your-own-adventure style story involving Nara's deer and rice crackers.
- **Ibaraki Natto Mixing**: A fun real-time finger mixing challenge.

## Tech Stack

- Next.js 15 with App Router and TypeScript
- Phaser 3 (game engine)
- Socket.IO for real-time communication
- Gemini API for AI image generation
- Tailwind CSS
- Konva, Framer Motion, Lucide React, and others
- Custom HTTPS setup for local development with camera access

## Local Development

See HTTPS-SETUP.md for detailed instructions on running with multiple displays and smartphone controller.

Basic:

```bash
npm install
npm run dev:https
# In another terminal:
npm run server:https
```

Then access the venue map, QR page, and dashboard in the browser.

## Contributions

This was developed as a team project during studies at HAL Tokyo for a virtual exhibition event.

I contributed as a programmer, working on interactive features, real-time systems, and various zone implementations.

Original team repository: https://github.com/AnhNangCuaEm/virtual-festival
