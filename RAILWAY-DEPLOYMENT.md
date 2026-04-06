# Railway 部署指南

本文档提供 StudyTogether 项目在 Railway 平台上的完整部署流程。

---

## 快速参考：数据库配置

**如果你找不到 PostGIS 插件，这是正常的！**

正确步骤：
1. ✅ 添加 **PostgreSQL** 插件（不是 PostGIS）
2. ✅ 部署后端服务
3. ✅ 在 Railway Console 运行：`alembic upgrade head`
4. ✅ PostGIS 会自动启用（迁移脚本包含此逻辑）

**详细说明见下方"二、数据库配置"章节。**

---

## 目录

- [准备工作](#一准备工作)
- [数据库配置](#二数据库配置关键步骤)
- [环境变量配置](#三环境变量配置)
- [部署后端](#四部署后端)
- [部署前端](#五部署前端)
- [初始化数据库](#六初始化数据库)
- [配置文件说明](#七railway-配置文件说明)
- [常见问题排查](#八常见问题排查)
- [部署检查清单](#九部署检查清单)

---

## 一、准备工作

### 1. 安装 Railway CLI

```bash
npm install -g @railway/cli
# 或
brew install railway
```

### 2. 登录 Railway

```bash
railway login
```

### 3. 初始化项目

```bash
cd E:\studyTogether
railway init
```

---

## 二、数据库配置（关键步骤）

**重要说明：** Railway 目前没有单独的 PostGIS 插件。我们需要使用 PostgreSQL 插件，然后手动启用 PostGIS 扩展。

### 方式 1：通过 Railway UI（推荐）

1. 在 Railway 项目中，点击 **"New Service"**
2. 选择 **"Plugin"** → 搜索并选择 **"PostgreSQL"**（不是 PostGIS）
3. Railway 会创建一个 PostgreSQL 数据库实例
4. 数据库会自动设置 `DATABASE_URL` 环境变量

### 方式 2：通过 CLI

```bash
# 添加 PostgreSQL 插件
railway add --plugin postgresql

# 验证数据库已添加
railway status
```

### 启用 PostGIS 扩展（必须在数据库启动后执行）

Railway 的 PostgreSQL 插件支持 PostGIS 扩展，但需要手动启用。推荐按以下顺序尝试：

#### 方法 A：通过数据库迁移自动启用（最简单，推荐）

**这是最简单的方法！** 你的项目迁移脚本已经包含自动启用 PostGIS 扩展的代码。

**步骤：**

1. 在 Railway UI 中，进入 **后端服务**（不是 PostgreSQL 服务）
2. 找到 **"Exec"** 或 **"Execute"** 或 **"Terminal"** 标签页
3. 执行以下命令：

```bash
# 等待服务完全启动
sleep 5

# 运行数据库迁移
alembic upgrade head
```

迁移脚本（backend/alembic/versions/001_initial_schema.py:47）会自动执行：
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

4. 验证 PostGIS 是否启用：
```bash
# 访问后端的 debug 端点
curl https://your-backend-domain.railway.app/debug/postgis
```

如果返回 `"postgis_enabled": true`，说明扩展已成功启用。

#### 方法 B：通过 Railway CLI（如果没有 UI 访问权限）

```bash
# 1. 列出所有服务
railway status

# 2. 在后端服务中执行命令
railway run -s backend-service-name "alembic upgrade head"

# 3. 验证
railway run -s backend-service-name "curl http://localhost:8000/debug/postgis"
```

#### 方法 C：通过 Railway Web Terminal

如果 Railway UI 提供了 Web Terminal 功能：

1. 进入 **后端服务**
2. 点击 **"Terminal"** 或 **"Shell"** 或 **"Exec"**
3. 在打开的终端中执行：

```bash
alembic upgrade head
```

#### 方法 D：手动连接数据库（如果上述方法都不可用）

**重要说明：** Railway 的 PostgreSQL 插件通常不提供直接的 Console 访问。最可靠的方法是通过后端服务连接。

在 **后端服务** 的 Terminal 中执行：

```bash
# 从 DATABASE_URL 环境变量中提取连接信息
# 然后使用 psql 连接
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql $DATABASE_URL -c "SELECT PostGIS_Version();"
```

或者使用 Python：

```bash
python -c "
from app.core.database import AsyncSessionLocal
from sqlalchemy import text
import asyncio

async def check_postgis():
    async with AsyncSessionLocal() as db:
        # 启用 PostGIS
        await db.execute(text('CREATE EXTENSION IF NOT EXISTS postgis'))
        await db.commit()

        # 验证
        result = await db.execute(text('SELECT PostGIS_Version()'))
        version = result.scalar()
        print(f'PostGIS version: {version}')

asyncio.run(check_postgis())
"
```

#### 方法 E：使用 Railway CLI 的变量和运行功能

```bash
# 1. 确保 DATABASE_URL 格式正确（postgresql+asyncpg://）
railway variables set DATABASE_URL="postgresql+asyncpg://..."

# 2. 重新部署后端
railway up

# 3. 部署完成后，访问 debug 端点验证
curl https://your-backend-domain.railway.app/debug/postgis
```

---

**推荐流程（按优先级）：**

1. ✅ **方法 A** - 通过后端服务的 Exec/Terminal 运行 `alembic upgrade head`
2. ✅ **方法 B** - 使用 Railway CLI
3. ⚠️ **方法 D/E** - 通过后端连接数据库手动执行

项目已包含自动启用 PostGIS 的逻辑。在后端首次启动时，检查 `/debug/postgis` 端点：

```
https://your-backend-domain.railway.app/debug/postgis
```

如果返回 `"postgis_enabled": true`，说明扩展已成功启用。

#### 方法 C：通过数据库迁移脚本（自动启用 PostGIS）

**这是最简单的方法！** 你的项目迁移脚本已经包含自动启用 PostGIS 扩展的代码。

在后端服务的 Railway Console 中执行：

```bash
# 运行数据库迁移
alembic upgrade head
```

迁移脚本（backend/alembic/versions/001_initial_schema.py:47）会自动执行：
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

**无需手动启用 PostGIS，迁移脚本会自动处理！**

---

## 三、环境变量配置

Railway 会自动注入 `DATABASE_URL`。你还需要手动添加以下环境变量。

### 通过 Railway UI 配置

进入项目的 **"Variables"** 标签页，添加以下变量：

```bash
# JWT 密钥（生产环境必须更改）
SECRET_KEY=your-super-secret-key-change-this-in-production

# Token 过期时间
ACCESS_TOKEN_EXPIRE_MINUTES=15
REFRESH_TOKEN_EXPIRE_DAYS=7

# 环境设置
ENVIRONMENT=production
DEBUG=false

# 前端 URL（部署后需要更新为实际的前端 URL）
FRONTEND_URL=https://your-frontend-domain.railway.app

# 高德地图 API 密钥（用于前端）
NEXT_PUBLIC_AMAP_KEY=your_amap_key_here
NEXT_PUBLIC_AMAP_SECRET=your_amap_secret_here
```

### 生成安全的 SECRET_KEY

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

---

## 四、部署后端

### 方式 1：通过 GitHub 集成（推荐）

1. 在 Railway UI 中：
   - 点击 **"New Service"**
   - 选择 **"Deploy from GitHub repo"**
   - 选择你的 StudyTogether 仓库
   - **重要**：在 Root Directory 设置为 `backend`
   - Railway 会自动读取 `backend/railway.json` 和 `backend/Dockerfile`

2. 配置环境变量（见上一步）

### 方式 2：通过 CLI

```bash
# 创建后端服务（指向 backend 目录）
railway up --backend backend

# 设置环境变量
railway variables set SECRET_KEY="your-secret-key"
railway variables set ENVIRONMENT=production
railway variables set DEBUG=false
```

---

## 五、部署前端

### 1. 在 Railway UI 中

- 点击 **"New Service"**
- 选择 **"Deploy from GitHub repo"**
- **Root Directory** 设置为 `frontend`
- Railway 会读取 `frontend/railway.json` 和 `frontend/Dockerfile`

### 2. 配置前端环境变量

```bash
# 后端 API URL（部署后从 Railway 获取）
NEXT_PUBLIC_BACKEND_URL=https://your-backend-domain.railway.app

# 高德地图配置
NEXT_PUBLIC_AMAP_KEY=your_amap_key
NEXT_PUBLIC_AMAP_SECRET=your_amap_secret
```

### 3. 获取后端 URL

部署完成后，在 Railway UI 中：
- 进入后端服务
- 点击 **"Networking"**
- 复制生成的域名（如 `https://xxx.up.railway.app`）

---

## 六、初始化数据库

部署后端后，需要运行数据库迁移。

### 1. 通过 Railway Console

```bash
# 连接到后端服务的控制台
railway open --service "backend-service-name"

# 或者直接在 Railway UI 中：Backend Service → Console

# 在控制台中运行：
alembic upgrade head

# 验证 PostGIS 扩展
psql $DATABASE_URL -c "CREATE EXTENSION IF NOT EXISTS postgis;"
psql $DATABASE_URL -c "SELECT PostGIS_Version();"
```

### 2. 验证部署

访问健康检查端点：
```
https://your-backend-domain.railway.app/health/ready
```

应该返回：
```json
{
  "status": "ready",
  "service": "StudyTogether API",
  "version": "0.1.0"
}
```

检查 PostGIS：
```
https://your-backend-domain.railway.app/debug/postgis
```

---

## 七、Railway 配置文件说明

项目中已包含的配置文件：

### backend/railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "dockerContext": ".",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/health/ready",
    "healthcheckTimeout": 60,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "numReplicas": 1
  },
  "buildCommand": "pip install -r requirements.txt"
}
```

### frontend/railway.json

```json
{
  "$schema": "https://railway.app/railway.schema.json",
  "build": {
    "dockerContext": ".",
    "dockerfilePath": "Dockerfile"
  },
  "deploy": {
    "healthcheckPath": "/",
    "healthcheckTimeout": 300,
    "restartPolicyType": "ON_FAILURE",
    "restartPolicyMaxRetries": 10,
    "numReplicas": 1
  }
}
```

### backend/Dockerfile

```dockerfile
FROM python:3.11-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY requirements.txt .

# Install Python dependencies (includes geoalchemy2 for PostGIS)
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY . .

# Expose port
EXPOSE 8000

# Run uvicorn server (production mode - use Railway's PORT)
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
```

**关键特性：**
- 使用 Python 3.11
- 自动安装所有依赖（包括 geoalchemy2 PostGIS 支持）
- 使用 Railway 提供的 `PORT` 环境变量

---

## 八、常见问题排查

### 1. PostGIS 扩展未启用

**症状：** 地理位置查询失败

**解决方案：**

在 Railway Console 中运行：
```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

### 2. CORS 错误

**症状：** 前端无法调用后端 API

**解决方案：**

确保 `FRONTEND_URL` 环境变量设置为实际的前端域名。

检查后端 CORS 配置（backend/app/main.py:66-74）：
```python
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # 临时允许所有来源
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
    max_age=600,
)
```

### 3. 数据库连接失败

**症状：** `/health` 端点返回数据库未连接

**解决方案：**

检查 `DATABASE_URL` 格式：
```
postgresql+asyncpg://user:password@host:port/database
```

确保 Railway 的 PostGIS 插件正在运行。

### 4. 构建失败

**症状：** Docker 构建超时或失败

**解决方案：**

检查 Dockerfile 中的缓存破坏标记（backend/Dockerfile:4）：
```dockerfile
ARG CACHEBUST=2025-04-06-09
```

如果需要强制重新构建，更新这个时间戳。

### 5. 查看日志

```bash
# 实时查看后端日志
railway logs --service backend

# 查看特定行数
railway logs --service backend -n 100

# 查看所有服务日志
railway logs
```

---

## 九、部署检查清单

完成以下所有项以确保成功部署：

### Railway 项目设置

- [ ] Railway 项目已创建
- [ ] PostGIS 插件已添加（不是普通 PostgreSQL）
- [ ] `DATABASE_URL` 环境变量已自动设置

### 后端配置

- [ ] `SECRET_KEY` 已设置为强随机值
- [ ] `ENVIRONMENT=production` 已设置
- [ ] `DEBUG=false` 已设置
- [ ] `ACCESS_TOKEN_EXPIRE_MINUTES=15` 已设置
- [ ] `REFRESH_TOKEN_EXPIRE_DAYS=7` 已设置

### 后端部署

- [ ] 后端服务已部署并指向 `backend/` 目录
- [ ] Dockerfile 成功构建
- [ ] 健康检查 `/health/ready` 返回 200
- [ ] PostGIS 检查 `/debug/postgis` 显示扩展已启用
- [ ] 数据库迁移已运行（`alembic upgrade head`）

### 前端配置

- [ ] 前端服务已部署并指向 `frontend/` 目录
- [ ] `NEXT_PUBLIC_BACKEND_URL` 已设置为后端域名
- [ ] `NEXT_PUBLIC_AMAP_KEY` 已配置
- [ ] `NEXT_PUBLIC_AMAP_SECRET` 已配置

### 最终验证

- [ ] 后端 API 可访问（`https://xxx.up.railway.app`）
- [ ] 前端可访问（`https://yyy.up.railway.app`）
- [ ] 前端可以成功调用后端 API
- [ ] WebSocket 连接正常
- [ ] 地图功能正常显示

---

## 十、项目结构总结

```
StudyTogether (GitHub Repository)
├── backend/                    # Railway Service 1
│   ├── railway.json           # Railway 配置
│   ├── Dockerfile             # Docker 构建
│   ├── requirements.txt       # 包含 geoalchemy2
│   └── app/
│       └── main.py            # 健康检查端点
│
└── frontend/                   # Railway Service 2
    ├── railway.json           # Railway 配置
    ├── Dockerfile             # Docker 构建
    └── package.json
```

---

## 十一、参考链接

- [Railway 官方文档](https://docs.railway.app/)
- [Railway PostGIS 插件](https://railway.app/plugin/postgis)
- [FastAPI 部署指南](https://fastapi.tiangolo.com/deployment/)
- [Next.js 部署指南](https://nextjs.org/docs/deployment)

---

## 十二、获取帮助

如果遇到问题：

1. 查看 Railway 日志：`railway logs`
2. 检查环境变量配置
3. 验证数据库连接
4. 测试健康检查端点
5. 查看 [项目 Issues](https://github.com/your-repo/issues)

---

**文档版本：** 1.0.0
**最后更新：** 2025-04-06
