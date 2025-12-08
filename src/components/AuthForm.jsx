import { useState, useEffect } from "react";
import { auth, loginWithEmail, registerWithEmail, logout } from "../firebase/firebaseAuth.jsx";
import { useNavigate } from "react-router-dom";

export default function AuthForm({ onUserChange }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [user, setUser] = useState(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const navigate = useNavigate();

    // Track logged-in user
    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (onUserChange) onUserChange(currentUser); // pass up to parent
        });
        return () => unsubscribe();
    }, [onUserChange]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await loginWithEmail(email, password);
            setEmail("");
            setPassword("");
            navigate('/company-settings')
        } catch (err) {
            alert(err.message);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        try {
            await registerWithEmail(email, password);
            setEmail("");
            setPassword("");
        } catch (err) {
            alert(err.message);
        }
    };

    const handleLogout = async () => {
        await logout();
    };

    if (user) {
        return (
            <div className="p-4 max-w-md mx-auto">
                <p className="mb-2">Logged in as: {user.email}</p>
                <button onClick={handleLogout} className="bg-red-600 text-white px-4 py-2 rounded">
                    Logout
                </button>
            </div>
        );
    }

    return (
        <div className="p-4 max-w-md mx-auto">
            <h2 className="text-xl font-bold mb-4">{isRegistering ? "Register" : "Login"}</h2>
            <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-4">
                <div>
                    <label className="block mb-1">Email</label>
                    <input
                        type="email"
                        className="w-full p-2 border rounded"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                    />
                </div>
                <div>
                    <label className="block mb-1">Password</label>
                    <input
                        type="password"
                        className="w-full p-2 border rounded"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                    />
                </div>
                <button
                    type="submit"
                    className="bg-blue-600 text-white px-4 py-2 rounded"
                >
                    {isRegistering ? "Register" : "Login"}
                </button>
            </form>
            <p className="mt-2 text-sm">
                {isRegistering ? "Already have an account?" : "Don't have an account?"}{" "}
                <button
                    className="text-blue-500 underline"
                    onClick={() => setIsRegistering(!isRegistering)}
                >
                    {isRegistering ? "Login" : "Register"}
                </button>
            </p>
        </div>
    );
}
