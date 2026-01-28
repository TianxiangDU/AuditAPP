# 招采审计 Web 端（Cursor 开发文档）
**版本：0.1**  
**目标：用 Cursor + Figma MCP + shadcn/ui + Tailwind 实现“可用的招采审计工作台（Web）”，并对接数据中台接口。**

---

## 1. 开发原则与技术栈（强约束）

### 1.1 技术栈
- 前端：React + TypeScript（按仓库现状选择 Vite 或 Next.js）
- UI：**shadcn/ui**（优先） + **Tailwind CSS**
- 图标：**lucide-react**
- 后端：保持现有数据中台不变；App 端（项目过程数据）由本项目实现 REST API

### 1.2 样式与组件规则（必须执行）
1) **优先使用 shadcn 的语义 token**完成视觉还原。  
2) 语义 token 不足时再用 Tailwind 原子类补充。  
3) **禁止使用任何 CSS 文件/inline style**。  
4) 页面只做编排；复杂逻辑下沉到 hooks/services/components。

### 1.3 可维护性与稳定性
- 所有列表页：统一分页/过滤/排序/错误提示/空态/加载态
- 关键动作：可重试、不中断、状态可恢复
- 对数据中台接口：统一 client + 缓存 + 失败重试 + traceId 展示

---

## 2. Figma MCP（用于 Cursor 生成 1:1 设计稿）

### 2.1 目标
在 Cursor 中直接读取 Figma Frame/组件信息，生成贴近 1:1 的页面骨架，并强制使用 shadcn 组件映射。

### 2.2 配置方式（推荐官方安装）
- 在 Cursor 内安装并连接 Figma MCP Server（交互式授权方式）
- 连接后即可在对话中使用 MCP 工具读取 Figma 文件信息  
（以 Cursor 与 Figma 的官方指引为准）

### 2.3 使用约定（提示词流程）
1) 读取目标 Frame → 输出组件树（shadcn 组件映射表）  
2) 生成页面骨架（无业务逻辑）  
3) 逐步补齐：接口/状态机/错误处理/空态/加载态  

---

## 3. 系统边界与总体架构

### 3.1 数据边界（必须清晰）
- **数据中台（已存在）**：doc-types、doc-field-defs、audit-rules、law-documents/law-clauses、files  
- **App 端（本项目）**：项目过程数据（项目/文件/KV/台账/风险/证据）

### 3.2 App 端数据模型（建议）
- project  
- project_file  
- file_field_value（通用 KV）  
- project_ledger  
- audit_risk  
- （可选）file_extraction / audit_run

---

## 4. 页面清单与路由（Web）
- `/projects` 项目列表
- `/projects/new` 新建项目（上传招标文件解析确认）
- `/projects/:id` 项目工作台（步骤卡片，不用 Tab）
- `/projects/:id/files` 资料上传与分拣
- `/projects/:id/files/:fileId` 文件关键信息（左预览/右字段）
- `/projects/:id/ledger` 项目台账
- `/projects/:id/audit` 审计
- `/projects/:id/risks` 风险与报告

---

## 5. 核心可复用组件（必须抽象）
1) `DataTable`（分页/筛选/行操作/空态/加载态统一）
2) `FilePreview`（调用中台 preview）
3) `EvidenceLink`（字段回溯原文：跳页/高亮）
4) `StatusBadge`（auto/pending/confirmed/missing）
5) `BatchActionBar`（批量改类型/确认）
6) `FieldEditor`（字段输入：Input/Textarea/Select + 证据 + 状态）
7) `StepCards`（项目步骤导航：进度/待办/CTA）

---

## 6. 招标文件解析确认页（关键页面细则）

### 6.1 布局
- `ResizablePanelGroup`：左预览 / 右字段确认
- 右侧字段分组 `Accordion`

### 6.2 字段清单（固定）
- 项目名称（确认后写入 project.projectName）
- 服务范围/建设规模
- 开标时间
- 服务期限
- 投标截止时间
- 投标人资格条件-投标人资质能力
- 投标人资格条件-项目负责人资质能力
- 投标人资格条件-类似业绩类似项目
- 评标委员会组成
- 联合体投标
- 合同价格形式
- 招标方式
- 资格审查方式
- 评标方法
- 投标保证金
- 履约保证金金额百分比
- 招标文件获取时间
- 最高投标限价
- 招标人书面澄清的时间
- 废标条款
- 评标标准
- 是否有特定标准描述

### 6.3 交互
- 字段项：值可编辑；状态可切换；必须支持“查看原文证据”
- “确认无误并创建项目”：
  - 创建 project
  - 绑定 tenderFile（project_file）
  - 写入该文件的 KV（file_field_value，状态=confirmed）

---

## 7. App 端接口（本项目需要实现，供前端调用）

### 7.1 Projects
- POST `/api/app/projects` 创建项目（入参：tenderFileAssetId + confirmedTenderFields）
- GET `/api/app/projects` 列表
- GET `/api/app/projects/{id}` 详情

### 7.2 Project Files
- POST `/api/app/projects/{id}/files` 绑定 fileAssetId（或由后端代传上传）
- GET `/api/app/projects/{id}/files` 队列
- PUT `/api/app/projects/{id}/files/{fileId}` 更新 docTypeCode/status

### 7.3 Field Values（KV）
- GET `/api/app/projects/{id}/files/{fileId}/fields`
- PUT `/api/app/projects/{id}/files/{fileId}/fields` 批量 upsert + confirm

### 7.4 Ledger
- POST `/api/app/projects/{id}/ledger/generate`
- GET `/api/app/projects/{id}/ledger`
- PUT `/api/app/projects/{id}/ledger`
- GET `/api/app/projects/{id}/ledger/export.xlsx`

### 7.5 Audit & Risks
- POST `/api/app/projects/{id}/audit/run`
- GET `/api/app/projects/{id}/risks`
- PUT `/api/app/projects/{id}/risks/{riskId}`
- POST `/api/app/projects/{id}/report/generate`
- GET `/api/app/projects/{id}/report/download`

---

## 8. 数据中台接口（按你提供的 OpenAPI 对接）
> 统一封装 `dataHubClient`，支持缓存与失败重试。

### 8.1 文件资产（中台）
- POST `/api/v1/files/upload`
- GET `/api/v1/files/check/{sha256}`
- GET `/api/v1/files/{id}/preview`
- GET `/api/v1/files/{id}/download`
- GET `/api/v1/files/{id}/info`

### 8.2 文件类型与字段（中台）
- GET `/api/v1/doc-types/all`
- GET `/api/v1/doc-types/list`
- GET `/api/v1/doc-types/full/{idOrCode}`
- GET `/api/v1/doc-field-defs/by-doc-type/{docTypeId}`

### 8.3 审计规则与关联（中台）
- GET `/api/v1/audit-rules/list`
- GET `/api/v1/audit-rules/all`
- GET `/api/v1/audit-rule-field-links/by-rule/{ruleId}`
- GET `/api/v1/audit-rule-law-links/by-rule/{ruleId}`

### 8.4 法规与条款（中台）
- GET `/api/v1/law-documents/list`
- GET `/api/v1/law-clauses/by-law/{lawDocumentId}`

---

## 9. 缓存与性能（必须做）
- doc-types/full 按 docTypeCode 缓存（内存 + localStorage 任选其一）
- 字段定义只拉一次，避免多页重复请求
- 文件队列/字段表：分页或虚拟滚动
- 所有接口统一超时、重试、错误提示（带 traceId）

---

## 10. Cursor 总提示词（建议保存为 `PROMPT.md`）
你是 Cursor 开发代理，请在本仓库实现“招采审计 Web 应用（v0.1）”：
1) UI 仅用 shadcn/ui + Tailwind；优先语义 token；不满足再用 Tailwind；禁止 CSS。  
2) lucide-react 统一图标。  
3) 路由与页面严格按第 4 章；用“步骤卡片”而不是 Tab。  
4) App 端采用通用 KV（file_field_value）存关键信息。  
5) 对接数据中台接口（第 8 章），封装 dataHubClient，带缓存与重试。  
6) 招标文件解析确认页：左预览右字段（ResizablePanelGroup + Accordion），字段必须可回溯原文证据。  
7) 实现可用闭环：创建项目→上传资料→分拣→字段确认→台账→审计→风险→报告导出。  
8) 通用组件必须抽象：DataTable/FilePreview/EvidenceLink/StatusBadge/BatchActionBar。  
9) 输出可运行的 README（环境变量、启动方式、接口联调说明）。
