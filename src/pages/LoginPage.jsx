// src/pages/LoginPage.jsx
import { useState } from 'react';
import { supabase } from '../supabaseClient';
import { useNavigate } from 'react-router-dom';
import styles from './LoginPage.module.css'; // 1. 引入 CSS Module


function translateErrorMessage(message) {
    // 1. 安全检查，防止 message 为 null 或 undefined
    if (!message) {
        return '发生未知错误，请稍后重试。';
    }

    // 2. 转换为小写，用于不区分大小写的匹配
    const lowerCaseMessage = message.toLowerCase();

    // 3. 使用 .includes() 进行模糊匹配
    if (lowerCaseMessage.includes('invalid login credentials')) {
        return '邮箱或密码不正确，请重试。';
    }
    if (lowerCaseMessage.includes('email not confirmed')) {
        return '您的邮箱尚未验证，请检查收件箱并点击确认链接。';
    }
    if (lowerCaseMessage.includes('user already registered')) {
        return '此邮箱地址已被注册，请直接登录。';
    }
    if (lowerCaseMessage.includes('password should be at least 6 characters')) {
        return '密码必须至少包含 6 个字符。';
    }
    if (lowerCaseMessage.includes('invalid format')) {
        // 检查 "invalid format" 通常就足够判断邮箱格式
        return '邮箱地址格式不正确。';
    }
    if (lowerCaseMessage.includes('rate limit exceeded')) {
        return '操作过于频繁（例如，邮件发送过多），请稍后再试。';
    }
    if (lowerCaseMessage.includes('networkerror') || lowerCaseMessage.includes('failed to fetch')) {
        // 捕获网络连接失败
        return '网络连接失败，请检查您的网络设置。';
    }

    // 4. Fallback (备用)
    // 如果遇到一个我们没见过的错误, 在控制台打印出来, 方便我们未来添加
    console.warn(`[Supabase 翻译] 未捕获的错误: ${message}`);

    // 返回一个通用的中文错误
    return message;
}
function LoginPage() {
    const [isLoginView, setIsLoginView] = useState(true); // true 为登录, false 为注册
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(''); // 成功消息
    const [errorMessage, setErrorMessage] = useState(''); // 错误消息
    const navigate = useNavigate();

    // 统一的提交处理
    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        setMessage('');
        setErrorMessage('');

        let error = null;

        if (isLoginView) {
            // --- 登录逻辑 ---
            const { data, error: loginError } = await supabase.auth.signInWithPassword({
                email: email,
                password: password,
            });
            error = loginError;
            if (!error) {
                navigate('/dashboard'); // 登录成功，跳转
            }
        } else {
            // --- 注册逻辑 ---
            const { data, error: signUpError } = await supabase.auth.signUp({
                email: email,
                password: password,
            });
            error = signUpError;
            if (!error) {
                setMessage('注册成功！请检查您的邮箱以激活账户。');
            }
        }

        if (error) {
            setErrorMessage(translateErrorMessage(error.message));
        }

        setLoading(false);
    };

    // 切换视图
    const toggleView = () => {
        setIsLoginView(!isLoginView);
        // 切换时清空消息和表单
        setMessage('');
        setErrorMessage('');
        setEmail('');
        setPassword('');
    };

    return (
        <div className={styles.container}>
            <h2 className={styles.title}>{isLoginView ? '登录' : '注册'}</h2>

            {/* 消息提示区域 */}
            {message && <p className={styles.message}>{message}</p>}
            {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

            <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                    <label htmlFor="email">邮箱</label>
                    <input
                        id="email"
                        type="email"
                        className={styles.inputField}
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        placeholder="you@example.com"
                    />
                </div>
                <div className={styles.inputGroup}>
                    <label htmlFor="password">密码</label>
                    <input
                        id="password"
                        type="password"
                        className={styles.inputField}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        placeholder="••••••••"
                    />
                </div>
                <button type="submit" className={styles.submitButton} disabled={loading}>
                    {loading ? '处理中...' : (isLoginView ? '登录' : '注册')}
                </button>
            </form>

            <button onClick={toggleView} className={styles.toggleButton}>
                {isLoginView ? '还没有账户？点击注册' : '已有账户？点击登录'}
            </button>
        </div>
    );
}

export default LoginPage;