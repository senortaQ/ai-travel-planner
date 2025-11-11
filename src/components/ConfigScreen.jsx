// src/components/ConfigScreen.jsx (已更新)

import React, { useState } from 'react';
import { saveAppConfig, getAppConfig } from '../services/configService';

export const ConfigScreen = () => {
    const [config, setConfig] = useState(getAppConfig());

    const handleChange = (e) => {
        setConfig({ ...config, [e.target.name]: e.target.value });
    };

    const handleSave = () => {
        saveAppConfig(config);
        alert('配置已保存！应用即将重新加载。');
        window.location.reload();
    };

    // 样式（保持不变）
    const styles = {
        container: { fontFamily: 'Arial, sans-serif', display: 'flex', flexDirection: 'column', gap: '15px', maxWidth: '600px', margin: '80px auto', padding: '30px', border: '1px solid #ddd', borderRadius: '10px', boxShadow: '0 4px 12px rgba(0,0,0,0.05)' },
        input: { padding: '12px', fontSize: '16px', border: '1px solid #ccc', borderRadius: '5px' },
        label: { fontWeight: 'bold', fontSize: '16px', marginBottom: '-5px' },
        button: { padding: '12px 20px', background: '#007bff', color: 'white', border: 'none', cursor: 'pointer', fontSize: '16px', borderRadius: '5px', marginTop: '10px' },
        header: { fontSize: '24px', fontWeight: 'bold', textAlign: 'center', marginBottom: '10px' }
    };

    return (
        <div style={styles.container}>
            <h2 style={styles.header}>✈️ AI 旅行规划师 - 项目配置</h2>
            <p>请在下方输入您的 API Keys 以运行本项目。(助教请粘贴我私下提供的 Keys)</p>

            <label style={styles.label}>SupABASE URL:</label>
            <input name="supabaseUrl" value={config.supabaseUrl || ''} onChange={handleChange} style={styles.input} placeholder="https://xxx.supabase.co" />

            <label style={styles.label}>SupABASE Anon Key:</label>
            <input name="supabaseAnonKey" value={config.supabaseAnonKey || ''} onChange={handleChange} style={styles.input} placeholder="ey..." />

            <label style={styles.label}>Amap Key (高德地图):</label>
            <input name="amapKey" value={config.amapKey || ''} onChange={handleChange} style={styles.input} placeholder="您的高德地图JS API Key" />

            {/* --- ⬇️ 新增的输入框 ⬇️ --- */}
            <label style={styles.label}>Amap Security Secret (高德安全密钥):</label>
            <input name="amapSecuritySecret" value={config.amapSecuritySecret || ''} onChange={handleChange} style={styles.input} placeholder="您的高德地图安全密钥 Jscode" />
            {/* --- ⬆️ 新增的输入框 ⬆️ --- */}

            <label style={styles.label}>AI Key (Dashscope):</label>
            <input name="aiKey" value={config.aiKey || ''} type="password" onChange={handleChange} style={styles.input} placeholder="sk-..." />

            <button onClick={handleSave} style={styles.button}>保存并运行</button>
        </div>
    );
};