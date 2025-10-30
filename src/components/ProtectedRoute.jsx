// src/components/ProtectedRoute.jsx
import { Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children }) {
    const { session } = useAuth();

    if (!session) {
        // 如果没有 session (未登录)，则重定向到 /login 页面
        return <Navigate to="/login" replace />;
    }

    // 如果已登录，则正常显示子组件 (例如 DashboardPage)
    return children;
}

export default ProtectedRoute;