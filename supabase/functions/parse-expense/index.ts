// supabase/functions/parse-expense/index.ts

// 1. 引入依赖 (OpenAI 兼容库)
import { OpenAI } from 'https://esm.sh/openai'

// 2. [CORS 处理]
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 3. [初始化 OpenAI 客户端，指向阿里]
// 复用你已有的 TONGYI_API_KEY
// const client = new OpenAI({
//   apiKey: Deno.env.get('TONGYI_API_KEY'), // 从 Supabase Vault 读取
//   baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
// })

// [核心逻辑] 定义前端所期望的类别
const VALID_CATEGORIES = ['餐饮', '交通', '住宿', '活动', '购物', '其它'];

// 4. [主函数]
Deno.serve(async (req) => {
  // 4.1. 响应 OPTIONS 预检请求
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // 4.2. [获取参数] 从前端获取语音识别后的文本
    // const { text } = await req.json()
    const { text, apiKey } = await req.json()
    if (!text) {
      throw new Error('缺少需要处理的文本 (text)')
    }
    if (!apiKey) {
      console.error('[ParseExpense] Missing apiKey in request body');
      return new Response(
          JSON.stringify({ error: '请求体中缺少 AI API Key' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const client = new OpenAI({
      apiKey: apiKey, // <-- 使用传入的 Key
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })
    console.log('[ParseExpense] Received text:', text);

    // 4.3. [提示词工程 - NLU 任务]
    // 指示 AI 从文本中提取开销信息
    const systemPrompt = `
      你是一个智能记账助手。
      你的任务是从用户描述的单笔开销文本中提取关键信息。
      请**严格**按照以下 JSON 格式返回提取结果。

      {
        "name": string,       // 开销的具体项目名称，例如 "故宫门票" 或 "晚饭"
        "amount": number,     // 开销的金额，必须是数字
        "category": string    // 开销的类别，必须是以下列表中的一个: ${VALID_CATEGORIES.join(', ')}
      }

      规则:
      1. 'name' 不能为空，如果实在无法识别，请设为 "未知开销"。
      2. 'amount' 必须是数字，如果无法识别，请设为 0。
      3. 'category' 必须从提供的列表中选择。请根据 'name' 做出最合理的分类。如果无法分类，请设为 "其它"。
      4. 你的回答**必须**、**只能**是一个**纯粹的 JSON 字符串**，不包含任何 JSON 之外的解释性文字或标记。
      5. 直接以 "{" 开始，并以 "}" 结束。
    `

    // 4.4. [构建用户输入]
    const userPrompt = `
      请从以下文本中提取开销关键信息：
      "${text}"
    `

    // 4.5. [调用 AI (使用 OpenAI 兼容模式)]
    console.log('[ParseExpense] Sending request to AI model (qwen-turbo)...');
    const response = await client.chat.completions.create({
      model: 'qwen-turbo', // 使用速度较快的模型进行信息提取
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      temperature: 0.1, // 降低随机性，更精确地提取
    })
    console.log('[ParseExpense] Received response from AI.');

    // 4.6. [解析 AI 响应]
    const aiResponseContent = response.choices[0].message.content
    if (!aiResponseContent) {
      throw new Error('AI 未返回有效内容')
    }
    console.log('[ParseExpense] AI Raw Response Content:', aiResponseContent);

    // 尝试解析 AI 返回的 JSON
    const extractedInfo = JSON.parse(aiResponseContent);
    console.log('[ParseExpense] Parsed Extracted Info:', extractedInfo);

    // [可选] 在这里可以对 extractedInfo 进行验证，例如类别是否在 VALID_CATEGORIES 中
    if (!VALID_CATEGORIES.includes(extractedInfo.category)) {
      console.warn(`AI 返回了无效类别: ${extractedInfo.category}, 强制设为 "其它"`);
      extractedInfo.category = '其它';
    }

    // 4.7. [返回成功] 将提取到的 JSON 对象返回给前端
    return new Response(JSON.stringify(extractedInfo), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    // 4.8. [错误处理]
    console.error('Edge Function 异常 (parse-expense):', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})