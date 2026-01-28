# 招采审计工作台 (Web)

一个面向审计人员的招采审计工作台 Web 应用，支持招标文件解析、资料分拣、关键信息提取、项目台账、审计执行和风险报告生成。

## 技术栈

- **前端框架**: React 18 + TypeScript
- **构建工具**: Vite
- **UI 组件**: shadcn/ui + Radix UI
- **样式**: Tailwind CSS
- **图标**: Lucide React
- **状态管理**: Zustand + React Query
- **路由**: React Router v6

## 功能模块

### 1. 项目列表 (`/projects`)
- 查看所有审计项目
- 项目状态统计（进行中、待确认、风险项）
- 搜索和筛选

### 2. 新建项目 (`/projects/new`)
- 上传招标文件（PDF/Word/图片）
- 自动解析招标文件关键信息
- 左右分栏布局：文件预览 + 字段确认
- 支持字段编辑、状态切换、原文回溯

### 3. 项目工作台 (`/projects/:id`)
- 步骤卡片式导航（非选项卡式）
- 进度统计和待办事项
- 快速跳转到各功能模块

### 4. 资料上传与分拣 (`/projects/:id/files`)
- 批量文件上传（支持拖拽）
- 文件去重检测（SHA256）
- 自动分拣 + 人工修正
- 批量操作（改类型、确认）

### 5. 关键信息库 (`/projects/:id/files/:fileId`)
- 文件预览 + 字段表
- 字段回溯原文
- 单条/批量确认

### 6. 项目台账 (`/projects/:id/ledger`)
- 自动汇总关键信息
- 支持人工补录
- 导出 Excel
- 缺失字段清单

### 7. 审计 (`/projects/:id/audit`)
- 规则选择（按类别筛选）
- 执行审计
- 结果展示（通过/不通过/缺失）
- 证据和法规依据展示

### 8. 风险报告 (`/projects/:id/risks`)
- 风险清单编辑
- 严重程度调整
- 一键生成报告
- 导出 PDF/Word

## 快速开始

### 环境要求

- Node.js >= 18
- npm >= 9 或 pnpm >= 8

### 安装依赖

```bash
npm install
```

### 开发模式

```bash
npm run dev
```

应用将在 http://localhost:3000 启动

### 构建生产版本

```bash
npm run build
```

### 预览生产版本

```bash
npm run preview
```

## 环境变量

创建 `.env.local` 文件：

```env
# API 基础地址（可选，默认使用代理）
VITE_API_BASE_URL=

# 数据中台 API 地址
VITE_DATA_HUB_URL=http://localhost:8080
```

## 项目结构

```
src/
├── components/
│   ├── common/        # 业务组件（DataTable, FilePreview, StatusBadge 等）
│   ├── layout/        # 布局组件
│   └── ui/            # shadcn/ui 基础组件
├── hooks/             # 自定义 Hooks
├── lib/               # 工具函数
├── pages/             # 页面组件
├── services/          # API 服务层
├── stores/            # 状态管理
└── types/             # TypeScript 类型定义
```

## 核心组件

| 组件 | 说明 |
|------|------|
| `DataTable` | 通用数据表格，支持分页、筛选、排序、行选择 |
| `FilePreview` | 文件预览组件，支持翻页、缩放、高亮 |
| `EvidenceLink` | 证据链接，点击跳转到原文位置 |
| `StatusBadge` | 状态徽章，自动匹配颜色 |
| `FieldEditor` | 字段编辑器，支持编辑、状态切换、证据回溯 |
| `StepCards` | 步骤卡片导航，展示进度和待办 |
| `BatchActionBar` | 批量操作栏 |

## API 接口

### App 端接口 (本项目实现)

- `POST /api/app/projects` - 创建项目
- `GET /api/app/projects` - 项目列表
- `GET /api/app/projects/:id` - 项目详情
- `POST /api/app/projects/:id/files` - 绑定文件
- `GET /api/app/projects/:id/files` - 文件列表
- `PUT /api/app/projects/:id/files/:fileId/fields` - 更新字段值
- `POST /api/app/projects/:id/ledger/generate` - 生成台账
- `POST /api/app/projects/:id/audit/run` - 执行审计
- `GET /api/app/projects/:id/risks` - 风险列表
- `POST /api/app/projects/:id/report/generate` - 生成报告

### 数据中台接口 (已有)

- `POST /api/v1/files/upload` - 上传文件
- `GET /api/v1/files/check/:sha256` - 去重检查
- `GET /api/v1/doc-types/all` - 文件类型列表
- `GET /api/v1/doc-field-defs/by-doc-type/:id` - 字段定义
- `GET /api/v1/audit-rules/all` - 审计规则
- `GET /api/v1/law-documents/list` - 法规列表

## 开发规范

1. **UI 组件**: 优先使用 shadcn/ui 语义 token，不足时使用 Tailwind 原子类
2. **禁止使用**: CSS 文件、inline style
3. **图标**: 统一使用 lucide-react
4. **接口调用**: 使用封装的 `appClient` 和 `dataHubClient`，支持缓存和重试
5. **类型**: 所有接口数据必须定义 TypeScript 类型

## 许可证

MIT
