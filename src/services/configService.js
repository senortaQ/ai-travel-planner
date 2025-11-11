// src/services/configService.js (已更新)

// 统一定义 Key 的名称
export const CONFIG_KEYS = {
    SUPABASE_URL: 'SUPABASE_URL',
    SUPABASE_ANON_KEY: 'SUPABASE_ANON_KEY',
    AMAP_KEY: 'AMAP_KEY',
    AMAP_SECURITY_SECRET: 'AMAP_SECURITY_SECRET', // <-- 新增
    AI_KEY: 'AI_KEY',
};

// 保存配置到 localStorage
export const saveAppConfig = (config) => {
    localStorage.setItem(CONFIG_KEYS.SUPABASE_URL, config.supabaseUrl || '');
    localStorage.setItem(CONFIG_KEYS.SUPABASE_ANON_KEY, config.supabaseAnonKey || '');
    localStorage.setItem(CONFIG_KEYS.AMAP_KEY, config.amapKey || '');
    localStorage.setItem(CONFIG_KEYS.AMAP_SECURITY_SECRET, config.amapSecuritySecret || ''); // <-- 新增
    localStorage.setItem(CONFIG_KEYS.AI_KEY, config.aiKey || '');
};

// 从 localStorage 读取配置
export const getAppConfig = () => {
    return {
        supabaseUrl: localStorage.getItem(CONFIG_KEYS.SUPABASE_URL),
        supabaseAnonKey: localStorage.getItem(CONFIG_KEYS.SUPABASE_ANON_KEY),
        amapKey: localStorage.getItem(CONFIG_KEYS.AMAP_KEY),
        amapSecuritySecret: localStorage.getItem(CONFIG_KEYS.AMAP_SECURITY_SECRET), // <-- 新增
        aiKey: localStorage.getItem(CONFIG_KEYS.AI_KEY),
    };
};

// 检查所有 Key 是否都已配置 (不为空)
export const isAppConfigured = () => {
    const config = getAppConfig();
    // 检查 config 对象中的所有值是否都存在且不为空字符串
    return Object.values(config).every(value => value && value.trim() !== '');
};