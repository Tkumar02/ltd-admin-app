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
        <div className="min-h-screen flex flex-col md:flex-row">

            {/* Mobile top bar */}
            <div className="md:hidden flex items-center justify-between bg-gray-900 text-white p-4">
                <h1 className="text-2xl font-bold text-red-600">Admin App</h1>
                <button
                    className="text-white focus:outline-none"
                    onClick={() => setSidebarOpen(!isSidebarOpen)}
                >
                    {/* Hamburger icon */}
                    <svg
                        className="w-6 h-6"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                        xmlns="http://www.w3.org/2000/svg"
                    >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    </svg>
                </button>
            </div>

            {/* Sidebar */}
            <aside
                className={`
          bg-gray-900 text-white p-6 space-y-6
          md:flex md:flex-col md:w-64
          ${isSidebarOpen ? "flex flex-col" : "hidden"}
        `}
            >
                <h1 className="hidden md:block text-3xl font-bold text-red-600 mb-4">Admin App</h1>

                <nav className="flex flex-col space-y-3">
                    <Link to="#" className="text-yellow-400 hover:text-green-400">Dashboard</Link>
                    <Link to="#" className="text-pink-400 hover:text-purple-400">Expenses</Link>
                    <Link to="#" className="text-blue-400 hover:text-indigo-400">Dividends</Link>
                    <Link to="#" className="text-green-400 hover:text-blue-400">Filings</Link>
                    <Link to="/company-settings" className="text-orange-400 hover:text-red-400">Company Settings</Link>
                    <button onClick={handleLogout} className="text-red-500 hover:text-red-300">Logout</button>
                </nav>

                {user && (
                    <p className="text-gray-300 mt-4 text-sm">Logged in as: {user.email}</p>
                )}
            </aside>

            {/* Main content */}
            <main className="flex-1 p-6 md:p-10 bg-gray-100">
                <Outlet />
            </main>
        </div>
    );
}
