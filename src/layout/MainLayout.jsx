import { useState } from "react";
import { Link, Outlet } from "react-router-dom";
import { logout, useAuth } from "../firebase/firebaseAuth.jsx";

export default function MainLayout() {
    const [isSidebarOpen, setSidebarOpen] = useState(false);
    const { user } = useAuth();

    const handleLogout = async () => {
        await logout();
    };

    return (
        /* THE COLOR UPGRADE: Slate-Blue Light Mode / Midnight Navy Dark Mode */
        <div className="min-h-screen flex flex-col md:flex-row bg-slate-200 dark:bg-[#07090E] transition-colors duration-500">

            {/* Mobile Top Bar - Solid Purple to match sidebar */}
            <div className="md:hidden flex items-center justify-between bg-[#2D1B4E] text-white p-4 shadow-lg relative z-50">
                <h1 className="flex-1 text-2xl font-black italic tracking-tighter text-purple-400 text-center ml-8">
                    FinNexa
                </h1>
                <button
                    className="text-white hover:text-purple-400 focus:outline-none p-2"
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={isSidebarOpen ? "M6 18L18 6M6 6l12 12" : "M4 6h16M4 12h16M4 18h16"} />
                    </svg>
                </button>
            </div>

            {/* Sidebar - Deep Royal Purple (Fixed color for both themes) */}
            <aside
                className={`
                    w-full md:w-72 p-8 space-y-8
                    bg-[#2D1B4E] text-white shadow-2xl
                    md:flex md:flex-col
                    ${isSidebarOpen ? "flex flex-col animate-in slide-in-from-top duration-300" : "hidden"}
                `}
            >
                <div className="hidden md:block">
                    <h1 className="text-3xl font-black italic tracking-tighter text-purple-400">FinNexa</h1>
                    <div className="h-1.5 w-10 bg-gradient-to-r from-purple-500 to-pink-500 mt-2 rounded-full"></div>
                </div>

                <nav className="flex flex-col space-y-2">
                    {/* Navigation with explicit bold color accents */}
                    <Link to="/dashboard" className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all hover:bg-white/10">
                        <span className="w-3 h-3 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.6)]"></span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-white">Dashboard</span>
                    </Link>
                    
                    <Link to="/company-settings" className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all hover:bg-white/10">
                        <span className="w-3 h-3 rounded-full bg-orange-500 shadow-[0_0_10px_rgba(249,115,22,0.6)]"></span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-white">Companies</span>
                    </Link>

                    <Link to="/revenue-history" className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all hover:bg-white/10">
                        <span className="w-3 h-3 rounded-full bg-purple-500 shadow-[0_0_10px_rgba(168,85,247,0.6)]"></span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-white">Revenue</span>
                    </Link>

                    <Link to="/expense-history" className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all hover:bg-white/10">
                        <span className="w-3 h-3 rounded-full bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.6)]"></span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-white">Expenditure</span>
                    </Link>

                    <Link to="/filings" className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all hover:bg-white/10">
                        <span className="w-3 h-3 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.6)]"></span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-white">Filings</span>
                    </Link>

                    <Link to="info" className="group flex items-center gap-4 px-4 py-3 rounded-2xl transition-all hover:bg-white/10">
                        <span className="w-3 h-3 rounded-full bg-sky-400 shadow-[0_0_10px_rgba(56,189,248,0.6)]"></span>
                        <span className="text-sm font-black uppercase tracking-widest text-slate-200 group-hover:text-white">Useful Info</span>
                    </Link>

                    <div className="pt-8 mt-4 border-t border-white/10">
                        <button 
                            onClick={handleLogout} 
                            className="w-full text-left px-4 py-2 text-[10px] font-black uppercase tracking-[0.3em] text-rose-400 hover:text-rose-300 transition-colors"
                        >
                            Logout
                        </button>
                    </div>
                </nav>

                {user && (
                    <div className="mt-auto p-5 bg-black/30 rounded-3xl border border-white/5">
                        <p className="text-[9px] font-black text-purple-400 uppercase tracking-[0.2em] mb-1">User</p>
                        <p className="text-[11px] font-bold text-slate-300 truncate">{user.email}</p>
                    </div>
                )}
            </aside>

            {/* Main content - Using a Blue-Slate background for Light Mode */}
            <main className="flex-1 overflow-y-auto bg-slate-100 dark:bg-[#07090E]">
                <div className="p-6 md:p-12">
                    <Outlet />
                </div>
            </main>
        </div>
    );
}