// utils/getCurrentUser.js
import { useState, useEffect } from "react";
import { auth } from "../firebase/firebaseConfig";

/**
 * Custom hook to return the currently logged-in user.
 * Returns null until Firebase auth state is ready.
 */
const useCurrentUser = () => {
    const [user, setUser] = useState(null);

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged(firebaseUser => {
            setUser(firebaseUser);
        });
        return unsubscribe;
    }, []);

    return user;
};

export default useCurrentUser;
