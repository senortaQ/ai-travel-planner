import { useState, useEffect, useMemo, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './BudgetDetailPage.module.css';
import { useAuth } from '../context/AuthContext';


// --- 类别常量 ---
const CATEGORIES = {
    '餐饮': { key: 'food', icon: '🍔' },
    '交通': { key: 'transport', icon: '🚗' },
    '住宿': { key: 'accommodation', icon: '🏠' },
    '活动': { key: 'activities', icon: '🎉' },
    '购物': { key: 'shopping', icon: '🛍️' },
    '其它': { key: 'other', icon: '📎' },
};
const AI_BUDGET_KEYS = {
    'food': '餐饮',
    'transport': '交通',
    'accommodation': '住宿',
    'activities': '活动',
};

// --- 语音识别 API ---
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
const hasSpeechSupport = !!SpeechRecognition;


function BudgetDetailPage() {
    const { tripId } = useParams();

    // 1. AuthContext: 使用您正确的结构
    const { session } = useAuth();
    const user = session?.user;

    // 2. 页面和数据状态
    const [trip, setTrip] = useState(null);
    const [budget, setBudget] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [expenses, setExpenses] = useState([]);
    const [loadingExpenses, setLoadingExpenses] = useState(true);

    // 3. 模态框和表单状态
    const [showAddModal, setShowAddModal] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [expenseName, setExpenseName] = useState('');
    const [expenseAmount, setExpenseAmount] = useState('');
    const [expenseCategory, setExpenseCategory] = useState('餐饮');

    // 4. AI/语音状态 (使用 rawInputText 接收语音/文字输入)
    const [rawInputText, setRawInputText] = useState('');
    const [isListening, setIsListening] = useState(false);
    const [isParsing, setIsParsing] = useState(false);
    const recognitionRef = useRef(null);

    // 5. 预算/记录联动状态
    const [selectedCategory, setSelectedCategory] = useState(null);


    // --- EFFECT HOOKS ---

    // 获取行程和 AI 预算 (保持不变)
    useEffect(() => {
        const fetchTripData = async () => {
            if (!tripId) { setError('无效的行程 ID。'); setLoading(false); return; }
            setLoading(true);
            const { data, error: fetchError } = await supabase
                .from('trips').select('destination, start_date, end_date, generated_itinerary, budget').eq('id', tripId).single();
            if (fetchError) { setError('加载行程失败：' + fetchError.message); setLoading(false); return; }
            if (!data) { setError('未找到行程。'); setLoading(false); return; }
            setTrip(data);
            if (data.generated_itinerary) {
                try {
                    const itinerary = typeof data.generated_itinerary === 'string'
                        ? JSON.parse(data.generated_itinerary) : data.generated_itinerary;
                    if (itinerary.budget_analysis) { setBudget(itinerary.budget_analysis); } else { setError('未在行程数据中找到预算分析。'); }
                } catch (e) { setError('解析行程数据失败。'); }
            } else { setError('此行程尚未生成 AI 计划。'); }
            setLoading(false);
        };
        fetchTripData();
    }, [tripId]);

    // 获取实际开销列表 (保持不变)
    useEffect(() => {
        const fetchExpenses = async () => {
            if (!tripId) return;
            setLoadingExpenses(true);
            const { data, error: expensesError } = await supabase
                .from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false });
            if (expensesError) { setError('加载开销列表失败: ' + expensesError.message); } else { setExpenses(data); }
            setLoadingExpenses(false);
        };
        fetchExpenses();
    }, [tripId]);

    // 设置语音识别
    useEffect(() => {
        if (!hasSpeechSupport) return;
        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.interimResults = false;
        recognition.continuous = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onend = () => setIsListening(false);
        recognition.onerror = (event) => { console.error('语音识别错误:', event.error); setIsListening(false); };

        recognition.onresult = (event) => {
            const transcript = event.results[event.results.length - 1][0].transcript.trim();
            // 将语音转录结果追加到输入框
            setRawInputText(prev => prev ? `${prev} ${transcript}` : transcript);
        };

        recognitionRef.current = recognition;
        return () => { recognition.stop(); };
    }, []);


    // --- HANDLERS AND MEMOS ---

    // 提交新开销
    const handleAddExpense = async (e) => {
        e.preventDefault();
        if (!user || !expenseName || !expenseAmount || !expenseCategory || isSubmitting) {
            if (!user) alert("请先登录后再记账。");
            return;
        }
        const amount = parseFloat(expenseAmount);
        if (isNaN(amount) || amount <= 0) { alert('请输入有效的金额'); return; }

        setIsSubmitting(true);
        const { data, error: insertError } = await supabase
            .from('expenses').insert({ trip_id: tripId, user_id: user.id, name: expenseName, amount: amount, category: expenseCategory, })
            .select().single();

        if (insertError) { setError('记账失败: ' + insertError.message); }
        else { setExpenses([data, ...expenses]); setExpenseName(''); setExpenseAmount(''); setExpenseCategory('餐饮'); setShowAddModal(false); }
        setIsSubmitting(false);
    };

    // "AI 处理" 按钮的函数
    const handleAiParse = async () => {
        if (!rawInputText.trim()) { alert("请输入或录入要处理的内容"); return; }
        setIsParsing(true);
        setError('');

        try {
            const { data, error } = await supabase.functions.invoke('parse-expense', { body: { text: rawInputText } });

            if (error) throw error;
            if (!data || !data.name || !data.amount) throw new Error("AI未能解析出有效内容或金额");

            // 自动填充下面的表单
            setExpenseName(data.name || '');
            setExpenseAmount(data.amount || '');
            setExpenseCategory(data.category || '其它');

            // 成功后清空 AI 输入框（可选，但通常有助于下一步输入）
            setRawInputText('');

        } catch (err) {
            console.error('AI 解析失败:', err);
            setError(`AI 解析失败: ${err.message}`);
        } finally {
            setIsParsing(false);
        }
    };

    // 语音按钮点击
    const handleToggleListen = () => {
        if (!recognitionRef.current) return;
        if (isListening) { recognitionRef.current.stop(); }
        else { recognitionRef.current.start(); }
    };

    // 计算实际总花费 (不变)
    const actualTotalCost = useMemo(() => {
        return expenses.reduce((total, expense) => total + (expense.amount || 0), 0);
    }, [expenses]);

    // 按类别计算花费 (不变)
    const actualsByCategory = useMemo(() => {
        const categoryTotals = {};
        Object.keys(CATEGORIES).forEach(name => categoryTotals[name] = 0);
        expenses.forEach(exp => {
            if (categoryTotals.hasOwnProperty(exp.category)) { categoryTotals[exp.category] += exp.amount; }
            else { categoryTotals['其它'] += exp.amount; }
        });
        return categoryTotals;
    }, [expenses]);

    // 删除开销 (不变)
    const handleDeleteExpense = async (expenseId) => {
        if (!window.confirm('确定要删除这条开销吗?')) { return; }
        const { error: deleteError } = await supabase.from('expenses').delete().eq('id', expenseId);
        if (deleteError) { setError('删除失败: ' + deleteError.message); }
        else { setExpenses(expenses.filter(exp => exp.id !== expenseId)); }
    };


    // --- 渲染函数 ---

    // 渲染: 记账模态框 (精确复刻截图样式)
    const renderAddExpenseModal = () => (
        <div className={styles.modalOverlay} onClick={() => setShowAddModal(false)}>
            <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>

                {/* 模态框标题 */}
                <h3 className={styles.modalTitle}>智能记一笔</h3>

                {/* --- 精确复刻的 AI 智能记账区域 --- */}
                <div className={styles.aiParsingSection}>
                    {/* 标题 - 模仿截图中的格式 */}
                    <h4 className={styles.aiSectionTitle}>通过语音描述您的开销:</h4>

                    {/* 文本输入框 - 模仿截图中的大框 */}
                    <textarea
                        className={styles.rawInputArea}
                        rows={4}
                        placeholder={isListening ? "正在聆听，请说话..." : "请点击 [录音] 开始语音输入，或在此手动输入/修改"}
                        value={rawInputText}
                        onChange={(e) => setRawInputText(e.target.value)}
                        disabled={isParsing}
                    />

                    {/* 按钮行 - 模仿截图中的并排布局 */}
                    <div className={styles.aiButtonRow}>
                        {/* 录音按钮 */}
                        <button
                            type="button"
                            className={`${styles.aiButton} ${styles.recordButton} ${isListening ? styles.isListening : ''}`}
                            onClick={handleToggleListen}
                            disabled={!user || isParsing}
                        >
                            <span className={styles.buttonIcon}>🎙️</span> {isListening ? '录音中...' : '录音'}
                        </button>

                        {/* 清空按钮 */}
                        <button
                            type="button"
                            className={`${styles.aiButton} ${styles.clearButton}`}
                            onClick={() => setRawInputText('')}
                            disabled={isParsing || !rawInputText}
                        >
                            <span className={styles.buttonIcon}>🔄</span> 清空
                        </button>

                        {/* AI 处理按钮 */}
                        <button
                            type="button"
                            className={`${styles.aiButton} ${styles.processButton}`}
                            onClick={handleAiParse}
                            disabled={isParsing || !user || !rawInputText.trim()}
                        >
                            <span className={styles.buttonIcon}>🚀</span> {isParsing ? 'AI 处理中...' : 'AI 处理'}
                        </button>
                    </div>
                </div>

                <hr className={styles.divider} style={{margin: '30px 0'}} />

                {/* --- 最终确认表单 (AI 填充后用户校对) --- */}
                <p className={styles.reviewPrompt}>请核对 AI 提取结果：</p>
                <form onSubmit={handleAddExpense} className={styles.expenseForm}>
                    <div className={styles.formGroup}>
                        <label>开销名称</label>
                        <input type="text" value={expenseName} onChange={(e) => setExpenseName(e.target.value)} required />
                    </div>
                    <div className={styles.formGroup}>
                        <label>金额 (¥)</label>
                        <input type="number" value={expenseAmount} onChange={(e) => setExpenseAmount(e.target.value)} required />
                    </div>
                    <div className={styles.formGroup}>
                        <label>类别</label>
                        <select value={expenseCategory} onChange={(e) => setExpenseCategory(e.target.value)} required >
                            {Object.keys(CATEGORIES).map(catName => (
                                <option key={catName} value={catName}>{CATEGORIES[catName].icon} {catName}</option>
                            ))}
                        </select>
                    </div>

                    <div className={styles.formActions}>
                        <button type="button" className={styles.cancelButton} onClick={() => setShowAddModal(false)}>
                            取消
                        </button>
                        <button type="submit" disabled={isSubmitting || isParsing || !user}>
                            {isSubmitting ? '记账中...' : '确认记账'}
                        </button>
                    </div>
                    {!user && <p className={styles.authWarning}>请先登录才能记账</p>}
                </form>
            </div>
        </div>
    );

    // 渲染: 预算 vs 实际 (已包含"其它"和"购物")
    const renderBudgetBreakdown = () => {
        if (!budget?.breakdown) return <p>AI 预算分析加载失败或不存在。</p>;
        const aiCategories = budget.breakdown;

        return (
            <div className={styles.budgetBreakdown}>
                {Object.keys(CATEGORIES).map(categoryName => {
                    const categoryKey = CATEGORIES[categoryName].key;
                    const estimated = Object.keys(aiCategories).includes(categoryKey) ? aiCategories[categoryKey] || 0 : 0;
                    const actual = actualsByCategory[categoryName] || 0;
                    if (estimated === 0 && actual === 0) { return null; }
                    const percentage = estimated > 0 ? (actual / estimated) * 100 : 0;
                    const isOverBudget = actual > estimated && estimated > 0;

                    return (
                        <div
                            key={categoryName}
                            className={`${styles.budgetCategory} ${selectedCategory === categoryName ? styles.selectedCategory : ''}`}
                            onClick={() => setSelectedCategory(categoryName)}
                            role="button"
                            tabIndex="0"
                        >
                            <div className={styles.categoryHeader}>
                                <span className={styles.categoryIcon}>{CATEGORIES[categoryName].icon} {categoryName}</span>
                                <span className={`${styles.categoryAmount} ${isOverBudget ? styles.overBudget : ''}`}>
                                    ¥{actual.toFixed(2)}
                                    {estimated > 0 ? <span className={styles.estimatedAmount}> / ¥{estimated.toFixed(2)}</span> : <span className={styles.estimatedAmount}> / (无估算)</span>}
                                </span>
                            </div>
                            {estimated > 0 && (
                                <div className={styles.progressBarContainer}>
                                    <div className={`${styles.progressBar} ${isOverBudget ? styles.overBudgetBar : ''}`} style={{ width: `${Math.min(percentage, 100)}%` }}></div>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>
        );
    };

    // 渲染: 开销列表 (已包含筛选)
    const renderExpenseList = () => {
        if (loadingExpenses) return <p>加载开销列表中...</p>;

        const filteredExpenses = selectedCategory ? expenses.filter(exp => exp.category === selectedCategory) : expenses;

        if (filteredExpenses.length === 0) {
            return <p>{selectedCategory ? `“${selectedCategory}” 类别下还没有记录。` : '你还没有记录任何开销。'}</p>;
        }

        return (
            <div className={styles.expenseList}>
                {filteredExpenses.map(exp => (
                    <div key={exp.id} className={styles.expenseItem}>
                        <div className={styles.itemLeft}>
                            <span className={styles.categoryIconLarge}>{CATEGORIES[exp.category]?.icon || '💰'}</span>
                            <div className={styles.itemDetails}>
                                <span className={styles.itemName}>{exp.name}</span>
                                <span className={styles.itemDate}>{new Date(exp.created_at).toLocaleDateString()} - {exp.category}</span>
                            </div>
                        </div>
                        <div className={styles.itemRight}>
                            <span className={styles.itemAmount}>¥{exp.amount.toFixed(2)}</span>
                            <button className={styles.deleteButton} onClick={() => handleDeleteExpense(exp.id)}>
                                &times;
                            </button>
                        </div>
                    </div>
                ))}
            </div>
        );
    };


    // --- 最终渲染 ---

    if (loading) {
        return <div className={styles.container}><p className={styles.loadingMessage}>加载行程预算中...</p></div>;
    }

    return (
        <div className={styles.container}>
            {/* 记账模态框 */}
            {showAddModal && renderAddExpenseModal()}

            <Link to={`/trip/${tripId}`} className={styles.backLink}>&lt; 返回行程详情</Link>

            <div className={styles.header}>
                <h1>{trip?.destination || '行程'} 预算管理</h1>
                <p>{trip?.start_date} 到 {trip?.end_date}</p>
            </div>

            {error && <p className={styles.errorMessage}>{error}</p>}

            {/* 1. 总结栏 */}
            <div className={styles.budgetSummary}>
                <div className={styles.summaryBox}><h4>你的总预算</h4><p>¥{trip.budget || 'N/A'}</p></div>
                <div className={styles.summaryBox}><h4>AI 估算总费用</h4><p>¥{budget?.total_estimated_cost ?? 0}</p></div>
                <div className={`${styles.summaryBox} ${actualTotalCost > (trip.budget || Infinity) ? styles.overBudgetHighlight : ''}`}>
                    <h4>实际总花费</h4>
                    <p>¥{actualTotalCost.toFixed(2)}</p>
                </div>
            </div>

            {trip.budget && actualTotalCost > trip.budget && (
                <p className={styles.errorMessage} style={{ textAlign: 'center', margin: '10px 0' }}>
                    警告：实际花费已超出总预算！
                </p>
            )}

            {/* 2. 预算 vs 实际 (可筛选) */}
            <div className={styles.budgetSection}>
                <h2 className={styles.sectionTitle}>预算追踪 (点击类别可筛选)</h2>
                {renderBudgetBreakdown()}
            </div>

            <hr className={styles.divider} />

            {/* 3. 实际开销管理 */}
            <div className={styles.expenseSection}>
                <div className={styles.expenseHeader}>
                    <h2 className={styles.sectionTitle}>开销记录</h2>
                    {selectedCategory && (
                        <button className={styles.showAllButton} onClick={() => setSelectedCategory(null)}>
                            显示全部
                        </button>
                    )}
                    <button className={styles.addExpenseButton} onClick={() => setShowAddModal(true)} disabled={!user}>
                        + 记一笔
                    </button>
                </div>
                {!user && <p className={styles.authWarning} style={{textAlign: 'center', marginBottom: '15px'}}>请先登录才能记账</p>}

                {renderExpenseList()}
            </div>
        </div>
    );
}

export default BudgetDetailPage;