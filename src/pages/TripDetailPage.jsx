import { useState, useEffect, useRef ,useMemo} from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import styles from './TripDetailPage.module.css';
import AMapLoader from '@amap/amap-jsapi-loader';
import { getAppConfig } from '../services/configService';
// --- Amap Key 和 Security Key ---
// const amapKey = import.meta.env.VITE_AMAP_KEY;
// const amapSecuritySecret = import.meta.env.VITE_AMAP_SECURITY_SECRET;

// // --- 配置安全密钥 ---
// if (window._AMapSecurityConfig === undefined) {
//     window._AMapSecurityConfig = {
//         securityJsCode: amapSecuritySecret,
//     };
// }
// --- 全局变量存储 AMap 对象 ---
if (typeof window !== 'undefined') {
    window.AMapInstance = null;
}

// --- [新增] 餐饮卡片子组件 (用于美化) ---
// (移到这里，确保在使用前已定义)
function MealCard({ meal, type }) {
    if (!meal || !meal.name) {
        return (
            <div className={styles.mealCard}>
                <h4>{type}</h4>
                <p>自行安排</p>
            </div>
        );
    }
    return (
        <div className={styles.mealCard}>
            <h4>{type}: {meal.name}</h4>
            <p><strong>推荐:</strong> {meal.recommendation || 'N/A'}</p>
            <p><strong>地址:</strong> {meal.address || 'N/A'}</p>
            <p><strong>人均:</strong> ¥{meal.avg_cost ?? 0}</p>
        </div>
    );
}


function TripDetailPage() {
    const { tripId } = useParams();
    const navigate = useNavigate(); // 初始化 navigate
    const [trip, setTrip] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [itinerary, setItinerary] = useState(null);
    const [selectedDayIndex, setSelectedDayIndex] = useState(0);
    const [amapApiLoaded, setAmapApiLoaded] = useState(false);
    const [mapReady, setMapReady] = useState(false);

    // [新增] 地图放大 state
    const [isMapExpanded, setIsMapExpanded] = useState(false);

    const mapRef = useRef(null);
    const mapInstance = useRef(null);
    const markersRef = useRef([]);
    const retryCountRef = useRef(0);

    const { amapKey } = useMemo(() => {
        const config = getAppConfig();

        // --- 动态配置安全密钥 ---
        // (这必须在 AMapLoader.load 之前执行)
        if (window._AMapSecurityConfig === undefined) {
            window._AMapSecurityConfig = {
                securityJsCode: config.amapSecuritySecret || '', // 从 localStorage 读取
            };
        }

        return {
            amapKey: config.amapKey || '' // 从 localStorage 读取
        };
    }, []);

    // --- 用于导航到预算页面的函数 ---
    const handleGoToBudget = () => {
        navigate(`/trip/${tripId}/budget`);
    };

    // --- 加载行程详情 ---
    useEffect(() => {
        const fetchTripDetails = async () => {
            console.log("[TripDetail] 开始加载行程详情, tripId:", tripId); // 添加日志
            setLoading(true);
            setError('');
            setTrip(null);
            setItinerary(null);

            if (!tripId) {
                console.error("[TripDetail] 无效的行程 ID。"); // 添加日志
                setError('无效的行程 ID。');
                setLoading(false);
                return;
            }

            const { data, error: fetchError } = await supabase
                .from('trips')
                .select('*')
                .eq('id', tripId)
                .single();

            if (fetchError) {
                console.error("[TripDetail] 加载行程数据库失败:", fetchError); // 添加日志
                setError('加载行程详情失败：' + fetchError.message);
                setLoading(false); // 确保出错时停止加载
                return; // 确保出错时停止执行后续代码
            } else if (data) {
                console.log("[TripDetail] 从数据库获取到行程数据:", data); // 添加日志
                setTrip(data);
                if (data.generated_itinerary) {
                    console.log("[TripDetail] 发现 generated_itinerary 数据，类型:", typeof data.generated_itinerary); // 添加日志
                    let rawItineraryData = data.generated_itinerary;
                    let parsedItinerary = null;
                    try {
                        console.log("[TripDetail] 准备解析 JSON..."); // 添加日志
                        parsedItinerary = typeof rawItineraryData === 'string'
                            ? JSON.parse(rawItineraryData)
                            : rawItineraryData; // 如果已经是对象，直接使用
                        console.log("[TripDetail] JSON 解析成功:", parsedItinerary); // 添加日志

                        // 检查核心结构
                        if (parsedItinerary && Array.isArray(parsedItinerary.daily_plan)) {
                            console.log("[TripDetail] 结构检查通过 (daily_plan 是数组)。"); // 添加日志
                            parsedItinerary.daily_plan = parsedItinerary.daily_plan.map(plan => ({
                                ...plan,
                                date: plan.date || 'N/A' // 修正：使用 'N/A' 或其他默认值，而不是 'N'
                            }));
                            setItinerary(parsedItinerary);
                            console.log("[TripDetail] 行程数据设置成功。"); // 添加日志
                        } else {
                            console.error("[TripDetail] 结构检查失败: parsedItinerary 或 parsedItinerary.daily_plan 不符合预期。parsedItinerary:", parsedItinerary); // 添加日志
                            throw new Error('行程数据结构错误 (缺少 daily_plan 或格式不对)'); // 更具体的错误信息
                        }
                    } catch (parseError) {
                        console.error("[TripDetail] 解析 JSON 或检查结构时出错:", parseError); // 添加日志
                        // --- 打印导致错误的原始字符串 ---
                        console.error("[TripDetail] 导致错误的原始 generated_itinerary:", rawItineraryData);
                        setError('行程数据格式错误，无法解析。');
                        setItinerary(null);
                    }
                } else {
                    console.warn("[TripDetail] 此行程的 generated_itinerary 为空。"); // 添加日志
                    setError('此行程尚未生成 AI 计划。');
                    setItinerary(null);
                }
            } else {
                console.warn("[TripDetail] 未在数据库中找到 ID 为", tripId, "的行程。"); // 添加日志
                setError('未找到对应的行程。');
            }
            setLoading(false);
            console.log("[TripDetail] 加载流程结束。"); // 添加日志
        };

        fetchTripDetails();
    }, [tripId]);

    // --- 地图 API 加载 ---
    useEffect(() => {
        let isMounted = true;
        console.log("[TripDetail] 开始加载高德地图 API..."); // 添加日志

        if (!amapKey) {
            console.error("[TripDetail] 地图 API 加载失败: Amap Key 未在配置中找到。");
            if (isMounted) setError("地图 API Key 未配置，请在配置页面输入。");
            return; // 如果 Key 为空，则不执行 AMapLoader.load
        }
        AMapLoader.load({
            key: amapKey,
            version: "2.0",
            plugins: ['AMap.Geocoder'],
        }).then((AMap) => {
            if (isMounted) {
                console.log("[TripDetail] 高德地图 API 加载成功。"); // 添加日志
                window.AMapInstance = AMap;
                setAmapApiLoaded(true);
            }
        }).catch(e => {
            if (isMounted) {
                console.error("[TripDetail] 地图 API 加载失败:", e); // 添加日志
                setError("地图加载失败，请检查网络或 API Key 设置。");
            }
        });

        return () => { isMounted = false; }
    }, []); // 修正：移除 amapKey 依赖，API Key 通常不变，避免不必要重载

    // --- 地图初始化 ---
    useEffect(() => {
        let isMounted = true;
        // [修改] 增加 !mapInstance.current 判断防止重复初始化
        if (amapApiLoaded && mapRef.current && !mapInstance.current) {
            console.log("[TripDetail] API 已加载, 尝试初始化地图实例..."); // 添加日志
            try {
                const map = new window.AMapInstance.Map(mapRef.current, {
                    zoom: 11,
                    center: [116.397428, 39.90923], // 默认北京
                });
                mapInstance.current = map;
                setMapReady(true);
                console.log("[TripDetail] 地图实例初始化成功。"); // 添加日志

                if (trip?.destination) {
                    console.log("[TripDetail] 尝试定位到城市:", trip.destination); // 添加日志
                    const geocoder = new window.AMapInstance.Geocoder();
                    geocoder.getLocation(trip.destination, (status, result) => {
                        if (status === 'complete' && result.geocodes?.length) {
                            console.log("[TripDetail] 城市定位成功:", result.geocodes[0].location); // 添加日志
                            map.setCenter(result.geocodes[0].location);
                            map.setZoom(11);
                        } else {
                            console.warn("[TripDetail] 城市定位失败或无结果, status:", status); // 添加日志
                        }
                    });
                }

                // [修改] 确保 itinerary 和 daily_plan 存在且有内容
                if (itinerary && itinerary.daily_plan && itinerary.daily_plan.length > 0 && trip) {
                    console.log("[TripDetail] 行程数据存在，尝试更新初始地图标记 (第一天)..."); // 添加日志
                    const firstDayPlan = itinerary.daily_plan[0];
                    // [修改] 确保 firstDayPlan 存在
                    if (firstDayPlan) {
                        updateMapMarkers(firstDayPlan.activities || []);
                    } else {
                        console.warn("[TripDetail] daily_plan[0] 不存在，无法加载第一天标记。");
                        updateMapMarkers([]); // 清空标记
                    }
                } else {
                    console.log("[TripDetail] 初始化地图时行程数据不完整，不加载标记。");
                }

            } catch (mapError) {
                if (isMounted) {
                    console.error("[TripDetail] 地图初始化失败:", mapError); // 添加日志
                    setError("地图初始化失败。");
                }
            }
        } else {
            // 添加更详细的未满足条件日志
            console.log("[TripDetail] 地图初始化条件未满足 (amapApiLoaded:", amapApiLoaded, ", mapRef.current:", !!mapRef.current, ", mapInstance.current:", !!mapInstance.current, ")");
        }

        return () => {
            isMounted = false;
            if (mapInstance.current) {
                console.log("[TripDetail] 组件卸载，销毁地图实例。"); // 添加日志
                try {
                    mapInstance.current.destroy();
                } catch (destroyError) {
                    console.error("[TripDetail] 销毁地图实例时出错:", destroyError); // 添加日志
                } finally {
                    mapInstance.current = null;
                    setMapReady(false); // 确保状态重置
                }
            }
        }
        // 依赖项保持不变，确保在 API 加载、行程数据变化时尝试初始化
    }, [amapApiLoaded, itinerary, trip]);

    // --- 地图放大/缩小后重置尺寸 ---
    useEffect(() => {
        if (mapInstance.current && mapReady) {
            console.log("[TripDetail] isMapExpanded 变化为:", isMapExpanded, "触发地图 resize。"); // 添加日志
            // 延迟 200ms 等待 CSS 动画完成
            const resizeTimer = setTimeout(() => {
                mapInstance.current.resize();
                console.log("[TripDetail] 地图 resize 调用完成。"); // 添加日志
                // 重新适配视野
                if (markersRef.current.length > 0) {
                    console.log("[TripDetail] 尝试调用 setFitView..."); // 添加日志
                    try { // 添加 try-catch 防止 setFitView 意外失败
                        mapInstance.current.setFitView(markersRef.current, false, [60, 60, 60, 60]);
                        console.log("[TripDetail] setFitView 调用成功。"); // 添加日志
                    } catch(e) {
                        console.warn("[TripDetail] 调用 setFitView 时发生错误:", e); // 添加日志
                    }
                }
            }, 200);

            return () => clearTimeout(resizeTimer);
        }
    }, [isMapExpanded, mapReady]); // 依赖 isMapExpanded 状态

    // --- 地图标记更新 ---
    const updateMapMarkers = async (activities) => {
        console.log("[TripDetail] 开始更新地图标记, activities 数量:", activities?.length ?? 0); // 添加日志
        retryCountRef.current = 0;

        const retryUpdate = () => {
            if (!mapInstance.current || !window.AMapInstance || !mapReady) {
                if (retryCountRef.current < 5) {
                    retryCountRef.current++;
                    console.log(`[TripDetail] 地图未就绪，第 ${retryCountRef.current} 次重试更新标记...`); // 添加日志
                    setTimeout(retryUpdate, 500);
                } else {
                    console.error('[TripDetail] 多次重试后地图仍未就绪，放弃更新标记。'); // 添加日志
                }
                return;
            }
            console.log("[TripDetail] 地图已就绪，开始处理标记..."); // 添加日志

            mapInstance.current.remove(markersRef.current);
            markersRef.current = [];

            if (!activities || activities.length === 0) {
                console.log("[TripDetail] 没有活动，标记清除完成。"); // 添加日志
                return;
            }

            const geocoder = new window.AMapInstance.Geocoder();
            let addedMarkersCount = 0; // 计数器
            const markerPromises = activities
                .filter(activity => activity.location_name)
                .map((activity, index) => new Promise((resolve) => { // 添加 index
                    const address = `${trip?.destination || ''}${activity.location_name}`;
                    console.log(`[TripDetail] 标记 ${index}: 尝试地理编码地址:`, address); // 添加日志
                    geocoder.getLocation(address, (status, result) => {
                        if (status === 'complete' && result.geocodes && result.geocodes.length > 0) {
                            const location = result.geocodes[0].location;
                            console.log(`[TripDetail] 标记 ${index}: 地理编码成功, 位置:`, location.lng, location.lat); // 添加日志
                            const marker = new window.AMapInstance.Marker({
                                position: [location.lng, location.lat],
                                title: activity.title,
                                label: { content: activity.title || '活动', offset: new window.AMapInstance.Pixel(10, -25) }
                            });
                            marker.on('click', () => {
                                const infoWindow = new window.AMapInstance.InfoWindow({
                                    content: `<h3>${activity.title || '活动详情'}</h3>
                                              <p>${activity.description || '无详细描述'}</p>
                                              <p>时间: ${activity.time || 'N/A'}</p>
                                              <p>交通: ${activity.transport_detail?.description || 'N/A'}</p>
                                              <p>票务: ${activity.booking_and_tickets?.ticket_info || 'N/A'}</p>`
                                });
                                infoWindow.open(mapInstance.current, marker.getPosition());
                            });
                            // markersRef.current.push(marker); // 移动到 Promise.all 之后添加
                            resolve(marker); // 返回创建好的 marker
                        } else {
                            console.warn(`[TripDetail] 标记 ${index}: 地理编码失败或无结果, status:`, status, "result:", result); // 添加日志
                            resolve(null); // 解析为 null 表示失败
                        }
                    });
                }));

            Promise.all(markerPromises).then(newMarkers => {
                const validMarkers = newMarkers.filter(m => m !== null);
                markersRef.current = validMarkers; // 更新 markersRef
                addedMarkersCount = validMarkers.length;
                console.log(`[TripDetail] 所有地理编码尝试完成，成功 ${addedMarkersCount} 个标记。`); // 添加日志
                if (addedMarkersCount > 0) {
                    try { // 添加 try-catch
                        mapInstance.current.add(validMarkers);
                        console.log("[TripDetail] 标记添加到地图成功。"); // 添加日志
                        mapInstance.current.setFitView(validMarkers, false, [60, 60, 60, 60]);
                        console.log("[TripDetail] setFitView 调用成功。"); // 添加日志
                    } catch(mapAddError) {
                        console.error("[TripDetail] 添加标记或 setFitView 到地图时出错:", mapAddError); // 添加日志
                    }
                }
            }).catch(err => {
                console.error("[TripDetail] 处理 markerPromises 时发生意外错误:", err); // 添加日志
            });
        };

        retryUpdate();
    };

    // --- 日期切换 ---
    const handleDayClick = (index) => {
        console.log("[TripDetail] 点击日期标签，切换到索引:", index); // 添加日志
        setSelectedDayIndex(index);
        // [修改] 确保 itinerary 和 daily_plan 结构有效
        if (mapReady && itinerary && itinerary.daily_plan && index < itinerary.daily_plan.length) {
            const selectedDayPlan = itinerary.daily_plan[index];
            // [修改] 确保 selectedDayPlan 存在
            if (selectedDayPlan) {
                updateMapMarkers(selectedDayPlan.activities || []);
            } else {
                console.warn("[TripDetail] selectedDayPlan 在索引", index, "处未定义。");
                updateMapMarkers([]); // 清空标记
            }
        } else {
            console.log("[TripDetail] 点击日期时尚未满足更新地图标记的条件或索引无效。"); // 添加日志
        }
    };

    // --- 地图放大/缩小切换函数 ---
    const toggleMapExpansion = () => {
        setIsMapExpanded(prev => !prev);
    };


    // --- 渲染逻辑 (Loading) ---
    if (loading) {
        console.log("[TripDetail] 渲染 Loading 状态..."); // 添加日志
        return <div className={styles.container}><p className={styles.loadingMessage}>加载中...</p></div>;
    }

    // --- 渲染逻辑 (Error) ---
    // [修改] 只有在 itinerary 为 null 时才完全渲染错误页，否则尝试渲染主要内容并显示错误信息
    if (error && !itinerary) {
        console.log("[TripDetail] 渲染 Error 状态 (无行程数据)... Error:", error); // 添加日志
        return (
            <div className={styles.container}>
                {trip && (
                    <div className={styles.header}>
                        <h1>{trip.destination}</h1>
                        <p>{trip.start_date} 到 {trip.end_date}</p>
                    </div>
                )}
                {/* [恢复] 地图提示 */}
                <div className={styles.mapPromptBanner}>
                    <p>
                        <span className="info-icon">ⓘ</span>
                        如果地图未显示当天地点，请尝试再次点击对应日期
                    </p>
                </div>
                <p className={styles.errorMessage}>{error}</p>
                <Link to="/dashboard" className={styles.backLink}>返回我的行程</Link>
            </div>
        );
    }

    // --- 渲染逻辑 (Empty 或 初始错误) ---
    if (!itinerary || !Array.isArray(itinerary.daily_plan) || itinerary.daily_plan.length === 0) {
        console.log("[TripDetail] 渲染 Empty 或 初始错误 状态..."); // 添加日志
        // 如果 trip 存在，说明是加载后发现 itinerary 有问题或为空
        if (trip) {
            return (
                <div className={styles.container}>
                    <Link to="/dashboard" className={styles.backLink}>&lt; 返回我的行程</Link>
                    <div className={styles.header}>
                        <h1>{trip.destination}</h1>
                        <p>{trip.start_date} 到 {trip.end_date}</p>
                    </div>
                    {/* [恢复] 地图提示 */}
                    <div className={styles.mapPromptBanner}>
                        <p>
                            <span className="info-icon">ⓘ</span>
                            如果地图未显示当天地点，请尝试再次点击对应日期
                        </p>
                    </div>
                    {/* 显示具体的错误信息，如果之前setError了 */}
                    <p className={styles.errorMessage}>{error || (trip.generated_itinerary ? '行程数据格式错误或为空。' : '此行程的 AI 计划尚未生成。')}</p>
                </div>
            );
        } else {
            // 如果连 trip 都没有，说明初始加载就失败了 (这种情况理论上会被上面的 error 捕获)
            return (
                <div className={styles.container}>
                    <p className={styles.errorMessage}>{error || '未能加载行程。'}</p>
                    <Link to="/dashboard" className={styles.backLink}>返回我的行程</Link>
                </div>
            );
        }
    }

    // --- 主要渲染数据 ---
    const dailyPlans = itinerary.daily_plan;
    // [修正] 确保 currentDayIndex 不会超出实际数组范围
    const currentDayIndex = Math.min(selectedDayIndex, dailyPlans.length - 1);
    const selectedDayPlan = dailyPlans[currentDayIndex]; // 现在索引是安全的
    const { trip_summary, local_transport_summary, accommodation_options } = itinerary;

    // --- 完整的主渲染 ---
    console.log("[TripDetail] 渲染主要内容..."); // 添加日志
    return (
        <div className={styles.container}>
            <Link to="/dashboard" className={styles.backLink}>&lt; 返回我的行程</Link>

            <div className={styles.header}>
                <h1>{trip.destination}</h1>
                <p>{trip.start_date} 到 {trip.end_date}</p>

                {/* 预算分析按钮 */}
                <button
                    onClick={handleGoToBudget}
                    className={styles.budgetButton}
                >
                    查看预算分析
                </button>

                {/* 显示行程摘要 */}
                {trip_summary && (
                    <div className={styles.summaryBox}>
                        <h3>行程概述</h3>
                        <p>{trip_summary}</p>
                    </div>
                )}
                {local_transport_summary && (
                    <div className={styles.summaryBox}>
                        <h3>当地交通建议</h3>
                        <p>{local_transport_summary}</p>
                    </div>
                )}
            </div>

            {/* 显示住宿选项 */}
            {accommodation_options && accommodation_options.length > 0 && (
                <div className={styles.accommodationSection}>
                    <h2 className={styles.sectionTitle}>住宿推荐</h2>
                    <div className={styles.accommodationGrid}>
                        {accommodation_options.map((opt, idx) => (
                            <div key={idx} className={styles.accommodationCard}>
                                <h4>{opt.recommendation_name}</h4>
                                <p><strong>地址:</strong> {opt.address || 'N/A'}</p>
                                <p><strong>价位:</strong> {opt.price_range_per_night || 'N/A'}</p>
                                <p><strong>预订:</strong> {opt.booking_channels || 'N/A'}</p>
                                <p><strong>理由:</strong> {opt.reason || 'N/A'}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <hr className={styles.divider} />

            {/* [恢复] 地图提示 */}
            <div className={styles.mapPromptBanner}>
                <p>
                    <span className="info-icon">ⓘ</span>
                    如果地图未显示当天地点，请尝试再次点击对应日期
                </p>
            </div>

            {/* 日期标签栏 */}
            <div className={styles.tabs}>
                {dailyPlans.map((plan, index) => (
                    <button
                        key={plan.day || index}
                        className={`${styles.tabButton} ${index === currentDayIndex ? styles.activeTab : ''}`}
                        onClick={() => handleDayClick(index)}
                        style={{ pointerEvents: 'auto' }} // 确保可点击
                    >
                        第 {plan.day || (index + 1)} 天 ({plan.date || '日期未知'})
                    </button>
                ))}
            </div>

            {/* 内容区 */}
            <div className={styles.contentLayout}>
                {/* 左侧：行程详情 */}
                <div className={styles.detailsPanel}>
                    {selectedDayPlan ? ( // 确保 selectedDayPlan 存在
                        <>
                            <h2>第 {selectedDayPlan.day || (currentDayIndex + 1)} 天活动</h2>
                            {selectedDayPlan.activities && selectedDayPlan.activities.length > 0 ? (
                                <div className={styles.timeline}>
                                    {selectedDayPlan.activities.map((activity, actIndex) => (
                                        <div key={actIndex} className={styles.timelineItem}>
                                            <div className={styles.timelineTime}>{activity.time || '时间未定'}</div>
                                            <div className={styles.timelineContent}>
                                                <h3>{activity.title || '活动标题缺失'}</h3>
                                                {activity.description && <p>{activity.description}</p>}

                                                {/* 保姆级细节渲染 */}
                                                <div className={styles.detailBlock}>
                                                    <strong>📍 地点:</strong> {activity.location_name || 'N/A'}
                                                </div>

                                                {/* 交通细节 */}
                                                {activity.transport_detail && (
                                                    <div className={styles.detailBlock}>
                                                        <strong>🚗 交通:</strong> ({activity.transport_detail.mode}) {activity.transport_detail.description}
                                                        <br/>
                                                        <span className={styles.subDetail}>
                                                            时长: {activity.transport_detail.duration || 'N/A'} |
                                                            费用: ¥{activity.transport_detail.estimated_cost ?? 0}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* 票务细节 */}
                                                {activity.booking_and_tickets && (
                                                    <div className={styles.detailBlock}>
                                                        <strong>🎫 票务:</strong> {activity.booking_and_tickets.necessity || 'N/A'}
                                                        <br/>
                                                        <span className={styles.subDetail}>
                                                            信息: {activity.booking_and_tickets.ticket_info || 'N/A'}
                                                        </span>
                                                        <br/>
                                                        <span className={styles.subDetail}>
                                                            预订: {activity.booking_and_tickets.details || 'N/A'}
                                                        </span>
                                                    </div>
                                                )}

                                                {/* [修正] 检查 estimated_cost 是否大于 0 再显示 */}
                                                {activity.estimated_cost != null && activity.estimated_cost > 0 && (
                                                    <div className={styles.detailBlock}>
                                                        <strong>💰 活动花费:</strong> ¥{activity.estimated_cost}
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className={styles.emptyMessage}>当天没有安排活动。</p>
                            )}

                            {/* 餐饮建议 */}
                            <h2 className={styles.sectionTitle}>餐饮建议</h2>
                            <div className={styles.mealsGrid}>
                                <MealCard meal={selectedDayPlan.meals?.breakfast} type="早餐" />
                                <MealCard meal={selectedDayPlan.meals?.lunch} type="午餐" />
                                <MealCard meal={selectedDayPlan.meals?.dinner} type="晚餐" />
                            </div>
                        </>
                    ) : (
                        // 如果 selectedDayPlan 意外不存在（理论上不应发生，因为上面有检查）
                        <p className={styles.emptyMessage}>未能加载当天的行程信息。</p>
                    )}
                </div>

                {/* 右侧：地图 (带放大缩小功能) */}
                <div
                    className={`${styles.mapPanel} ${isMapExpanded ? styles.mapPanelExpanded : ''}`}
                >
                    <div ref={mapRef} id="mapContainer" className={styles.mapContainer}>
                        {!mapReady && !error && <p>地图加载中...</p>}
                        {/* [修改] 即使有行程数据，地图加载错误也应显示 */}
                        {error && error.includes('地图') && <p>地图加载失败。</p>}
                    </div>

                    {/* 放大/缩小 切换按钮 */}
                    {/* [修改] 只有地图准备好才显示按钮 */}
                    {mapReady && !isMapExpanded ? (
                        <button
                            onClick={toggleMapExpansion}
                            className={styles.mapExpandButton}
                            title="放大地图"
                        >
                            放大
                        </button>
                    ) : mapReady && isMapExpanded ? ( // 添加 mapReady 判断
                        <button
                            onClick={toggleMapExpansion}
                            className={styles.mapShrinkButton}
                            title="缩小地图"
                        >
                            缩小
                        </button>
                    ) : null } {/* 地图未准备好时不显示按钮 */}
                </div>

            </div>
        </div>
    );
}

export default TripDetailPage;

