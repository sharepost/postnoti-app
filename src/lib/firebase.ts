import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";
import { Platform } from "react-native";

const firebaseConfig = {
    apiKey: "AIzaSyDSbcig9-Xba-ISXAnt82GJtTwjrLBr6BY",
    authDomain: "postnoti-93d2e.firebaseapp.com",
    projectId: "postnoti-93d2e",
    storageBucket: "postnoti-93d2e.firebasestorage.app",
    messagingSenderId: "508156325119",
    appId: "1:508156325119:web:418d2ebc164990b38470ca",
    measurementId: "G-Y6K8DSJ7EE"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

let messaging: Messaging | null = null;
if (Platform.OS === 'web') {
    try {
        // 브라우저 환경에서만 실행
        if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
            messaging = getMessaging(app);
        }
    } catch (error) {
        console.error("Firebase Messaging failed to initialize", error);
    }
}

export { app, messaging, getToken, onMessage };
export const VAPID_KEY = "BBvo6Mqo2SNK4GXYSWzGng5Av3HV68suzyP-mWmifex2M_kK0LtPb16Ea87oMmkvhf7QDeR5EDTe1KYBQPxQxbg";
