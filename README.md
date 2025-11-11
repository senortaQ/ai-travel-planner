# ✈️ AI 旅行规划师 (AI Travel Planner)

[![GitHub stars](https://img.shields.io/github/stars/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME?style=social)](https://github.com/YOUR_GITHUB_USERNAME/YOUR_REPOSITORY_NAME/stargazers)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

## ✨ 项目简介

AI 旅行规划师是一个智能 Web 应用，旨在简化旅行计划过程。利用 **阿里云通义千问 (Dashscope)** 模型快速生成详细的每日行程，并提供行程中的预算管理和智能记账功能。

### 核心功能

* **一句话生成行程**：通过 AI 语音或文本描述，自动创建多日详细行程。
* **智能预算追踪**：AI 辅助记账，实时监控旅行开销。
* **安全认证**：基于 Supabase Auth 的用户登录和注册系统。
* **地图服务**：使用高德地图 (Amap) 进行地理位置展示和交互。

## 🛠️ 技术栈

* **前端框架**：React 18 (with Hooks)
* **构建工具**：Vite
* **后端服务**：[Supabase](https://supabase.com/) (数据库, 身份认证, Edge Functions)
* **AI/NLU**：[阿里云通义千问 (Dashscope API)](https://dashscope.aliyuncs.com/)
* **地图服务**：高德地图 (Amap)

## ⚙️ 环境搭建和本地运行指南

**开始前，您需要准备以下资源：**

1.  一个 [Supabase](https://supabase.com/) 账户。
2.  一个 [阿里云 Dashscope](https://www.aliyun.com/product/cloudai/dashscope) 账户并获取 API Key。
3.  一个 [高德地图开放平台](https://lbs.amap.com/dev/key/app) 账户并获取 Web JS API Key 和 安全密钥 Jscode。

### 步骤 1: 克隆项目与安装依赖

在您的本地环境中执行以下命令：

```bash
# 克隆仓库
git clone https://github.com/senortaQ/ai-travel-planner.git
cd ai-travel-planner

# 安装依赖
npm install
```

### 步骤 2: 数据库结构部署 (SQL)

在运行应用之前，您必须在 Supabase 中创建必要的表格和安全策略。

1.  登录您的 Supabase Dashboard，进入 **SQL Editor**。
2.  运行以下 SQL 脚本来创建 `trips` 表、`expenses` 表和相关的 RLS (Row Level Security) 策略。

```sql
-- ===================================
-- 核心 SQL 脚本: 创建表和 RLS 策略
-- ===================================
-- 1. 创建 trips (行程) 表
CREATE TABLE public.trips (    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
destination text,
start_date date,
end_date date,
budget integer,
generated_itinerary jsonb, -- 存储 AI 生成的 JSON 格式行程 (包含预算分析)
created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- RLS 策略: trips 表
-- 任何人只能看到、创建、更新、删除自己的行程
CREATE POLICY "Users can insert their own trips" ON public.trips
FOR INSERT TO authenticated    WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can select their own trips" ON public.trips
FOR SELECT TO authenticated    USING (auth.uid() = user_id);
CREATE POLICY "Users can update their own trips" ON public.trips
FOR UPDATE TO authenticated    USING (auth.uid() = user_id);
CREATE POLICY "Users can delete their own trips" ON public.trips
FOR DELETE TO authenticated    USING (auth.uid() = user_id);

-- 2. 创建 expenses (开销) 表
CREATE TABLE public.expenses (    id uuid DEFAULT gen_random_uuid() NOT NULL PRIMARY KEY,
user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
trip_id uuid REFERENCES public.trips(id) ON DELETE CASCADE NOT NULL,
name text NOT NULL,
amount numeric NOT NULL, -- 使用 numeric 存储金额以避免浮点数错误
category text, -- 例如 '餐饮', '交通', '住宿'
created_at timestamp with time zone DEFAULT now() NOT NULL
);
-- RLS 策略: expenses 表
-- 任何人只能看到、创建、更新、删除属于自己的行程下的开销
CREATE POLICY "Users can manage their own expenses" ON public.expenses
FOR ALL TO authenticated    USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);
-- 3. 启用变更监听 (用于实时更新)
ALTER PUBLICATION supabase_realtime ADD TABLE public.trips;
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
```

### 步骤 3: 配置环境变量 (前端密钥)

1.  在项目根目录，复制文件 **`.env.example`** 并将其重命名为 **`.env`**：

```bash
cp .env.example .env
```

2.  打开 **`.env`** 文件，填入您的 Supabase 和高德地图密钥：

    * **VITE_SUPABASE_URL**：Supabase 项目 URL。
    * **VITE_SUPABASE_ANON_KEY**：Supabase `anon public` Key。
    * **VITE_AMAP_KEY**：高德地图 Web JS API Key。
    * **VITE_AMAP_SECURITY_SECRET**：高德地图安全密钥（Jscode）。

### 步骤 4: 数据库和 Edge Functions 部署 (后端密钥)

#### 4.1 配置 AI 密钥到 Supabase Vault

1.  前往您的 Supabase Dashboard -> **Settings -> Vault**。
2.  创建 Secret：**名称**为 `TONGYI_API_KEY`，**值**为您的阿里云通义千问 API 密钥。
3.  点击保存。

#### 4.2 部署 Edge Functions

您需要安装并登录 Supabase CLI 来部署后端函数。

1.  在项目根目录运行登录命令：

```bash
supabase login
```

2.  部署您的 Edge Functions：

```bash
# 部署 NLU 信息提取函数 (用于生成行程的准备步骤)
supabase functions deploy extract-trip-info --no-verify-jwt

# 部署 AI 行程生成函数
supabase functions deploy generate-itinerary --no-verify-jwt

# 部署 AI 记账解析函数
supabase functions deploy parse-expense --no-verify-jwt
```

### 步骤 5: 运行项目

一切配置完成后，您可以启动前端应用：

```bash
npm run dev
```

打开浏览器即可开始使用！

## 🤝 贡献

我们欢迎所有形式的贡献！

## 📸 运行截图

### 1. 首页 & 行程生成

<img width="2501" height="1266" alt="image" src="https://github.com/user-attachments/assets/81156ba0-92d9-4eb8-bec4-6126cbea2288" />

<img width="2499" height="1268" alt="image" src="https://github.com/user-attachments/assets/1f4dd3a2-17b0-4c13-8153-4c5ffba615c5" />

### 2. 详细行程与地图

<img width="1769" height="3081" alt="image" src="https://github.com/user-attachments/assets/5584a610-0238-47a1-81a7-69eeef8bc2f9" />

### 3. 智能预算与记账

<img width="1132" height="1330" alt="image" src="https://github.com/user-attachments/assets/79403469-5822-4726-9b06-32af8f51e5cd" />


