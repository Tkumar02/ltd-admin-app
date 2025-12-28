// utils/useAuth.js
import { useEffect, useState } from "react";
import { auth } from "../firebase/firebaseConfig";

export default function useAuth() {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((firebaseUser) => {
            setUser(firebaseUser);
            setLoading(false);
        });

        return () => unsubscribe(); // cleanup
    }, []);

    return { user, loading };
}
