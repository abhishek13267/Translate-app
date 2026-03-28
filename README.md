# 🌐 Vaak AI: The Ultimate Neural-Audio Studio (V3.0-Hardened)

**Vaak AI** (वाक्) is a globally unique, high-security voice-to-voice translation ecosystem. Powered by the **Bodhi Intelligence Core** and built with the **MERN Stack**, it delivers enlightened, real-time linguistic processing with enterprise-grade security.

![Vaak AI Studio Mockup](file:///C:/Users/Abhi/.gemini/antigravity/brain/6c2949ca-6559-4614-90e2-a0c1200608c9/luminavox_screenshot_mockup_1774270842590.png)

---

## 🔥 **Core Capabilities**

- 🎙️ **Bodhi Voice Engine**: Real-time speech-to-text with neural multi-detect capabilities.
- 💬 **Conversation Mode**: Futuristic chat interface optimized for natural two-way dialogue.
- 🔊 **Vocal Customization**: Dynamic control over **Playback Speed (0.5x - 2.0x)** and **Vocal Gender** (Male/Female/Neutral).
- 🔐 **Dual-Token Auth**: High-security **Access (15m) + Refresh (7d)** token system for persistent, safe sessions.
- 🌐 **100+ Language Support**: High-fidelity translation for global locales, including localized **Bhojpuri (भोजपुरी)**.
- 💾 **Studio Export**: Instant `.mp3` audio downloads and native Web-Share API integration.
- 📱 **PWA Support**: Native-feeling installation on Android/iOS with custom brand identity.
- 🛡️ **Security Shield**: Integrated Helmet JS, NoSQL injection prevention, and XSS sanitization (DOMPurify).

---

## 🏗️ **Technical Architecture**

```mermaid
graph TD
    User((User)) -->|React + Vite| Frontend[Vaak AI Studio]
    Frontend -->|JWT Access/Refresh| Backend[Express.js Node Server]
    Backend -->|Mongoose| MongoDB[(Secure MongoDB Cloud)]
    
    subgraph Bodhi Engine Core
    Backend -->|Phase 1: STT| GoogleSTT[Neural Speech AI]
    Backend -->|Phase 2: Detect| GoogleTrans[AI Translation]
    Backend -->|Phase 3: Synthesis| GoogleTTS[Vocal Synthesis]
    end

    Backend -->|Monitoring| Health[/api/health]
    Backend -->|Logging| Winston[Sys/Error Logs]
```

---

## 🚀 **Installation & Rapid Setup**

### **1️⃣ Local Studio Launch**
1. **Clone & Install**:
   ```bash
   git clone https://github.com/your-username/vaak-ai.git
   npm run install-all
   ```
2. **Environment Configuration**:
   Create `backend/.env`:
   ```env
   PORT=5000
   MONGODB_URI=mongodb://localhost:27017/vaak-ai
   JWT_SECRET=strong_access_secret_32_chars
   REFRESH_SECRET=extreme_long_refresh_secret_64_chars
   ALLOWED_ORIGINS=http://localhost:5173
   GOOGLE_CREDENTIALS_JSON={ "paste_content_here": "..." }
   ```
3. **Ignite**:
   ```bash
   npm run dev
   ```

### **3️⃣ Running the Ecosystem (Daily Workflow)**

To get the studio up and running, you have two options:

#### **⚡ Option A: Visual One-Click Launch (Windows)**
Run the pre-configured batch file in the root directory:
- Double-click `run_vaak_ai.bat`
- This will automatically start both the Backend (Express) and Frontend (Vite) in separate terminal windows.

#### **🛠️ Option B: Manual Multi-Terminal Launch**
1. **Terminal 1 (Backend)**:
   ```bash
   cd backend
   npm run dev
   ```
   *Note: Ensure your MongoDB service is active.*

2. **Terminal 2 (Frontend)**:
   ```bash
   cd frontend
   npm run dev
   ```

3. **Access the App**:
   Open [http://localhost:3000](http://localhost:3000) (default) in your browser.

---

## 🛠️ **Troubleshooting Login/Signup**
If you encounter a `500 Internal Server Error` during authentication:
1. **Restart Backend**: This ensures the latest absolute environment pathing is loaded.
2. **Check MongoDB**: Run `sc query MongoDB` or check your task manager.
3. **Verify Proxy**: The frontend `vite.config.js` is set to proxy to `5050` or `5000`. Ensure your backend port in `.env` matches.

---

## 🔒 **Bodhi Security Shield (V3.0)**
- **Brute-Force Protection**: 5-attempt limit per 15 mins on logical entry.
- **Per-User Rate Limiting**: Automatic IP-throttling (100 reqs/15m) across APIs.
- **Data Protection**: Sensitive fields (Passwords/Tokens) are invisible by default via `{ select: false }`.
- **Injection Defense**: `mongo-sanitize` for NoSQL and `express-validator` for input sanitization.
- **XSS Mitigation**: Mandatory **DOMPurify** sanitization on all UI rendering.
- **Logging**: **Winston** (Sys/Error) + **Morgan** (Traffic) ecosystem—no internal stack traces exposed to clients.

---

## 📂 **Project Ecosystem**

```text
Vaak-AI/
├── backend/                # Bodhi Logic Hub
│   ├── config/             # DB & AI Driver Logic
│   ├── controllers/        # Auth (Access/Refresh), Translate, History
│   ├── middleware/         # Security & Identity Guards
│   ├── logs/               # Encrypted Winston System Logs
│   ├── models/             # Validated Data Models (Mongoose)
│   ├── routes/             # API Endpoints & Validations
│   └── server.js           # Express + Sockets + Monitoring Heartbeat
├── frontend/               # Premium Studio UI
│   ├── public/             # PWA Manifests & Icons
│   └── src/                
│       ├── App.jsx         # State-Driven Studio/Chat Interface
│       ├── App.css         # Fluid Glassmorphism Design System
│       └── languages.js    # Data Locale Registry
└── run_vaak_ai.bat         # Windows One-Click Starter
```

---

## 📊 **API Reference**
- **Auth**: `POST /api/auth/login`, `POST /api/auth/signup`, `POST /api/auth/refresh`
- **Engine**: `POST /api/translate`, `GET /api/history`
- **Health**: `GET /api/health` (Status monitoring)

---

Developed and secured by **Antigravity Studio**. ✨  
© 2026 **Vaak AI** | **Bodhi Intelligence Ecosystem**.
