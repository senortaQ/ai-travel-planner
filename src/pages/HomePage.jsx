// src/pages/HomePage.jsx
import React from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import styles from './HomePage.module.css';

// 假设图标来自某个库，这里用 emoji 代替
const FEATURES = [
    { icon: '🤖', title: 'AI 智能规划', description: '一句话生成详细行程，节省数小时搜索时间。' },
    { icon: '💰', title: '预算实时追踪', description: 'AI 估算开支，并记录实际花费，拒绝超预算。' },
    { icon: '✈️', title: '景点路线优化', description: '基于地理位置和时间，智能推荐最佳游玩路线。' },
];

function HomePage() {
    // 获取 session 来判断显示登录/创建行程按钮
    const { session } = useAuth();
    const isAuthenticated = !!session;

    return (
        <div className={styles.container}>

            {/* 1. 顶部英雄区 (Hero Section) */}
            <section className={styles.heroSection}>
                <h1 className={styles.heroTitle}>
                    告别繁琐攻略，让AI规划您的完美旅行！
                </h1>
                <p className={styles.heroSubtitle}>
                    AI 旅行规划师，根据您的偏好、预算和时间，秒速生成专属行程。
                </p>

                {/* CTA 按钮 */}
                <Link
                    to={isAuthenticated ? "/dashboard" : "/login"}
                    className={styles.ctaButton}
                >
                    {isAuthenticated ? "立即开始创建新行程" : "登录/注册，开始免费规划"}
                </Link>
            </section>

            <hr className={styles.divider} />

            {/* 2. 核心功能展示区 */}
            <section className={styles.featuresSection}>
                <h2 className={styles.sectionHeader}>我们如何让旅行更简单？</h2>

                <div className={styles.featureGrid}>
                    {FEATURES.map((feature, index) => (
                        <div key={index} className={styles.featureCard}>
                            <div className={styles.featureIcon}>{feature.icon}</div>
                            <h3 className={styles.featureTitle}>{feature.title}</h3>
                            <p className={styles.featureDescription}>{feature.description}</p>
                        </div>
                    ))}
                </div>
            </section>



        </div>
    );
}

export default HomePage;