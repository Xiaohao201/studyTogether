# Railway 部署指南

StudyTogether 项目使用 Railway 进行云端部署。本指南将引导你完成整个部署流程。

---

## 📋 部署前准备

### 1. 必需账号
- [x] GitHub 账号（已有）
- [ ] Railway 账号：https://railway.app/
- [ ] 高德地图 API Key：https://console.amap.com/

### 2. 生成安全密钥

在本地终端运行以下命令生成强随机密钥：

```bash
python -c "import secrets; print(secrets.token_urlsafe(32))"
```

保存生成的密钥，后续配置时需要使用。

### 3. 获取高德地图 API Key

1. 访问 [高德开放平台](https://console.amap.com/)
2. 注册/登录账号
3. 创建应用，选择「Web端(JS API)」
4. 获取 Key 和 Security密钥

---

## 🎯 重要：Monorepo 部署说明

**StudyTogether 是一个 monorepo 项目**，包含两个独立的子项目：

- `backend/` - FastAPI 后端服务
- `frontend/` - Next.js 前端应用

**⚠️ 关键配置**：

在 Railway 部署时，**必须**为每个服务设置正确的 **Root Directory**：

| 服务 | Root Directory | 说明 |
|------|---------------|------|
| Backend | `backend` | 指向 `backend/` 目录 |
| Frontend | `frontend` | 指向 `frontend/` 目录 |

**如果你不设置 Root Directory，Railway 会尝试从根目录构建，导致失败！**

---

## 🚀 部署步骤

### 步骤 1：登录 Railway

1. 访问 https://railway.app/
2. 点击 **Login with GitHub**
3. 授权 Railway 访问你的 GitHub 仓库

### 步骤 2：创建新项目

1. 点击 **New Project**
2. 选择 **Deploy from GitHub repo**
3. 选择你的仓库：`Xiaohao201/studyTogether`

---

## 🗄️ 步骤 3：部署 PostgreSQL 数据库

### 3.1 添加数据库服务

在 Railway 项目中：

1. 点击 **New Service**
2. 选择 **Database**
3. 选择 **PostgreSQL**
4. 等待数据库创建完成（约 1-2 分钟）

### 3.2 启用 PostGIS 扩展

1. 进入数据库服务页面
2. 点击 **Variables** 标签
3. 添加以下环境变量：

```bash
POSTGRES_EXTENSIONS=postgis
```

4. 点击 **Console** 标签
5. 在 SQL 编辑器中运行：

```sql
CREATE EXTENSION IF NOT EXISTS postgis;
```

6. 验证 PostGIS 安装：

```sql
SELECT PostGIS_Version();
```

### 3.3 获取数据库连接字符串

在数据库服务的 **Variables** 标签中，复制 `DATABASE_URL` 的值，格式类似：

```
postgresql://postgres:xxx@containers-us-west-xxx.railway.app:xxxx/railway
```

**重要**：将 `postgresql://` 改为 `postgresql+asyncpg://`（FastAPI 需要）：

```
postgresql+asyncpg://postgres:xxx@containers-us-west-xxx.railway.app:xxxx/railway
```

---

## 🔧 步骤 4：部署后端服务

### 4.1 创建后端服务

1. 在 Railway 项目中点击 **New Service**
2. 选择 **Deploy from GitHub repo**
3. 再次选择 `Xiaohao201/studyTogether` 仓库

**🔴 关键步骤 - 必须设置 Root Directory**：

4. 在部署配置页面，点击 **"View Config"** 或 ⚙️ 图标
5. 找到 **"Root Directory"** 字段
6. 输入：`backend`（这告诉 Railway 只构建 `backend/` 目录）
7. **Root Directory** 字段在展开的配置选项中，默认为根目录

8. 确认配置：
   - ✅ **Root Directory**: `backend`
   - ✅ **Dockerfile Path**: `Dockerfile`（会自动检测到 backend/Dockerfile）

9. 点击 **Deploy** 开始部署

**预期结果**：Railway 应该能够检测到 Dockerfile 并成功构建。

### 4.2 配置环境变量

在后端服务的 **Variables** 标签中，添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `DATABASE_URL` | `postgresql+asyncpg://...` | 从步骤 3.3 获取的连接字符串 |
| `SECRET_KEY` | `你生成的随机密钥` | JWT 签名密钥 |
| `FRONTEND_URL` | `https://your-frontend-domain.railway.app` | 前端 URL（部署后更新） |
| `ENVIRONMENT` | `production` | 运行环境 |
| `PORT` | `8000` | 服务端口 |
| `ACCESS_TOKEN_EXPIRE_MINUTES` | `15` | Token 过期时间 |
| `REFRESH_TOKEN_EXPIRE_DAYS` | `7` | 刷新 Token 有效期 |

### 4.3 运行数据库迁移

1. 等待后端部署完成（约 3-5 分钟）
2. 点击后端服务的 **Console** 标签
3. 点击 **New Console** → **Bash**
4. 运行以下命令：

```bash
alembic upgrade head
```

### 4.4 验证后端部署

1. 在后端服务页面，点击 **View Logs**
2. 查看是否有错误信息
3. 访问生成的域名（如 `https://studytogether-backend-xxx.railway.app/docs`）
4. 应该能看到 FastAPI 的 Swagger 文档页面

---

## 🌐 步骤 5：部署前端服务

### 5.1 创建前端服务

1. 在 Railway 项目中点击 **New Service**
2. 选择 **Deploy from GitHub repo**
3. 再次选择 `Xiaohao201/studyTogether` 仓库

**🔴 关键步骤 - 必须设置 Root Directory**：

4. 在部署配置页面，点击 **"View Config"** 或 ⚙️ 图标
5. 找到 **"Root Directory"** 字段
6. 输入：`frontend`（这告诉 Railway 只构建 `frontend/` 目录）

7. 确认配置：
   - ✅ **Root Directory**: `frontend`
   - ✅ **Build Command**: `npm run build`
   - ✅ **Start Command**: `npm start`

8. 点击 **Deploy** 开始部署

**预期结果**：Railway 应该能够检测到 package.json 并成功构建 Next.js 应用。

### 5.2 配置环境变量

在前端服务的 **Variables** 标签中，添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXT_PUBLIC_BACKEND_URL` | `https://your-backend-domain.railway.app` | 后端 API 地址 |
| `NEXT_PUBLIC_AMAP_KEY` | `你的高德地图 Key` | 高德地图 API Key |
| `NEXT_PUBLIC_AMAP_SECRET` | `你的高德密钥` | 高德地图安全密钥 |
| `PORT` | `3000` | 服务端口 |

### 5.3 更新后端 CORS 配置

**重要**：回到后端服务的环境变量，更新 `FRONTEND_URL` 为实际的 Railway 前端域名：

```
FRONTEND_URL=https://studytogether-frontend-xxx.railway.app
```

然后在后端 Console 中重启服务：

```bash
# 或者直接在 Railway UI 中点击 "Restart" 按钮
```

---

## ✅ 步骤 6：验证部署

### 6.1 测试后端 API

访问 `https://your-backend-domain.railway.app/docs`

测试以下端点：

1. **健康检查**
   - `GET /health`
   - 应返回：`{"status": "ok"}`

2. **用户注册**
   - `POST /api/auth/register`
   - Body:
     ```json
     {
       "username": "testuser",
       "email": "test@example.com",
       "password": "password123"
     }
     ```

3. **用户登录**
   - `POST /api/auth/login`
   - Body:
     ```json
     {
       "username": "testuser",
       "password": "password123"
     }
     ```
   - 应返回 access_token

### 6.2 测试前端

访问 `https://your-frontend-domain.railway.app`

检查：
- [ ] 页面正常加载
- [ ] 地图显示正常
- [ ] 能够注册/登录
- [ ] WebSocket 连接成功（检查浏览器控制台）

### 6.3 测试 WebSocket 连接

1. 打开浏览器开发者工具（F12）
2. 切换到 **Network** 标签
3. 选择 **WS**（WebSocket）选项卡
4. 登录后应该能看到 `socket.io` 连接

---

## 🔒 步骤 7：生产环境配置

### 7.1 配置自定义域名（可选）

如果购买了域名，可以为服务配置自定义域名：

1. 在服务页面点击 **Settings** → **Networking**
2. 点击 **Custom Domain**
3. 输入域名（如 `api.studytogether.com`）
4. 按照提示配置 DNS 记录：

```
类型: CNAME
名称: api
值: xxx.railway.app
```

### 7.2 配置环境（推荐）

在 Railway 中创建多个环境：

- **Production**: 生产环境
- **Staging**: 预发布环境
- **Development**: 开发环境

1. 点击项目名称 → **Settings**
2. 在 **Environments** 中添加新环境
3. 每个环境可以有不同的数据库和服务

### 7.3 设置监控

Railway 自动提供：

- **Metrics**: CPU、内存、网络使用情况
- **Logs**: 实时日志流
- **Deployments**: 部署历史

在项目首页可以查看所有服务的状态。

---

## 💰 成本估算

Railway 使用按量计费：

| 服务 | 免费额度 | 超出后价格 |
|------|---------|-----------|
| PostgreSQL | $5 免费额度 | $0.25/GB 存储 + $0.00029/秒运行时间 |
| Backend | $5 免费额度 | $0.00055/秒运行时间 |
| Frontend | $5 免费额度 | $0.00055/秒运行时间 |

**预计月成本**：$15-30（根据流量）

启用计费：
1. 点击用户头像 → **Settings**
2. 在 **Payment Method** 中添加支付方式

---

## 🔄 更新部署

### 自动部署

Railway 默认配置为自动部署。当你推送到 GitHub main 分支时：

1. Railway 自动检测代码变化
2. 重新构建服务
3. 零停机部署

### 手动触发部署

1. 进入服务页面
2. 点击 **Deployments** 标签
3. 点击 **New Deployment**
4. 选择分支和提交
5. 点击 **Deploy**

---

## 🐛 故障排查

### 问题 0：Railpack 构建失败（"Script start.sh not found"）

**症状**：
```
⚠ Script start.sh not found
✖ Railpack could not determine how to build the app
```

**原因**：
Railway 尝试从根目录构建项目，但这是一个 monorepo（包含 backend 和 frontend 两个子目录）。

**解决方案**：
1. 在 Railway 服务配置页面，点击 **⚙️ View Config**
2. 找到 **Root Directory** 字段
3. 根据服务类型输入：
   - Backend 服务：输入 `backend`
   - Frontend 服务：输入 `frontend`
4. 点击 **Save** 或 **Redeploy**

**⚠️ 这是必须的步骤！** 如果不设置 Root Directory，Railway 无法找到正确的构建文件（如 Dockerfile 或 package.json）。

### 问题 1：数据库连接失败

**症状**：后端日志显示 `connection refused`

**解决方案**：
1. 检查 `DATABASE_URL` 格式（必须是 `postgresql+asyncpg://`）
2. 确认数据库服务正在运行
3. 检查网络连接

### 问题 2：CORS 错误

**症状**：前端无法调用后端 API，浏览器控制台显示 CORS 错误

**解决方案**：
1. 确认后端 `FRONTEND_URL` 包含前端域名
2. 检查后端 CORS 配置
3. 确保环境变量正确（无拼写错误）

### 问题 3：WebSocket 连接失败

**症状**：实时位置更新不工作

**解决方案**：
1. 检查后端 Socket.io 配置
2. 确认前端使用正确的后端 URL
3. 检查防火墙规则

### 问题 4：地图不显示

**症状**：页面加载但地图区域空白

**解决方案**：
1. 验证 `NEXT_PUBLIC_AMAP_KEY` 是否正确
2. 检查高德地图控制台的使用配额
3. 查看浏览器控制台错误信息

### 问题 5：构建失败

**症状**：部署时显示 Build Error

**解决方案**：
1. 点击 **View Logs** 查看详细错误
2. 检查 `package.json` 或 `requirements.txt` 依赖
3. 本地运行 `npm run build` 或 `docker build` 复现错误

---

## 📚 Railway 常用命令

### 通过 Railway CLI

```bash
# 安装 Railway CLI
npm install -g railway

# 登录
railway login

# 查看项目状态
railway status

# 查看日志
railway logs

# 打开控制台
railway open

# 查看环境变量
railway variables

# 添加环境变量
railway variables set SECRET_KEY=your_key

# 运行数据库迁移
railway run alembic upgrade head
```

---

## ✨ 部署检查清单

### 部署前
- [x] 代码已推送到 GitHub
- [x] 创建了 `railway.json` 配置文件
- [x] 更新了 `.env.example`
- [ ] 生成了安全的 `SECRET_KEY`
- [ ] 获取了高德地图 API Key

### 部署中
- [ ] PostgreSQL + PostGIS 已启用
- [ ] 后端服务已部署并配置环境变量
- [ ] 运行了数据库迁移（`alembic upgrade head`）
- [ ] 前端服务已部署并配置环境变量
- [ ] 后端 CORS 已配置前端域名

### 部署后
- [ ] 测试了后端 API（/docs 页面）
- [ ] 测试了前端页面加载
- [ ] 测试了用户注册/登录流程
- [ ] 测试了地图功能
- [ ] 测试了 WebSocket 连接
- [ ] 配置了监控和告警（可选）

---

## 🎯 下一步

部署成功后，你可以：

1. **添加数据收集**：使用 Google Analytics 或类似工具
2. **配置 CDN**：Railway 自动通过 Cloudflare 提供全球加速
3. **设置备份**：Railway 自动备份数据库（每天）
4. **优化性能**：监控资源使用情况，按需扩容
5. **添加日志聚合**：使用 Sentry、LogRocket 等工具

---

## 📞 获取帮助

- **Railway 文档**: https://docs.railway.app/
- **Railway Discord**: https://discord.gg/railway
- **Railway GitHub**: https://github.com/railwayapp

---

## 📝 快速参考

### 重要链接

- Railway 控制台: https://railway.app/
- 你的项目: https://railway.app/project/xxx
- 数据库管理: 在项目中点击 PostgreSQL 服务
- 后端日志: https://railway.app/service/xxx/logs
- 前端日志: https://railway.app/service/yyy/logs

### 环境变量速查

```bash
# 后端必需
DATABASE_URL=postgresql+asyncpg://...
SECRET_KEY=your-random-secret-key
FRONTEND_URL=https://your-frontend.railway.app
ENVIRONMENT=production

# 前端必需
NEXT_PUBLIC_BACKEND_URL=https://your-backend.railway.app
NEXT_PUBLIC_AMAP_KEY=your_amap_key
```

---

**祝你部署成功！** 🎉

如有问题，请查看 Railway 文档或提 Issue 到项目仓库。
