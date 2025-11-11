// src/main.jsx
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { BrowserRouter } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext' // 1. 引入

// (这两个文件现在会报错，我们第二步来创建它们)
import { isAppConfigured } from './services/configService.js'
import { ConfigScreen } from './components/ConfigScreen.jsx'


// 检查所有 Key 是否都存在于 localStorage 中
const isConfigured = isAppConfigured();


ReactDOM.createRoot(document.getElementById('root')).render(
    <React.StrictMode>
        {isConfigured ? (
            // 如果 Key 存在 (isConfigured = true), 才加载 App
            <BrowserRouter>
                <AuthProvider>
                    <App />
                </AuthProvider>
            </BrowserRouter>
        ) : (
            // 如果 Key 不存在 (isConfigured = false), 只显示配置页面
            <ConfigScreen />
        )}
    </React.StrictMode>,
)