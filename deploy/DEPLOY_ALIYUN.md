# 阿里云轻量服务器部署指南

本指南帮助你将「效果图工作室」部署到阿里云轻量服务器，并集成 IOPaint 擦除功能，实现国内外用户均可访问。

## 架构说明

```
用户浏览器
    ↓
Nginx (80/443) 或 Node 服务 (3000)
    ├── 静态文件 (dist/)
    ├── /api/iopaint → IOPaint 服务 (8080)
    └── /api/baidu-inpaint → 百度 API（可选）
    ↓
IOPaint (LaMa 模型, 8080)
```

## 一、服务器要求

- **系统**：Ubuntu 22.04 或 CentOS 7+
- **配置**：建议 2 核 4GB 以上（IOPaint CPU 模式需约 2GB 内存）
- **有 GPU**：可显著加速，可选

## 二、部署 IOPaint

### 方式 A：Docker（推荐）

```bash
# 1. 安装 Docker
curl -fsSL https://get.docker.com | sh
sudo systemctl start docker

# 2. 拉取并运行 IOPaint（LaMa 模型，CPU 模式）
docker run -d --name iopaint -p 8080:8080 \
  -e IOPAINT_MODEL=lama \
  sanster/iopaint:latest

# 或使用社区镜像（CPU 优化）
# docker run -d --name iopaint -p 8080:8080 schwitz/docker-iopaint
```

### 方式 B：pip 安装

```bash
# 1. 安装 Python 3.10+
sudo apt update
sudo apt install python3-pip python3-venv -y

# 2. 安装 IOPaint
pip install iopaint

# 3. 启动（CPU 模式，LaMa 模型）
iopaint start --model=lama --device=cpu --port=8080 --host=0.0.0.0
```

### 验证 IOPaint

访问 `http://你的服务器IP:8080`，应能看到 IOPaint 的 Web 界面。

## 三、部署网站

### 1. 上传代码并构建

```bash
# 在本地执行
npm run build
# 将 dist/、server/、package.json、package-lock.json 上传到服务器
```

### 2. 服务器上安装依赖并启动

```bash
# 安装 Node.js 18+
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# 进入项目目录
cd /path/to/效果图生成器

# 安装依赖（仅需 express 和 http-proxy-middleware）
npm install --production

# 设置环境变量并启动
export IOPAINT_URL=http://127.0.0.1:8080
export PORT=3000
npm run start
```

### 3. 使用 PM2 保持运行

```bash
npm install -g pm2
pm2 start server/index.js --name "effect-studio" --env production
pm2 save
pm2 startup  # 设置开机自启
```

## 四、启用 IOPaint 擦除功能

构建时设置环境变量：

```bash
VITE_USE_IOPAINT=true npm run build
```

或在 `.env.production` 中添加：

```
VITE_USE_IOPAINT=true
```

然后重新 `npm run build`。

## 五、配置 Nginx（可选，用于 HTTPS）

```nginx
server {
    listen 80;
    server_name your-domain.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300;
        proxy_connect_timeout 300;
        proxy_send_timeout 300;
    }

    location /api/iopaint {
        proxy_pass http://127.0.0.1:8080;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_read_timeout 120;
        client_max_body_size 20M;
    }
}
```

## 六、国内外访问

- **国内用户**：选择阿里云国内地域（如华东、华北），访问速度较快
- **国外用户**：可选择香港、新加坡等节点，或使用 CDN 加速
- **备案**：若使用国内服务器且绑定域名，需完成 ICP 备案

## 七、故障排查

| 问题 | 处理 |
|------|------|
| IOPaint 擦除无响应 | 检查 IOPaint 是否运行：`curl http://127.0.0.1:8080/api/v1/server-config` |
| 内存不足 | 轻量服务器建议 4GB+，或使用百度 API 替代 IOPaint |
| 处理很慢 | CPU 模式较慢，可考虑 GPU 或继续使用百度 API |

## 八、备用方案：仅用百度 API

若服务器资源不足，可不部署 IOPaint，仅使用百度 API：

- 不设置 `VITE_USE_IOPAINT`
- 在服务器环境变量中配置 `BAIDU_AK` 和 `BAIDU_SK`
- 网站会通过 `/api/baidu-inpaint` 调用百度服务
