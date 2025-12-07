# HTTPS Development Setup for Camera Access

## Why HTTPS is Required

Modern browsers (especially mobile Safari and Chrome) require HTTPS for accessing camera and microphone due to security reasons. When accessing your dev server via IP address (e.g., `192.168.1.x:3000`) from mobile devices, `navigator.mediaDevices` will be `undefined` without HTTPS.

## Setup Instructions

### Step 1: Run Development Server with HTTPS

Certificate files are already included in the repository, so you can run immediately:

```bash
npm run dev:https
```

---

# カメラアクセス用HTTPS開発環境セットアップ

## HTTPSが必要な理由

最新のブラウザ（特にモバイルのSafariやChrome）は、セキュリティ上の理由から、カメラやマイクへのアクセスにHTTPSを必要とします。モバイルデバイスからIPアドレス（例：`192.168.1.x:3000`）で開発サーバーにアクセスする場合、HTTPSがないと`navigator.mediaDevices`が`undefined`になります。

## セットアップ手順

### ステップ1：HTTPSで開発サーバーを起動

証明書ファイルはリポジトリに含まれているので、すぐに実行できます：

```bash
npm run dev:https
```
