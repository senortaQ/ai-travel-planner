// supabase/functions/extract-trip-info/index.ts

// 1. 引入依赖 (只需要 OpenAI 兼容库)
import { OpenAI } from 'https://esm.sh/openai'

// 2. [CORS 处理]
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// 3. [初始化 OpenAI 客户端，指向阿里]
// 复用我们在模块 3 中设置的 TONGYI_API_KEY
// const client = new OpenAI({
//   apiKey: Deno.env.get('TONGYI_API_KEY'),
//   baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
// })

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
      console.error('[ExtractInfo] Missing apiKey in request body');
      return new Response(
          JSON.stringify({ error: '请求体中缺少 AI API Key' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
      )
    }
    const client = new OpenAI({
      apiKey: apiKey, // <-- 使用传入的 Key
      baseURL: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    })

    console.log('[ExtractInfo] Received text:', text);
    // 4.3. [提示词工程 - NLU 任务]
    // 指示 AI 从文本中提取关键信息，并以特定 JSON 格式返回
    // **注意**：日期提取比较复杂，我们先尝试提取，如果 AI 无法确定具体日期，它应该返回 null。
    // 预算提取需要 AI 理解中文数字和单位。
    const systemPrompt = `
      你是一个信息提取助手。
      你的任务是从用户描述的旅行计划文本中提取关键信息。
      请**严格**按照以下 JSON 格式返回提取结果，字段值为 null 表示未能从文本中明确提取到该信息。
      日期格式必须是 "YYYY-MM-DD"。
      预算必须是数字 (人民币)。
      对于看起来不通顺合理的内容根据自己的理解变通顺合理

      {
        "destination": string | null,
        "startDate": string | null, // 格式: "YYYY-MM-DD"
        "endDate": string | null,   // 格式: "YYYY-MM-DD"
        "budget": number | null,    // 数字，例如 10000
        "preferences": string | null // 用户的偏好描述
      }

      你的回答**必须**、**只能**是一个**纯粹的 JSON 字符串**，不包含任何 JSON 之外的解释性文字或标记。
      直接以 "{" 开始，并以 "}" 结束。
      如果用户只提到了旅行天数而没有具体日期，startDate 和 endDate 都应为 null。
      如果用户预算描述模糊（例如“几千块”），budget 也应为 null。
    `

    // 4.4. [构建用户输入]
    const userPrompt = `
      请从以下文本中提取旅行关键信息：
      "${text}"
    `

    // 4.5. [调用 AI (使用 OpenAI 兼容模式)]
    console.log('[ExtractInfo] Sending request to AI model...');
    const response = await client.chat.completions.create({
      model: 'qwen-turbo', // 使用速度较快的模型进行信息提取
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      stream: false,
      temperature: 0.1, // 降低随机性，更精确地提取
    })
    console.log('[ExtractInfo] Received response from AI.');

    // 4.6. [解析 AI 响应]
    const aiResponseContent = response.choices[0].message.content
    if (!aiResponseContent) {
      throw new Error('AI 未返回有效内容')
    }
    console.log('[ExtractInfo] AI Raw Response Content:', aiResponseContent);

    // 尝试解析 AI 返回的 JSON
    const extractedInfo = JSON.parse(aiResponseContent);
    console.log('[ExtractInfo] Parsed Extracted Info:', extractedInfo);

    // (可选) 在这里可以对 extractedInfo 进行一些后处理或验证，例如日期格式、预算范围等

    // 4.7. [返回成功] 将提取到的 JSON 对象返回给前端
    return new Response(JSON.stringify(extractedInfo), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })

  } catch (err) {
    // 4.8. [错误处理]
    console.error('Edge Function 异常 (extract-trip-info):', err)
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})