// src/App.jsx
import './App.css'; // 导入样式文件
import { Routes, Route, Link, useNavigate, useLocation } from 'react-router-dom'; // 导入 useLocation
import HomePage from './pages/HomePage';
import LoginPage from './pages/LoginPage';
import DashboardPage from './pages/DashboardPage';
import { useAuth } from './context/AuthContext';
import { supabase } from './supabaseClient';
import ProtectedRoute from './components/ProtectedRoute';
import TripDetailPage from './pages/TripDetailPage';
import BudgetDetailPage from './pages/BudgetDetailPage.jsx';

function App() {
    const { session, signOut } = useAuth(); // 从 AuthContext 获取 signOut 函数
    const navigate = useNavigate();
    const location = useLocation(); // 获取当前路由信息



    const handleLogout = async () => {
        const { error } = await signOut(); // 调用 AuthContext 提供的 signOut
        if (error) {
            console.error('Error logging out:', error.message);
        } else {
            navigate('/');
        }
    };

    // 辅助函数，判断链接是否激活
    const isActiveLink = (path) => {
        // 如果路径是 /dashboard，则判断当前路由是否以 /dashboard 开头
        // 这样 /dashboard 和 /dashboard/trip/:tripId 都会激活 "我的行程"
        if (path === "/dashboard") {
            return location.pathname.startsWith("/dashboard") || location.pathname.startsWith("/trip");
        }
        return location.pathname === path;
    };

    return (
        <div className="app-container">
            <header className="app-header">
                <h1>AI 旅行规划师</h1>
                <nav>
                    {/* 根据 isActiveLink 判断是否添加 active-link 类名 */}
                    <Link to="/" className={isActiveLink("/") ? "nav-link active-link" : "nav-link"}>
                        主页
                    </Link>

                    {session ? (
                        <>
                            <Link
                                to="/dashboard"
                                className={isActiveLink("/dashboard") ? "nav-link active-link" : "nav-link"}
                            >
                                我的行程
                            </Link>
                            <button onClick={handleLogout} className="logout-button">
                                登出
                            </button>
                        </>
                    ) : (
                        <Link to="/login" className={isActiveLink("/login") ? "nav-link active-link" : "nav-link"}>
                            登录/注册
                        </Link>
                    )}
                </nav>
            </header>

            <main className="app-main">
                <Routes>
                    <Route path="/" element={<HomePage />} />
                    <Route path="/login" element={<LoginPage />} />
                    <Route
                        path="/dashboard"
                        element={
                            <ProtectedRoute>
                                <DashboardPage />
                            </ProtectedRoute>
                        }
                    />
                    <Route
                        path="/trip/:tripId"
                        element={<ProtectedRoute><TripDetailPage /></ProtectedRoute>}
                    />
                    <Route
                        path="/trip/:tripId/budget"
                        element={<ProtectedRoute><BudgetDetailPage /></ProtectedRoute>}
                    />
                </Routes>
            </main>

            <footer className="app-footer">
                <p>© 2025 AI Travel Planner. It's just a homework.</p>
            </footer>
        </div>
    );
}

export default App;