# 招采审计工作台

一个面向审计人员的招采审计 Web 应用，支持招标文件解析、资料分拣、关键信息提取、项目台账、审计执行和风险报告生成。

## 系统架构

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│   前端 (React)  │────►│  后端 (Express) │────►│   MySQL 数据库   │
│   端口: 3000    │     │   端口: 8080    │     │   端口: 3306    │
└─────────────────┘     └─────────────────┘     └─────────────────┘
         │                      │
         │                      │
         ▼                      ▼
┌─────────────────┐     ┌─────────────────┐
│    数据中台      │     │   智能体平台     │
│ (元数据+规则)    │     │  (AI 能力)      │
└─────────────────┘     └─────────────────┘
```

## 技术栈

### 前端
- **框架**: React 18 + TypeScript 5.5
- **构建**: Vite 5
- **UI**: shadcn/ui + Radix UI + Tailwind CSS
- **路由**: React Router v6
- **状态**: Zustand + Context API
- **请求**: Axios
- **导出**: xlsx + file-saver

### 后端
- **运行时**: Node.js 18+
- **框架**: Express 4
- **数据库**: MySQL 8.0
- **驱动**: mysql2

## 功能模块

| 模块 | 路径 | 功能 |
|------|------|------|
| 项目列表 | `/projects` | 查看所有审计项目，状态统计 |
| 新建项目 | `/projects/new` | 上传招标文件，自动解析提取 |
| 字段确认 | `/projects/:id/confirm` | 招标文件字段确认与编辑 |
| 项目工作区 | `/projects/:id` | 项目入口，功能导航 |
| 项目资料 | `/projects/:id/files` | 文件上传、分拣、提取管理 |
| 文件字段 | `/projects/:id/files/:fileId` | 单文件字段详情与编辑 |
| 项目台账 | `/projects/:id/ledger` | 四选项卡展示，支持导出 |
| 审计执行 | `/projects/:id/audit` | 规则选择，执行审计 |
| 风险报告 | `/projects/:id/risks` | 风险汇总，支持导出 |

## 快速开始

### 环境要求

- Node.js >= 18
- MySQL >= 8.0
- Docker (可选，用于运行 MySQL)

### 1. 克隆项目

```bash
git clone <repository-url>
cd AuditAPP
```

### 2. 安装依赖

```bash
# 安装前端依赖
npm install

# 安装后端依赖
cd server && npm install && cd ..
```

### 3. 配置数据库

启动 MySQL（使用 Docker）：

```bash
docker run -d \
  --name audit-mysql \
  -e MYSQL_ROOT_PASSWORD=your_password \
  -e MYSQL_DATABASE=audit_app \
  -p 3306:3306 \
  mysql:8.0
```

初始化数据库表：

```bash
cd server && npm run db:init && cd ..
```

### 4. 配置环境变量

创建 `server/.env` 文件：

```env
# 数据库配置
DB_HOST=localhost
DB_PORT=3306
DB_USER=root
DB_PASSWORD=your_password
DB_DATABASE=audit_app

# 服务端口
PORT=8080
```

创建 `.env.local` 文件（可选）：

```env
# 数据中台地址
VITE_DATA_HUB_URL=http://115.190.44.247

# 智能体环境 (qj/prod)
VITE_AGENT_ENV=qj
```

### 5. 启动服务

```bash
# 启动后端服务（在一个终端）
cd server && npm run dev

# 启动前端服务（在另一个终端）
npm run dev
```

访问 http://localhost:3000

## 项目结构

```
AuditAPP/
├── src/                      # 前端源码
│   ├── components/           # 组件
│   │   ├── common/           # 业务组件
│   │   ├── layout/           # 布局组件
│   │   └── ui/               # UI 基础组件
│   ├── contexts/             # React Context
│   │   ├── TaskContext.tsx   # 后台任务管理
│   │   └── AuditContext.tsx  # 审计会话管理
│   ├── hooks/                # 自定义 Hooks
│   ├── lib/                  # 工具函数
│   ├── pages/                # 页面组件
│   ├── services/             # API 服务层
│   ├── types/                # TypeScript 类型
│   └── utils/                # 工具函数
│       └── exportUtils.ts    # 导出功能
├── server/                   # 后端源码
│   └── src/
│       ├── config/           # 配置
│       ├── db/               # 数据库
│       │   └── init.js       # 建表脚本
│       └── routes/           # API 路由
│           └── projects.js   # 项目相关 API
├── ARCHITECTURE.md           # 架构设计文档
└── README.md                 # 本文件
```

## 数据库表

| 表名 | 说明 |
|------|------|
| projects | 项目表 |
| project_files | 项目文件表 |
| file_fields | 文件字段值表 |
| audit_risks | 审计风险表 |
| audit_rules | 审计规则表（同步自数据中台） |

## API 接口

### 项目管理
- `GET /api/app/projects` - 项目列表
- `POST /api/app/projects` - 创建项目
- `GET /api/app/projects/:id` - 项目详情
- `PUT /api/app/projects/:id` - 更新项目
- `DELETE /api/app/projects/:id` - 删除项目

### 文件管理
- `GET /api/app/projects/:id/files` - 文件列表
- `POST /api/app/projects/:id/files` - 添加文件
- `PUT /api/app/projects/:id/files/:fileId` - 更新文件
- `DELETE /api/app/projects/:id/files/:fileId` - 删除文件

### 字段管理
- `GET /api/app/projects/:id/files/:fileId/fields` - 获取字段
- `PUT /api/app/projects/:id/files/:fileId/fields` - 批量更新字段
- `GET /api/app/projects/:id/all-fields` - 获取所有字段

### 风险管理
- `GET /api/app/projects/:id/risks` - 风险列表
- `POST /api/app/projects/:id/risks` - 添加风险
- `PUT /api/app/projects/:id/risks/:riskId` - 更新风险
- `DELETE /api/app/projects/:id/risks/:riskId` - 删除风险

## 核心功能说明

### 文件处理流程

```
上传文件 → AI分拣(识别类型) → 用户确认类型 → 自动提取字段 → 用户确认字段
```

### 审计执行流程

```
选择审计规则 → 加载字段数据 → 调用审计Agent → 展示结果 → 确认并保存风险
```

### 导出功能

- **项目台账**: 导出为 Excel，包含四个工作表（项目基本信息、招标关键信息、中标关键信息、投标人关键信息）
- **风险报告**: 导出为 Excel，包含风险统计和详情列表

## 开发指南

### 代码规范

1. 使用 TypeScript 严格模式
2. 组件使用函数式组件 + Hooks
3. 样式使用 Tailwind CSS
4. 图标使用 lucide-react
5. API 调用使用封装的 service 层

### 添加新页面

1. 在 `src/pages/` 创建页面组件
2. 在 `src/pages/index.ts` 导出
3. 在 `src/App.tsx` 添加路由

### 添加新 API

1. 在 `server/src/routes/` 添加路由处理
2. 在 `src/services/` 添加前端调用方法

## 构建部署

### 构建前端

```bash
npm run build
```

构建产物在 `dist/` 目录

### 构建后端

后端无需构建，直接运行 Node.js

### 生产部署

1. 配置生产环境变量
2. 启动 MySQL 数据库
3. 启动后端服务: `cd server && npm start`
4. 部署前端静态文件到 Web 服务器

## 许可证

MIT
