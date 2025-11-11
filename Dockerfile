# Dockerfile
# ----------------------------------
# 阶段 1: 构建 (Build Stage)
# ----------------------------------
# 使用 Node.js 18-alpine 作为基础镜像，它体积更小
FROM node:18-alpine AS build

# 设置工作目录
WORKDIR /app

# 复制 package.json 和 lock 文件
# (使用通配符 * 兼容 npm, yarn, pnpm)
COPY package.json package-lock.json* ./

# 安装依赖
# 使用 --ci 而不是 install，它更快且用于 CI/CD 环境
RUN npm ci

# 复制所有剩余的源代码
COPY . .

#
# 关键: 运行 Vite 构建
#
# !!! 重要 !!!
# 在运行 `docker build` 之前，
# 您本地的 .env 文件必须包含所有正确的 VITE_ 密钥！
# (VITE_SUPABASE_URL, VITE_SUPABASE_ANON_KEY, VITE_AMAP_KEY 等)
# Vite 会在构建时将这些值打包到静态文件中。
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

# (可选) 如果您的 React 应用使用了路由 (e.g., React Router),
# 您需要配置 Nginx 将所有 404 请求重定向到 index.html。
# 1. 在本地创建一个 `nginx.conf` 文件。
# 2. 取消下面这行 'COPY' 命令的注释。
#
# --- nginx.conf 示例 (如果需要) ---
# server {
#     listen 80;
#     location / {
#         root   /usr/share/nginx/html;
#         index  index.html index.htm;
#         try_files $uri $uri/ /index.html;
#     }
# }
# --- 结束 ---
#
# COPY nginx.conf /etc/nginx/conf.d/default.conf

# 暴露 Nginx 的 80 端口
EXPOSE 80

# 容器启动时运行 Nginx
CMD ["nginx", "-g", "daemon off;"]