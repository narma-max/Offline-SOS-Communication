# 🚨 Offline Emergency SOS Communication System (PWA)

> **Student Engineering Project**  
> A fully responsive Progressive Web App (PWA) simulating an offline emergency SOS communication protocol with device GPS location capture, manual simulation coordinates, tactical radar preview, and bidirectional receiver acknowledgements.

---

## ⚠️ Important Academic & Technical Disclaimer

* **Simulation Only:** This software is a **browser-based simulation**. It does **NOT** use actual Bluetooth Low Energy (BLE), LoRaWAN, RF, satellite, or mesh radio hardware.
* **PWA Offline Availability vs. Wireless Simulation:** 
  * The Progressive Web App (PWA) Service Worker caches the HTML/CSS/JavaScript interface so it opens **without an internet connection**.
  * The SOS transmission between Sender and Receiver occurs **locally inside browser memory via simulated propagation delay and range algorithms**.
* **GPS Capture:** Live coordinates are fetched via the standard **W3C Browser Geolocation API**. GPS acquisition does not represent or prove offline wireless message delivery.

---

## 🌟 Key Features

1. **Progressive Web App (PWA):**
   * Pre-cached application shell via `service-worker.js` (Cache-First strategy).
   * Web App Manifest (`manifest.json`) with maskable and standard emergency icons.
   * Native "Add to Home Screen" install prompt (`📲 Install App`).
   * Real-time online/offline network connectivity indicator (`🌐 Online` vs `📴 Offline (Cached)`).

2. **Mobile & Cross-Platform Responsive Layout:**
   * Optimized for Android smartphones, tablets, and desktop/laptop screens.
   * Mobile-specific dashboard switcher (`📤 Sender` | `📡 Channel` | `📥 Receiver` | `📋 All`).
   * Touch-friendly tap targets (&ge; 48px) and accessible red emergency SOS trigger button.
   * Smooth horizontal touch-scrolling scenario bar.

3. **GPS Location Sharing & Coordinate Simulation:**
   * **Live Device GPS:** Captures live Latitude, Longitude, Accuracy radius, and Timestamp via browser Geolocation.
   * **Permission Handling:** Visual statuses for `AVAILABLE ✅`, `PERMISSION DENIED ❌`, and `UNAVAILABLE ⚠️`.
   * **Manual / Simulated Coordinates:** Fallback coordinate entry with regional presets (*Urban Center*, *Mountain Trail*, *Coastal Port*).
   * **Strict Source Attribution:** Visually distinguishes `🛰️ Live Device GPS` from `📝 Simulated / Manual`.

4. **Interactive Mapping:**
   * **100% Offline Tactical Radar:** An embedded coordinate grid with crosshairs, distance rings, and beacon animation that requires zero external network requests.
   * **Online Map Links:** Direct one-click links to **OpenStreetMap** and **Google Maps** when internet is available.

5. **Simulated Offline Communication Channel:**
   * Configurable Communication Range (10–100 units) and Sender Distance (0–150 units).
   * Real-time signal strength meter (100% Strong &rarr; 0% Out-of-Range).
   * Channel power switch (Enabled / Disabled) with animated wave visualizer.
   * Simulated propagation delay slider (500–5000 ms) with progress bar.

6. **Bidirectional Acknowledgment Loop:**
   * Receiver reviews incoming SOS cards and clicks **✔ Acknowledge SOS**.
   * Sender Dashboard immediately updates to confirm **`ACK RECEIVED ✓`** and **`ACKNOWLEDGED ✓`**.

7. **Audit Event Log:**
   * Color-coded, chronological event record tracking attempts, GPS locks, failures, and acknowledgements.

---

## 📁 Project Structure

```
Offline SOS/
├── index.html           # Main PWA application markup & responsive layout
├── style.css            # Dark emergency UI, responsive grid & tactical radar styling
├── app.js               # Application logic, simulation engine, GPS & PWA handlers
├── service-worker.js    # Service Worker caching offline shell assets
├── manifest.json        # PWA Web App Manifest
├── vercel.json          # Deployment configuration for Vercel
├── .gitignore           # Git ignore file for GitHub repository
├── README.md            # Project documentation & testing guide
└── icons/               # Application icons
    ├── icon.svg         # Scalable vector icon
    ├── icon-192.png     # PWA standard icon (192x192)
    ├── icon-512.png     # PWA standard icon (512x512)
    ├── icon-maskable-192.png # Android maskable icon (192x192)
    └── icon-maskable-512.png # Android maskable icon (512x512)
```

---

## 🚀 How to Run Locally

### Method 1: Open Directly in Browser
Double-click `index.html` or run in PowerShell:
```powershell
Start-Process "index.html"
```

### Method 2: Local HTTP Server (Recommended for PWA Testing)
Service Workers require `localhost` or HTTPS. In PowerShell:
```powershell
# Using Python
python -m http.server 8000

# OR using Node.js
npx serve .
```
Then navigate to: **`http://localhost:8000`**

---

## 🧪 Step-by-Step Testing Guide

### 1. Test PWA Offline Cache
1. Serve the app over a local HTTP server (`http://localhost:8000`).
2. Open Chrome/Edge Developer Tools (<kbd>F12</kbd>) &rarr; **Application** tab &rarr; **Service Workers**.
3. Verify that `service-worker.js` is registered and active.
4. Go to **Network** tab &rarr; check **Offline**.
5. Refresh the page: the interface will load seamlessly from the Service Worker cache, and the header badge will switch to **`📴 Offline (Cached)`**.

### 2. Test Mobile Dashboard Navigation
1. In Developer Tools, toggle the Device Toolbar (<kbd>Ctrl</kbd> + <kbd>Shift</kbd> + <kbd>M</kbd>) and select **Pixel 7** or **iPhone 14**.
2. Notice the mobile navigation bar:
   * Tap **`📤 Sender`** &rarr; displays only the Sender module.
   * Tap **`📡 Channel`** &rarr; displays the simulated channel controls.
   * Tap **`📥 Receiver`** &rarr; displays received emergency cards.
   * Tap **`📋 All`** &rarr; displays the full vertical stack.

### 3. Test Live GPS & Manual Coordinates
* **Live GPS:** In the Sender Dashboard, click **`🛰️ Get Live GPS`** and grant permission in the browser.
* **Manual Coordinates:** Click **`✏️ Manual Coords`**, pick **`⛰️ Mountain Peak`**, and click **`✔ Apply Manual Coordinates`**.

### 4. Test Transmission & Round-Trip Acknowledgment
1. In the Sender Dashboard, click **`🆘 SEND SOS`**.
2. Watch the Channel progress bar animate over the simulated transmission delay.
3. In the Receiver Dashboard, inspect the incoming card:
   * Displays coordinates, `📝 Simulated / Manual` badge, and tactical radar.
4. Click **`✔ Acknowledge SOS`** on the message card.
5. In the Sender Dashboard, verify the **ACK Status** turns to **`ACKNOWLEDGED ✓`** (green).

### 5. Automated Diagnostics Suite
Click **`🧪 Full Test Suite`** in the top bar to run an automated 4-step sequence:
1. Channel Disabled Check (Rejection test)
2. Out-of-Range Check (Distance threshold test)
3. In-Range Transmission with Coordinates (Delivery test)
4. Receiver Acknowledgement (Round-trip verification)

---

## 🌐 Deployment Instructions

### Deploy to Vercel (Zero Configuration)
The project includes a ready-to-use [`vercel.json`](vercel.json).
1. Install Vercel CLI (optional) or connect via GitHub:
   ```bash
   npm i -g vercel
   vercel
   ```
2. Or push to a GitHub repository, open [vercel.com](https://vercel.com), and click **Import Project**. Vercel will automatically serve the static assets and PWA files over HTTPS.

### Deploy to GitHub Pages
1. Push repository to GitHub:
   ```bash
   git init
   git add .
   git commit -m "Initial commit of Offline SOS PWA"
   git branch -M main
   git remote add origin https://github.com/<your-username>/<your-repo-name>.git
   git push -u origin main
   ```
2. In your GitHub repository, navigate to **Settings** &rarr; **Pages** &rarr; Select `main` branch / `root` &rarr; Click **Save**.
3. Access your published HTTPS URL.

