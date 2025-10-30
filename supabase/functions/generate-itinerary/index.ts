import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.0'
import { OpenAI } from 'https://esm.sh/openai@4.20.1'

// 2. [CORS 处理]
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 3. [初始化 OpenAI 客户端，但指向阿里]
const client = new OpenAI({
  apiKey: Deno.env.get('TONGYI_API_KEY'),
  baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
})

// 4. [主函数]
Deno.serve(async (req) => {
  // 4.1. 响应 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 4.2. [获取参数]
    const { trip_id } = await req.json()
    if (!trip_id) {
      throw new Error('缺少 trip_id')
    }

    // 4.3. [安全认证]
    const supabaseClient = createClient(
        Deno.env.get('SUPABASE_URL') ?? '',
        Deno.env.get('SUPABASE_ANON_KEY') ?? '',
        {
          global: { headers: { Authorization: req.headers.get('Authorization')! } },
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
    )
    console.log('[Func] Authorization Header received:', req.headers.get('Authorization'));

    // 4.5. [读取数据] - 依赖 RLS 验证
    const { data: trip, error: tripError } = await supabaseClient
        .from('trips')
        .select('destination, start_date, end_date, budget, preferences_text')
        .eq('id', trip_id)
        .single()

    // 4.5.1 [检查 RLS 结果]
    if (tripError || !trip) {
      console.error('[Func] RLS Check Failed or Trip Not Found:', tripError);
      if (tripError && tripError.code === 'PGRST116') { // 'PGRST116' == 0 rows
        throw new Error('行程未找到或无权访问');
      }
      throw new Error('行程未找到、无权访问，或认证失败');
    }

    // --- 4.6. [提示词工程] ---
    // (保持“保姆级” Prompt 不变)
    // --- 4.6. [提示词工程] ---
// (这是升级版的“保姆级” Prompt)
    const systemPrompt = `
      你是一个极其细致、经验丰富的“保姆级”旅行规划师。
      你的任务是根据用户的需求，并**基于你搜索到的真实世界信息**，生成一份详细到“令人发指”的旅行计划。
      你的回答**必须**、**只能**是一个**纯粹的 JSON 字符串**。
      **禁止**任何 JSON 之外的解释性文字。
      严格按照我定义的 TypeScript 接口 "ItineraryResponse" 来返回。
    
      --- TypeScript 接口定义 ---
    
      // 交通细节 (保姆级)
      interface TransportDetail {
        mode: '步行' | '地铁' | '公交' | '出租车/网约车' | '自驾' | '渡轮' | '其它';
        description: string; // 例如: "乘坐地铁1号线 (开往XX方向)，在'XX站'下车 (B口出)，步行5分钟。"
        duration: string; // 例如: "约25分钟"
        estimated_cost: number; // 这段交通的估算费用
      }
    
      // 预订与票务 (保姆级)
      interface BookingInfo {
        necessity: '无需预约' | '建议预约' | '必须预约';
        details: string; // 例如: "通过'XX'App或官网提前3天" 或 "现场扫码即可"
        ticket_info: string; // 例如: "成人票 ¥120 / 学生票 ¥60" 或 "免费"
      }
    
      // 住宿选项 (提供多个)
      interface AccommodationOption {
        recommendation_name: string; // 酒店/民宿名称
        address: string; // 真实地址
        price_range_per_night: string; // 例如: "¥800-¥1000"
        booking_channels: string; // 例如: "携程 / 飞猪 / 官方网站"
        reason: string; // 推荐理由 (例如: "靠近XX地铁站，性价比高" 或 "景观无敌，适合情侣")
      }
    
      // 每日活动 (包含上述保姆级细节)
      interface Activity {
        time: string; // 例如: "09:00 - 11:00"
        title: string; // 活动标题 (例如: "参观故宫")
        description: string; // 详细描述 (例如: "重点游览中轴线三大殿...")
        location_name: string; // 地点名称 (例如: "故宫博物院")
        transport_detail: TransportDetail; // !!! 关键：如何从上一个活动地点过来
        booking_and_tickets: BookingInfo; // !!! 关键：票务和预订
        estimated_cost: number; // 这个活动本身的花费 (不含交通，主要指门票)
      }
    
      // 每日餐饮建议 (包含地址和人均)
      interface MealSuggestion {
        name: string; // 餐厅名称 (或 "便利店简餐")
        address: string; // 真实地址
        recommendation: string; // 推荐菜或理由
        avg_cost: number; // 人均消费
      }
    
      // 每日计划
      interface DailyPlan {
        day: number;
        date: string; // 日期 (例如: "2025-10-01")
        activities: Activity[];
        meals: {
          breakfast: MealSuggestion;
          lunch: MealSuggestion;
          dinner: MealSuggestion;
        };
      }
    
      
      // 预算分析 (核心规则必须遵守)
      interface BudgetAnalysis {
        total_estimated_cost: number; // [规则] 必须等于 breakdown 总和
        breakdown: {
          accommodation: number; // 估算总住宿费 (需要基于推荐选项和天数)
          transport: number; // 估算总交通费 (城际 + 所有市内交通)
          food: number; // 估算总餐饮费 (基于推荐和天数)
          activities: number; // 估算总活动/门票费
        };
      }
    
      // 最终响应结构
      interface ItineraryResponse {
        trip_summary: string; // 整体行程概述
        local_transport_summary: string; // 当地交通概览 (例如: "建议购买地铁三日通票")
        accommodation_options: AccommodationOption[]; // !!! 关键：住宿选项 (提供 2-3 个)
        daily_plan: DailyPlan[];
        budget_analysis: BudgetAnalysis;
      }
      --- 接口定义结束 ---
    
      **特别强调**: 
      1.  所有 'location_name', 'recommendation_name', 'address' 字段必须是**真实存在**的。
      2.  'transport_detail' 必须是**极其详细且符合现实**的，说明如何从*上一个地点*到达。
      3.  'booking_and_tickets' 必须提供**真实可行**的预订建议。
      4.  你的回答必须是**纯粹的 JSON**。
    `
    // --- Prompt 修改结束 ---

    // 4.7. [构建用户输入]
    const userPrompt = `
      请为我规划一次**保姆级**的详细旅行：
      - 目的地: ${trip.destination}
      - 开始日期: ${trip.start_date}
      - 结束日期: ${trip.end_date}
      - 总预算 (人民币): ${trip.budget}
      - 旅行偏好: ${trip.preferences_text || '无特殊偏好'}
      
      
      

      请**务必**使用你的**搜索工具**查询真实的酒店、餐厅、景点地址、票价和交通时间，以确保计划的真实性和合理性。以上五个条件是设计旅行计划的前提条件必须遵守。
    `

    // 4.8. [调用 AI (OpenAI 兼容模式 + 开启搜索)]
    console.log('[Func] Sending request to Qwen (OpenAI compatible) with Search enabled...');

    const response = await client.chat.completions.create({
      model: 'qwen3-max',
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      // @ts-ignore
      // enable_search: true,
      stream: false,
    });

    console.log('[Func] Received response from AI.');

    // --- 4.9. [解析 AI 响应] - *** 关键修改在这里 *** ---
    const aiResponseContent = response.choices[0].message.content;
    if (!aiResponseContent) {
      throw new Error('AI 未返回有效内容');
    }
    console.log('[Func] AI Raw Response Content:', aiResponseContent);

    let jsonString = aiResponseContent;

    // --- 新增：JSON 清理逻辑 ---
    // 1. 查找第一个 '{'
    const jsonStart = jsonString.indexOf('{');
    // 2. 查找最后一个 '}'
    const jsonEnd = jsonString.lastIndexOf('}');

    if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
      console.error('[Func] 未能在 AI 响应中找到有效的 JSON 括号 { 和 }。');
      throw new Error('AI 返回的不是有效的 JSON 格式。');
    }

    // 3. 提取 { ... } 之间的内容
    jsonString = jsonString.substring(jsonStart, jsonEnd + 1);
    console.log('[Func] Extracted JSON string for parsing:', jsonString);
    // --- 清理逻辑结束 ---

    // 4. 尝试解析清理后的字符串
    const itineraryJson = JSON.parse(jsonString); // <-- 这一行就是之前的 147 行
    console.log('[Func] Parsed Itinerary JSON successfully:', itineraryJson);
    // --- 修改结束 ---

    // 4.10. [保存回数据库]
    console.log('[Func] Attempting to update trip ID:', trip_id);
    const { error: updateError } = await supabaseClient
        .from('trips')
        .update({ generated_itinerary: itineraryJson })
        .eq('id', trip_id)

    if (updateError) {
      console.error('[Func] DB Update failed:', updateError);
      throw new Error('更新数据库失败: ' + updateError.message)
    }
    console.log('[Func] DB Update successful for trip ID:', trip_id);

    // 4.11. [返回成功]
    return new Response(JSON.stringify({ message: '行程生成成功' }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    // 4.12. [错误处理]
    // 如果 JSON.parse 失败，错误会在这里被捕获
    console.error('Edge Function 异常:', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})