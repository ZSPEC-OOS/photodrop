# PhotoDrop

iPhone-friendly web app to create named photo folders, shoot or pick photos, and save everything to Firebase.

---

## Setup

### 1. Create a Firebase project
1. Go to [console.firebase.google.com](https://console.firebase.google.com)
2. Click **Add project**, give it a name (e.g. `photodrop`)
3. Enable **Firestore Database** → Start in **test mode**
4. Enable **Storage** → Start in **test mode**
5. Go to **Project Settings → Your apps → Web** and register a web app
6. Copy the config values shown

### 2. Configure environment
```bash
cp .env.example .env
```
Open `.env` and fill in your Firebase values:
```
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_AUTH_DOMAIN=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_STORAGE_BUCKET=...
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

### 3. Install dependencies
```bash
npm install
```

### 4. Run locally
```bash
npm run dev
```
Open the URL shown (e.g. `http://localhost:5173`) in your iPhone browser (Safari).

---

## Deploy to Firebase Hosting (access from iPhone anywhere)

```bash
npm install -g firebase-tools
firebase login
firebase use YOUR_PROJECT_ID       # or edit .firebaserc
npm run build
firebase deploy
```

Firebase will give you a URL like `https://your-project.web.app` — open that on your iPhone!

---

## How it works

| Feature | Details |
|---------|---------|
| **Header** | "PhotoDrop" title, back button, + button |
| **Create folder** | Enter a folder name, add photos from camera/library, tap **Done** |
| **Camera on iPhone** | Uses `<input capture="environment">` — offers camera or library |
| **Multiple photos** | Add as many as you want before saving |
| **Save** | Photos upload to Firebase Storage; folder saved to Firestore |
| **View folder** | Tap any folder card to browse photos; tap a photo to fullscreen |
| **Multiple folders** | Create as many folders as you want |
