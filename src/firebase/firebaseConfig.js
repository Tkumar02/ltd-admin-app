import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
    apiKey: "AIzaSyDpw6W-GngkZXL7HLpOUPBX1w1IE_CkQBE",
    authDomain: "projsept-e73a6.firebaseapp.com",
    projectId: "projsept-e73a6",
    storageBucket: "projsept-e73a6.firebasestorage.app",
    messagingSenderId: "109081553472",
    appId: "1:109081553472:web:eacd55c6259ef28f2a4da5",
    measurementId: "G-8WKC4V4H7H"
};

export const app = initializeApp(firebaseConfig);

export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);

export default app;
