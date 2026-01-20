'use client';

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";

const QR_CONFIG = {
    radius: 0.1,
    ecLevel: 'H' as const,
    fill: '#fff',
    background: null,
    size: 512
};

const renderQrCode = async (element: HTMLDivElement, text: string) => {
    const QrCreator = await import('qr-creator');
    element.innerHTML = '';
    QrCreator.default.render({
        text,
        ...QR_CONFIG
    }, element);
};

export default function QRPage() {
    const [wifiName, setWifiName] = useState<string>('VirtualFestival');
    const [wifiPassword, setWifiPassword] = useState<string>('virtualfestival123');
    const [ipAddress, setIpAddress] = useState<string>('192.168.11.2');
    const [showQR, setShowQR] = useState(false);

    const wifiQrRef = useRef<HTMLDivElement>(null);
    const serverQrRef = useRef<HTMLDivElement>(null);
    const festivalQrRef = useRef<HTMLDivElement>(null);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        if (wifiName.trim() && wifiPassword.trim() && ipAddress.trim()) {
            setShowQR(true);
        }
    };

    useEffect(() => {
        if (!showQR) return;

        const WIFI_QR_TEXT = `WIFI:T:WPA;S:${wifiName};P:${wifiPassword};;`;
        const SERVER_QR_TEXT = `https://${ipAddress}:3001`;
        const FESTIVAL_QR_TEXT = `https://${ipAddress}:3000/controller`;

        const wifiQrElement = wifiQrRef.current;
        const serverQrElement = serverQrRef.current;
        const festivalQrElement = festivalQrRef.current;

        if (wifiQrElement) renderQrCode(wifiQrElement, WIFI_QR_TEXT);
        if (serverQrElement) renderQrCode(serverQrElement, SERVER_QR_TEXT);
        if (festivalQrElement) renderQrCode(festivalQrElement, FESTIVAL_QR_TEXT);

        return () => {
            if (wifiQrElement) wifiQrElement.innerHTML = '';
            if (serverQrElement) serverQrElement.innerHTML = '';
            if (festivalQrElement) festivalQrElement.innerHTML = '';
        };
    }, [showQR, wifiName, wifiPassword, ipAddress]);

    if (!showQR) {
        return (
            <div className="min-h-screen flex flex-col bg-[url('/background/background.jpg')] bg-cover bg-center">
                <div className="absolute inset-0 backdrop-blur-md"></div>
                <main className="container flex flex-col justify-center items-center mx-auto px-4 py-8 flex-1 z-10">
                    <div className="bg-white/10 backdrop-blur-lg rounded-2xl p-8 shadow-2xl max-w-md w-full">
                        <Image
                            src="/logo.svg"
                            alt="Virtual Festival Logo"
                            width={256}
                            height={128}
                            className="mx-auto mb-6"
                        />
                        <form onSubmit={handleSubmit} className="space-y-6">
                            <div>
                                <label htmlFor="wifiName" className="block text-white text-lg mb-2">
                                    WiFi名:
                                </label>
                                <input
                                    id="wifiName"
                                    type="text"
                                    value={wifiName}
                                    onChange={(e) => setWifiName(e.target.value)}
                                    placeholder="VirtualFestival"
                                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/60 border-2 border-white/30 focus:border-white/60 focus:outline-none text-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="wifiPassword" className="block text-white text-lg mb-2">
                                    WiFiパスワード:
                                </label>
                                <input
                                    id="wifiPassword"
                                    type="text"
                                    value={wifiPassword}
                                    onChange={(e) => setWifiPassword(e.target.value)}
                                    placeholder="virtualfestival123"
                                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/60 border-2 border-white/30 focus:border-white/60 focus:outline-none text-lg"
                                    required
                                />
                            </div>
                            <div>
                                <label htmlFor="ip" className="block text-white text-lg mb-2">
                                    IPv4アドレス:
                                </label>
                                <input
                                    id="ip"
                                    type="text"
                                    value={ipAddress}
                                    onChange={(e) => setIpAddress(e.target.value)}
                                    placeholder="192.168.11.3"
                                    className="w-full px-4 py-3 rounded-lg bg-white/20 text-white placeholder-white/60 border-2 border-white/30 focus:border-white/60 focus:outline-none text-lg"
                                    pattern="^(?:(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)\.){3}(?:25[0-5]|2[0-4][0-9]|[01]?[0-9][0-9]?)$"
                                    required
                                />
                            </div>
                            <button
                                type="submit"
                                className="w-full bg-white/20 hover:bg-white/30 text-white font-bold py-3 px-6 rounded-lg transition-all duration-200 text-lg border-2 border-white/30 hover:border-white/60 cursor-pointer"
                            >
                                QRコードを作成
                            </button>
                        </form>
                    </div>
                </main>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex flex-col bg-[url('/background/background.jpg')] bg-cover bg-center">
            <div className="absolute inset-0 backdrop-blur-md"></div>
            <main className="container flex flex-col justify-center mx-auto px-4 py-8 flex-1 z-10">
                <button
                    onClick={() => setShowQR(false)}
                    className="mb-8 self-center bg-white/20 hover:bg-white/30 text-white font-bold py-2 px-6 rounded-lg transition-all duration-200 border-2 border-white/30 hover:border-white/60 cursor-pointer"
                >
                    ← 設定を変更
                </button>
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