// src/pages/DashboardPage.jsx (v6 - Advanced Voice Input - Complete Code)
import React, { useState, useEffect, useRef, useCallback } from 'react'; // 添加 useCallback 和 useRef
import { useNavigate } from 'react-router-dom'; // 确保引入 useNavigate
import { supabase } from '../supabaseClient';
import { useAuth } from '../context/AuthContext';
import styles from './DashboardPage.module.css';
import { Mic, StopCircle, RotateCcw, Send, Loader2, Info } from 'lucide-react'; // 引入更多图标

// --- 页面大小常量 ---
const PAGE_SIZE = 9; // 或者你之前设置的 6

// --- Web Speech API 兼容性检查 ---
const SpeechRecognition = typeof window !== 'undefined' ? (window.SpeechRecognition || window.webkitSpeechRecognition) : null;
const browserSupportsSpeechRecognition = !!SpeechRecognition;

function DashboardPage() {
    // --- 状态 ---
    const [trips, setTrips] = useState([]);
    const [loading, setLoading] = useState(true);
    const [errorMessage, setErrorMessage] = useState('');
    const [aiLoadingTripId, setAiLoadingTripId] = useState(null);
    const [currentPage, setCurrentPage] = useState(1);
    const [totalCount, setTotalCount] = useState(0);

    // --- 模态框状态 ---
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formLoading, setFormLoading] = useState(false);
    const [formErrorMessage, setFormErrorMessage] = useState('');

    // --- 表单状态 ---
    const [destination, setDestination] = useState('');
    const [startDate, setStartDate] = useState('');
    const [endDate, setEndDate] = useState('');
    const [budget, setBudget] = useState(5000);
    const [preferences, setPreferences] = useState('');

    // --- 高级语音输入状态 ---
    const [transcript, setTranscript] = useState('');          // 识别的文字 (包含中间结果)
    const [isListening, setIsListening] = useState(false);      // 是否正在录音
    const [speechError, setSpeechError] = useState('');       // 语音相关错误
    const [nluLoading, setNluLoading] = useState(false);     // AI处理状态
    const recognitionRef = useRef(null); // 存储 SpeechRecognition 实例

    const { session } = useAuth(); // 获取 session
    const navigate = useNavigate(); // 获取 navigate 函数

    // --- 模态框控制 ---
    const openModal = () => {
        // 重置所有模态框内的状态
        setFormErrorMessage('');
        setSpeechError('');
        setTranscript('');
        setIsListening(false);
        setNluLoading(false);
        setDestination('');
        setStartDate('');
        setEndDate('');
        setBudget(5000);
        setPreferences('');
        setIsModalOpen(true);
    };
    const closeModal = () => {
        // 关闭时确保停止录音
        if (recognitionRef.current) {
            try {
                recognitionRef.current.stop();
            } catch (e) {
                console.warn("Error stopping recognition on close:", e);
            }
            recognitionRef.current = null;
        }
        setIsListening(false);
        setIsModalOpen(false);
    };

    // --- 读取 (Read) - 支持分页 ---
    const fetchTrips = useCallback(async () => {
        if (!session) return; // session 无效则不获取
        setLoading(true);
        setErrorMessage('');
        const from = (currentPage - 1) * PAGE_SIZE;
        const to = from + PAGE_SIZE - 1;

        try {
            const { data, error, count } = await supabase
                .from('trips')
                .select('*', { count: 'exact' })
                .order('created_at', { ascending: false })
                .range(from, to);

            if (error) throw error;

            setTrips(data || []);
            setTotalCount(count || 0);
        } catch (error) {
            console.error('Error fetching trips:', error);
            setErrorMessage('获取行程失败：' + error.message);
            setTrips([]);
            setTotalCount(0);
        } finally {
            setLoading(false);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [currentPage, session]); // 依赖 currentPage 和 session

    useEffect(() => {
        fetchTrips(); // 组件加载和依赖变化时获取数据
    }, [fetchTrips]); // 依赖 useCallback 包装后的 fetchTrips

    // --- 创建 (Create) ---
    const handleCreateTrip = async (e) => {
        e.preventDefault();
        setFormLoading(true);
        setFormErrorMessage('');
        try {
            const { data, error } = await supabase.from('trips').insert([
                { destination, start_date: startDate, end_date: endDate, budget, preferences_text: preferences },
            ]);
            if (error) throw error;

            alert('行程创建成功!');
            closeModal();
            // 刷新列表（回到第一页或刷新当前页）
            if (currentPage !== 1) {
                setCurrentPage(1); // 触发 fetchTrips 重新加载第一页
            } else {
                fetchTrips(); // 如果已经在第一页，手动刷新
            }
        } catch (error) {
            console.error('Error creating trip:', error);
            setFormErrorMessage('创建行程失败：' + error.message);
        } finally {
            setFormLoading(false);
        }
    };

    // --- 删除 (Delete) ---
    const handleDeleteTrip = async (tripId) => {
        if (!window.confirm('确定要删除这个行程吗？')) return;
        setLoading(true); // 使用主加载状态
        setErrorMessage('');
        try {
            const { error } = await supabase.from('trips').delete().eq('id', tripId);
            if (error) throw error;

            alert('删除成功!');
            // 检查删除后当前页是否需要调整
            const newTotalCount = totalCount - 1;
            const newTotalPages = Math.ceil(newTotalCount / PAGE_SIZE);
            if (trips.length === 1 && currentPage > 1 && currentPage > newTotalPages) {
                setCurrentPage(currentPage - 1); // 回到上一页（会自动触发fetchTrips）
            } else {
                fetchTrips(); // 否则刷新当前页
            }
        } catch (error) {
            console.error('Error deleting trip:', error);
            setErrorMessage('删除行程失败：' + error.message);
            setLoading(false); // 失败时确保 loading 结束
        }
        // fetchTrips 会设置 setLoading(false)
    };

    // --- AI 生成 (Invoke) ---
    const handleGenerateItinerary = async (trip) => {
        if (trip.generated_itinerary) {
            if (!window.confirm('这个行程已经有 AI 生成的计划了，你确定要重新生成吗？')) return;
        }
        setAiLoadingTripId(trip.id);
        setErrorMessage('');
        try {
            const { data, error } = await supabase.functions.invoke('generate-itinerary', {
                body: { trip_id: trip.id },
            });
            if (error) throw error;
            alert(`“${trip.destination}”的行程已成功生成！`);
            fetchTrips(); // 刷新列表
        } catch (error) {
            console.error('Error invoking function:', error);
            let errMsg = error.message;
            if (error.context?.error) errMsg = error.context.error.message || error.message;
            setErrorMessage('AI 行程生成失败：' + errMsg);
        } finally {
            setAiLoadingTripId(null);
        }
    };

    // --- 语音识别核心逻辑 ---
    const setupRecognition = useCallback(() => {
        if (!browserSupportsSpeechRecognition) {
            setSpeechError('抱歉，您的浏览器不支持语音识别。请尝试 Chrome 或 Edge。');
            return null;
        }

        const recognition = new SpeechRecognition();
        recognition.lang = 'zh-CN';
        recognition.continuous = true; // 持续识别
        recognition.interimResults = true; // 获取中间结果

        let final_transcript = ''; // 用于累积最终结果

        recognition.onstart = () => {
            console.log('[Voice] Recognition started.');
            setIsListening(true);
            setSpeechError('');
            final_transcript = transcript; // 从当前文本框内容开始累积
        };

        recognition.onresult = (event) => {
            let interim_transcript = '';
            for (let i = event.resultIndex; i < event.results.length; ++i) {
                if (event.results[i].isFinal) {
                    final_transcript += event.results[i][0].transcript;
                } else {
                    interim_transcript += event.results[i][0].transcript;
                }
            }
            // 更新显示的文本：最终结果 + 当前中间结果
            setTranscript(final_transcript + interim_transcript);
            console.log('[Voice] Interim:', interim_transcript, 'Accumulated Final:', final_transcript);
        };

        recognition.onerror = (event) => {
            console.error('[Voice] Recognition error:', event.error);
            let errorMessage = '语音识别时发生错误。';
            if (event.error === 'no-speech') errorMessage = '未能检测到语音，请重试。';
            else if (event.error === 'audio-capture') errorMessage = '无法访问麦克风，请检查权限。';
            else if (event.error === 'not-allowed') errorMessage = '麦克风权限被拒绝，请在浏览器设置中允许访问。';
            else if (event.error === 'network') errorMessage = '网络错误导致语音识别失败。';
            setSpeechError(errorMessage);
            setIsListening(false);
            recognitionRef.current = null; // 清理实例
        };

        recognition.onend = () => {
            console.log('[Voice] Recognition ended.');
            setIsListening(false);
            // 结束后最终文本已在 transcript 状态中
            // 不需要自动调用 NLU
            if (recognitionRef.current === recognition) {
                recognitionRef.current = null; // 清理引用
            }
        };

        return recognition;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [transcript]); // transcript 作为依赖，这样 final_transcript 能获取最新值

    // --- 控制开始/停止录音 ---
    const toggleListening = () => {
        if (isListening) {
            // 停止录音
            if (recognitionRef.current) {
                try {
                    recognitionRef.current.stop();
                    console.log('[Voice] Stopping recognition manually.');
                } catch(e) {
                    console.warn("Error stopping recognition:", e);
                }
                // onend 事件会处理 setIsListening(false) 和清理 ref
            } else {
                setIsListening(false); // 以防万一 ref 丢失
            }
        } else {
            // 开始录音
            const recognition = setupRecognition();
            if (recognition) {
                recognitionRef.current = recognition; // 存储实例
                try {
                    recognition.start();
                    console.log('[Voice] Starting recognition...');
                } catch (e) {
                    console.error('[Voice] Error starting recognition:', e);
                    setSpeechError('启动语音识别失败。');
                    recognitionRef.current = null;
                    setIsListening(false);
                }
            }
        }
    };

    // --- 清空文本 ---
    const clearTranscript = () => {
        setTranscript('');
        setSpeechError('');
    };

    // --- 调用后端 NLU 函数 ---
    const callNluApi = async (textToProcess) => {
        console.log('[NLU] Calling NLU function with text:', textToProcess);
        if (!textToProcess.trim()) {
            setSpeechError('请输入或说出行程描述后再处理。');
            return;
        }
        setNluLoading(true);
        setSpeechError(''); // 清除之前的错误

        try {
            const { data, error: invokeError } = await supabase.functions.invoke('extract-trip-info', {
                body: { text: textToProcess },
            });

            if (invokeError) throw invokeError;
            console.log('[NLU] Received NLU result:', data);

            if (data && typeof data === 'object') {
                // 更新表单状态 (只更新 AI 返回了值的字段)
                setDestination(prev => data.destination ?? prev);
                setStartDate(prev => data.startDate ?? prev);
                setEndDate(prev => data.endDate ?? prev);
                setBudget(prev => data.budget ?? prev);
                setPreferences(prev => data.preferences ?? prev);
                setFormErrorMessage('');
                // (可选) 可以在成功填充后清空 transcript
                // setTranscript('');
            } else {
                console.error('[NLU] Invalid NLU response format:', data);
                setSpeechError('未能理解您的输入，请检查文字或尝试重新描述。');
            }

        } catch (error) {
            console.error('[NLU] Error invoking NLU function:', error);
            let errMsg = error.message;
            if (error.context?.error) errMsg = error.context.error.message || error.message;
            setSpeechError('处理文本时出错：' + errMsg);
        } finally {
            setNluLoading(false);
        }
    };

    // --- 分页控制 ---
    const totalPages = Math.ceil(totalCount / PAGE_SIZE);
    const goToPrevPage = () => { if (currentPage > 1) setCurrentPage(currentPage - 1); };
    const goToNextPage = () => { if (currentPage < totalPages) setCurrentPage(currentPage + 1); };

    // --- 渲染 ---
    return (
        <div>
            {/* --- 主内容区域 --- */}
            <div className={styles.dashboardContainer}>
                <div className={styles.listSection}>
                    {/* 列表头 */}
                    <div className={styles.listHeader}>
                        <h2>我的行程 ({totalCount})</h2>
                        <button onClick={openModal} className={styles.createButton}>
                            + 创建新行程
                        </button>
                    </div>

                    {/* 列表加载与错误状态 */}
                    {loading && <p className={styles.loadingMessage}>加载中...</p>}
                    {!loading && trips.length === 0 && totalCount === 0 && <p className={styles.emptyMessage}>你还没有创建任何行程。</p>}
                    {!loading && trips.length === 0 && totalCount > 0 && <p className={styles.emptyMessage}>当前页没有行程。</p>}
                    {errorMessage && <p className={styles.errorMessage}>{errorMessage}</p>}

                    {/* 行程卡片列表 */}
                    {!loading && trips.length > 0 && (
                        <div className={styles.tripList}>
                            {trips.map((trip) => {
                                const isAiLoading = aiLoadingTripId === trip.id;
                                return (
                                    <div key={trip.id} className={styles.tripCard}>
                                        <h3>{trip.destination}</h3>
                                        <p>{trip.start_date} 到 {trip.end_date}</p>
                                        <p>预算：￥{trip.budget}</p>
                                        {trip.preferences_text && <p>偏好：{trip.preferences_text}</p>}
                                        <div className={styles.cardActions}>
                                            <button
                                                className={styles.viewButton}
                                                disabled={!trip.generated_itinerary || isAiLoading}
                                                title={!trip.generated_itinerary ? "请先生成 AI 行程" : "查看详情"}
                                                onClick={() => {
                                                    if (trip.generated_itinerary) {
                                                        navigate(`/trip/${trip.id}`);
                                                    }
                                                }}
                                            >
                                                查看详情
                                            </button>
                                            <button onClick={() => handleGenerateItinerary(trip)} className={styles.aiButton} disabled={loading || isAiLoading}>{isAiLoading ? '生成中...' : (trip.generated_itinerary ? '重新生成' : '生成 AI 行程')}</button>
                                            <button onClick={() => handleDeleteTrip(trip.id)} className={styles.deleteButton} disabled={loading || isAiLoading}>删除</button>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}

                    {/* 分页控件 */}
                    {!loading && totalPages > 1 && (
                        <div className={styles.pagination}>
                            <button onClick={goToPrevPage} disabled={currentPage === 1} className={styles.pageButton}>&lt; 上一页</button>
                            <span className={styles.pageInfo}>第 {currentPage} 页 / 共 {totalPages} 页</span>
                            <button onClick={goToNextPage} disabled={currentPage >= totalPages} className={styles.pageButton}>下一页 &gt;</button>
                        </div>
                    )}
                </div>
            </div>

            {/* --- 模态框区域 (包含高级语音输入) --- */}
            {isModalOpen && (
                <div className={`${styles.modalOverlay} ${styles.active}`} onClick={closeModal}>
                    <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
                        <div className={styles.modalHeader}>
                            <h2>创建新行程</h2>
                            <button onClick={closeModal} className={styles.closeButton}>×</button>
                        </div>

                        {/* --- 高级语音输入 UI --- */}
                        <div className={styles.voiceInputContainer}>
                            <label htmlFor="transcriptArea" className={styles.voiceLabel}>通过语音描述您的行程：</label>
                            {/* 可编辑文本区域 */}
                            <textarea
                                id="transcriptArea"
                                className={styles.transcriptArea}
                                value={transcript}
                                onChange={(e) => setTranscript(e.target.value)}
                                placeholder={isListening ? "请说话..." : "请点击 [录音] 开始语音输入，或在此手动输入/修改"}
                                rows={4}
                                disabled={isListening} // 录音时禁用编辑
                            />
                            {/* 语音控制按钮 */}
                            <div className={styles.voiceButtons}>
                                <button
                                    type="button"
                                    onClick={toggleListening}
                                    className={`${styles.iconButton} ${isListening ? styles.stopButton : styles.startButton}`}
                                    title={isListening ? "停止录音" : "开始录音"}
                                    disabled={!browserSupportsSpeechRecognition || nluLoading} // 不支持或处理中时禁用
                                >
                                    {isListening ? <StopCircle size={20} /> : <Mic size={20} />}
                                    <span>{isListening ? "停止" : "录音"}</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={clearTranscript}
                                    className={`${styles.iconButton} ${styles.clearButton}`}
                                    title="清空文字"
                                    disabled={isListening || nluLoading || !transcript} // 录音中、处理中或无文字时禁用
                                >
                                    <RotateCcw size={20} />
                                    <span>清空</span>
                                </button>
                                <button
                                    type="button"
                                    onClick={() => callNluApi(transcript)} // 处理当前文本框内容
                                    className={`${styles.iconButton} ${styles.processButton}`}
                                    title="使用 AI 处理文本以填充表单"
                                    disabled={isListening || nluLoading || !transcript} // 录音中、处理中或无文字时禁用
                                >
                                    {nluLoading ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
                                    <span>{nluLoading ? "处理中..." : "AI 处理"}</span>
                                </button>
                            </div>
                            {/* 语音/NLU 错误提示 */}
                            {speechError && <p className={`${styles.errorMessage} ${styles.speechErrorMessage}`}>{speechError}</p>}
                            {!browserSupportsSpeechRecognition && <p className={`${styles.errorMessage} ${styles.speechErrorMessage}`}>您的浏览器不支持语音识别。</p>}
                        </div>

                        {/* --- 创建行程表单 --- */}
                        <form onSubmit={handleCreateTrip} className={styles.tripForm}>
                            {/* 表单字段 */}
                            <div className={styles.formGroup}> <label htmlFor="dest">目的地</label> <input id="dest" type="text" value={destination} onChange={(e) => setDestination(e.target.value)} required /> </div>
                            <div className={styles.formGroup}> <label htmlFor="start">出发日期</label> <input id="start" type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} required /> </div>
                            <div className={styles.formGroup}> <label htmlFor="end">返程日期</label> <input id="end" type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} required /> </div>
                            <div className={styles.formGroup}> <label htmlFor="budget">预算 (CNY)</label> <input id="budget" type="number" value={budget} onChange={(e) => setBudget(e.target.value)} required min="0" /> </div>
                            <div className={styles.formGroup}> <label htmlFor="pref">旅行偏好 (可选)</label> <textarea id="pref" value={preferences} onChange={(e) => setPreferences(e.target.value)} placeholder="例如：喜欢美食和动漫，带孩子..." /> </div>
                            {/* 表单提交错误提示 */}
                            {formErrorMessage && <p className={`${styles.errorMessage} ${styles.modalErrorMessage}`}>{formErrorMessage}</p>}
                            {/* 提交按钮 */}
                            <button type="submit" className={styles.submitButton} disabled={formLoading || nluLoading || isListening}>
                                {formLoading ? '创建中...' : '创建行程'}
                            </button>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}

export default DashboardPage;