// src/context/AuthContext.jsx (修复后)
import { createContext, useContext, useState, useEffect } from 'react';
import { supabase } from '../supabaseClient';

// 1. 创建 Context
const AuthContext = createContext();

// 2. 创建 Provider 组件
export function AuthProvider({ children }) {
    const [session, setSession] = useState(null);
    const [loading, setLoading] = useState(true);

    // [新增] 1. 实现登出函数
    const signOut = async () => {
        // 调用 Supabase 的注销 API
        const { error } = await supabase.auth.signOut();
        // onAuthStateChange 会自动处理状态更新，这里只需要返回结果
        return { error };
    };

    useEffect(() => {
        // 1. 立即获取当前 session
        supabase.auth.getSession().then(({ data: { session } }) => {
            setSession(session);
            setLoading(false);
        });

        // 2. 监听认证状态变化 (登录, 登出)
        const { data: { subscription } } = supabase.auth.onAuthStateChange(
            (_event, session) => {
                setSession(session); // 登出时，session 会被更新为 null
            }
        );

        // 3. 在组件卸载时取消监听
        return () => {
            subscription.unsubscribe();
        };
    }, []);

    // 4. [关键修复点] 确保 signOut 函数被暴露出去
    const value = {
        session,
        loading,
        signOut, // 👈 修复：现在 signOut 可供 App.jsx 调用
    };

    // 只有在 loading 结束后才渲染子组件
    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
}

// 3. 创建自定义 Hook (方便使用)
export function useAuth() {
    return useContext(AuthContext);
}