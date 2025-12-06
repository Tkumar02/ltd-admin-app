// src/layout/MainLayout.jsx

export default function MainLayout({ children }) {
    return (
        <div className="min-h-screen flex">

            {/* Sidebar */}
            <aside className="w-64 bg-gray-900 text-white p-6 space-y-6">
                <h1 className="text-3xl font-bold text-red-600 mb-4">Admin App</h1>

                <nav className="flex flex-col space-y-3">
                    <a href="#" className="text-yellow-400 hover:text-green-400">Dashboard</a>
                    <a href="#" className="text-pink-400 hover:text-purple-400">Expenses</a>
                    <a href="#" className="text-blue-400 hover:text-indigo-400">Dividends</a>
                    <a href="#" className="text-green-400 hover:text-blue-400">Filings</a>
                    <a href="#" className="text-orange-400 hover:text-red-400">Company Settings</a>
                </nav>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-10 bg-gray-100">
                <h1 className="text-4xl font-bold text-blue-600 mb-4">Dashboard</h1>
                <p className="text-gray-700 text-lg">
                    Your ltd company overview will appear here.
                </p>
                <div className="mt-6 p-4 bg-red-500 text-white rounded">
                    Tailwind is definitely working!
                </div>
            </main>

        </div>
    );
}
