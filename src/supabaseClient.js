// src/supabaseClient.js (这是修改后的代码)
import { createClient } from '@supabase/supabase-js'

// --- ⬇️ 1. START: 导入我们创建的 configService ⬇️ ---
import { getAppConfig, isAppConfigured } from './services/configService';
// --- ⬆️ 1. END: 导入 ⬆️ ---


// --- ⬇️ 2. START: 动态初始化逻辑 ⬇️ ---
// 移除旧的 import.meta.env 行
// const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
// const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

let supabase = null;

// 检查应用是否已经配置
// (这会在 import 时运行, 也就是在 main.jsx 渲染之前)
if (isAppConfigured()) {
    // 如果已配置, 则从 localStorage 读取 Key
    const { supabaseUrl, supabaseAnonKey } = getAppConfig();

    // 使用从 localStorage 来的 Key 创建客户端
    supabase = createClient(supabaseUrl, supabaseAnonKey);
} else {
    // 如果未配置, 客户端保持为 null
    // 我们的 "Key 守卫" (在 main.jsx) 会阻止 <App /> 和 <AuthProvider> 加载
    // 所以当 <ConfigScreen /> 显示时, supabase 为 null 是安全的
    console.warn("Supabase client not initialized. App configuration missing.");
}
// --- ⬆️ 2. END: 动态初始化逻辑 ⬆️ ---


// 创建并导出 Supabase 客户端
// (现在导出的是可能为 null 的 supabase 变量)
export { supabase }