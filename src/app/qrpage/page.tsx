'use client';

import Link from "next/link";
import { useEffect, useRef } from "react";

const QR_CONFIG = {
    radius: 0.1,
    ecLevel: 'H' as const,
    fill: '#fff',
    background: null,
    size: 512
};

// S = WiFi Name, P = Password
const WIFI_QR_TEXT = 'WIFI:T:WPA;S:VirtualFestival;P:virtualfestival123;;';
const SERVER_QR_TEXT = 'https://192.168.11.3:3001';
const FESTIVAL_QR_TEXT = 'https://192.168.11.3:3000/controller';

const renderQrCode = async (element: HTMLDivElement, text: string) => {
    const QrCreator = await import('qr-creator');
    element.innerHTML = '';
    QrCreator.default.render({
        text,
        ...QR_CONFIG
    }, element);
};

export default function QRPage() {
    const wifiQrRef = useRef<HTMLDivElement>(null);
    const serverQrRef = useRef<HTMLDivElement>(null);
    const festivalQrRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const wifiQrElement = wifiQrRef.current;
        const serverQrElement = serverQrRef.current;
        const festivalQrElement = festivalQrRef.current;

        if (wifiQrElement) renderQrCode(wifiQrElement, WIFI_QR_TEXT);
        if (serverQrElement) renderQrCode(serverQrElement, SERVER_QR_TEXT);
        if (festivalQrElement) renderQrCode(festivalQrElement, FESTIVAL_QR_TEXT);

        return () => {
            if (wifiQrElement) wifiQrElement.innerHTML = '';
            if (festivalQrElement) festivalQrElement.innerHTML = '';
        };
    }, []);

    return (
        <div className="min-h-screen flex flex-col bg-[url('/background/background.jpg')] bg-cover bg-center">
            <div className="absolute inset-0 backdrop-blur-md"></div>
            <main className="container flex flex-col justify-center mx-auto px-4 py-8 flex-1 z-10">
                <div className="flex justify-center gap-24">
                    <div>
                        <Link href="/">
                            <h1 className="text-6xl text-white text-center font-bold mb-8">Step 1.</h1>
                        </Link>
                        <div ref={wifiQrRef} className="mb-4"></div>
                        <p className="text-2xl text-center text-white">スキャンして Wi-Fi に接続</p>
                    </div>
                    <div>
                        <h2 className="text-6xl text-white text-center font-bold mb-8">Step 2.</h2>
                        <div ref={serverQrRef} className="mb-4"></div>
                        <p className="text-2xl text-center text-white">スキャンしてサーバーに接続</p>
                    </div>
                    <div>
                        <h2 className="text-6xl text-white text-center font-bold mb-8">Step 3.</h2>
                        <div ref={festivalQrRef} className="mb-4"></div>
                        <p className="text-2xl text-center text-white">スキャンしてフェスティバルを楽しむ</p>
                    </div>
                </div>
            </main>
        </div>
    );
}