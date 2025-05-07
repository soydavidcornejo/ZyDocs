// src/lib/firebase/config.ts
import { initializeApp, getApps, getApp, type FirebaseApp } from "firebase/app";
import { getAuth } from "firebase/auth";
// import { getFirestore } from "firebase/firestore"; // Uncomment if you need Firestore

// ----------------------------------------------------------------------------------
// IMPORTANT: Firebase Configuration Error (auth/api-key-not-valid)
// ----------------------------------------------------------------------------------
// If you are seeing an error like "Firebase: Error (auth/api-key-not-valid...)",
// it means your Firebase API key is missing or incorrect.
//
// TO FIX THIS:
// 1. Create a file named `.env.local` in the root directory of your project (next to `package.json`).
// 2. Copy the contents from `.env.local.example` (if it exists, or create one based on the example below)
//    into your new `.env.local` file.
// 3. Replace the placeholder values (e.g., "your-api-key" or "YOUR_FIREBASE_API_KEY") with your *actual* Firebase
//    project credentials. You can find these in your Firebase project settings on the
//    Firebase console.
// 4. Ensure all environment variables intended for client-side use are prefixed with `NEXT_PUBLIC_`.
// 5. Restart your development server (e.g., `npm run dev`) after creating or modifying
//    the `.env.local` file.
//
// Example .env.local content (also see .env.local.example):
// NEXT_PUBLIC_FIREBASE_API_KEY="your-actual-api-key"
// NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="your-actual-auth-domain"
// NEXT_PUBLIC_FIREBASE_PROJECT_ID="your-actual-project-id"
// NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="your-actual-storage-bucket"
// NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="your-actual-messaging-sender-id"
// NEXT_PUBLIC_FIREBASE_APP_ID="your-actual-app-id"
// GOOGLE_API_KEY="your-google-ai-studio-api-key" # For server-side Genkit
// ----------------------------------------------------------------------------------

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "your-api-key",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "your-auth-domain",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "your-project-id",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "your-storage-bucket",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "your-messaging-sender-id",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "your-app-id",
};

let app: FirebaseApp;

if (!getApps().length) {
  app = initializeApp(firebaseConfig);
} else {
  app = getApp();
}

const auth = getAuth(app);
// const db = getFirestore(app); // Uncomment if you need Firestore

export { app, auth /*, db */ };
