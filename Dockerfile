# Dockerfile
# ----------------------------------
# 阶段 1: 构建 (Build Stage)
# ----------------------------------
#
# --- ⬇️ 1. 关键改动 ⬇️ ---
# 使用 Node.js 22 (LTS) 来满足 Vite (rolldown) 的版本要求 (20.19+)
FROM node:22-alpine AS build
# --- ⬆️ 1. 关键改动 ⬆️ ---

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件
COPY package.json package-lock.json* ./

# 安装依赖 (使用 'ci' 更快、更可靠)
RUN npm ci

# 复制所有剩余的源代码
COPY . .

#
# 关键: 运行 Vite 构建
#
# --- ⬇️ 2. 关键改动 ⬇️ ---
# (移除了关于 .env 的旧注释，因为我们现在使用“运行时配置”，
# 构建时不再需要任何 Key)
# --- ⬆️ 2. 关键改动 ⬆️ ---
#
RUN npm run build

# ----------------------------------
# 阶段 2: 运行 (Serve Stage)
# ----------------------------------
# 使用 Nginx 官方镜像来提供静态文件
FROM nginx:1.25-alpine

# 将 "build" 阶段中构建好的静态文件
# (位于 /app/dist)
# 复制到 Nginx 的默认 public 目录
COPY --from=build /app/dist /usr/share/nginx/html

#
# --- ⬇️ 3. 关键改动 ⬇️ ---
# 启用自定义 Nginx 配置 (nginx.conf)
# 这对于 React Router (BrowserRouter) 正常工作至关重要
# 它会将所有 404 请求重定向到 /index.html
COPY nginx.conf /etc/nginx/conf.d/default.conf
# --- ⬆️ 3. 关键改动 ⬆️ ---
#

# 暴露 Nginx 的 80 端口
EXPOSE 80

# 容器启动时运行 Nginx
CMD ["nginx", "-g", "daemon off;"]