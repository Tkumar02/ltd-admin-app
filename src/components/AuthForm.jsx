import { useState, useEffect } from "react";
import { auth, loginWithEmail, registerWithEmail, logout, resetPassword } from "../firebase/firebaseAuth.jsx";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import 'react-toastify/dist/ReactToastify.css';

export default function AuthForm({ onUserChange }) {
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [user, setUser] = useState(null);
    const [isRegistering, setIsRegistering] = useState(false);
    const navigate = useNavigate();

    useEffect(() => {
        const unsubscribe = auth.onAuthStateChanged((currentUser) => {
            setUser(currentUser);
            if (onUserChange) onUserChange(currentUser);
        });
        return () => unsubscribe();
    }, [onUserChange]);

    const handleLogin = async (e) => {
        e.preventDefault();
        try {
            await loginWithEmail(email, password);
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (password !== confirmPassword) {
            toast.error("Passwords do not match");
            return;
        }
        try {
            await registerWithEmail(email, password);
            navigate('/dashboard');
        } catch (err) {
            toast.error(err.message);
        }
    };

    const handleResetPassword = async () => {
        console.log('Attempting reset for:', email);
        if (!email) {
            toast.warn("Enter your email address first");
            return;
        }
        try {
            await resetPassword(email);
            toast.success("Reset link sent to your inbox");
        } catch (err) {
            console.error(err);
            toast.error(err.message);
        }
    };

    if (user) {
        return (
            <div className="min-h-[60vh] flex items-center justify-center p-6">
                <div className="bg-white dark:bg-slate-900 p-10 rounded-[3rem] shadow-2xl border border-slate-200 dark:border-slate-800 text-center max-w-sm w-full">
                    <div className="w-20 h-20 bg-emerald-500/10 text-emerald-500 rounded-full flex items-center justify-center mx-auto mb-6 text-3xl">✓</div>
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-2">Authenticated</h2>
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-10">{user.email}</p>
                    <button onClick={() => navigate('/dashboard')} className="w-full bg-slate-900 dark:bg-white dark:text-slate-900 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-lg hover:scale-105 transition-all">Go to Dashboard</button>
                    <button onClick={() => logout()} className="w-full mt-4 py-2 text-slate-400 font-black text-[9px] uppercase tracking-widest hover:text-rose-500 transition-all">Sign Out</button>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-6 bg-[#FDFCF8] dark:bg-[#0A0D14] transition-colors duration-700">
            <div className="max-w-md w-full">
                
                <div className="text-center mb-10">
                    <h1 className="text-6xl font-black text-slate-900 dark:text-white tracking-tighter uppercase italic">
                        Fin<span className="text-indigo-600">Nexa</span>
                    </h1>
                    <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-400 mt-2">Intelligent Finance</p>
                </div>

                <div className="bg-white dark:bg-[#121721] p-10 rounded-[3rem] shadow-2xl border border-slate-200/60 dark:border-slate-800">
                    <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase italic tracking-tighter mb-8">
                        {isRegistering ? "Get Started" : "Secure Login"}
                    </h2>

                    <form onSubmit={isRegistering ? handleRegister : handleLogin} className="space-y-5">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Email</label>
                            <input
                                type="email"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Password</label>
                            <input
                                type="password"
                                className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                required
                            />
                        </div>

                        {isRegistering ? (
                            <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-500">
                                <label className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Confirm Password</label>
                                <input
                                    type="password"
                                    className="w-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700 p-4 rounded-2xl text-slate-900 dark:text-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    required={isRegistering}
                                />
                            </div>
                        ) : (
                            <div className="flex justify-end px-1">
                                <button 
                                    type="button" 
                                    onClick={handleResetPassword}
                                    className="text-[9px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors"
                                >
                                    Forgot Password?
                                </button>
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-slate-900 dark:bg-white text-white dark:text-slate-900 py-5 mt-4 rounded-2xl font-black text-[11px] uppercase tracking-[0.3em] shadow-xl hover:scale-[1.02] active:scale-95 transition-all"
                        >
                            {isRegistering ? "Create Account" : "Sign In"}
                        </button>
                    </form>

                    <div className="mt-8 text-center border-t border-slate-100 dark:border-slate-800 pt-8">
                        <button
                            className="text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-indigo-500 transition-colors"
                            onClick={() => {
                                setIsRegistering(!isRegistering);
                                setConfirmPassword("");
                            }}
                        >
                            {isRegistering ? "Back to Login" : "New to FinNexa? Register"}
                        </button>
                    </div>
                </div>
            </div>
            <ToastContainer position="bottom-center" theme="dark" autoClose={3000} />
        </div>
    );
}