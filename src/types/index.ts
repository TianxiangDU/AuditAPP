// =============== 项目相关类型 ===============
export interface Project {
  id: string
  projectName: string
  tenderFileId: string
  tenderDsId?: number
  tenderFileUrl?: string  // 文件预览 URL
  status: ProjectStatus
  pendingCount: number
  riskCount: number
  createdAt: string
  updatedAt: string
}

export type ProjectStatus = 'draft' | 'parsing' | 'confirming' | 'auditing' | 'completed'

// =============== 项目文件相关类型 ===============
export interface ProjectFile {
  id: string
  projectId: string
  fileAssetId: string
  fileName: string
  fileSize: number
  mimeType: string
  sha256: string
  docTypeCode: string | null
  docTypeName: string | null
  status: FileStatus
  extractionStatus: ExtractionStatus
  createdAt: string
  updatedAt: string
}

export type FileStatus = 'pending' | 'classified' | 'confirmed'
export type ExtractionStatus = 'pending' | 'processing' | 'completed' | 'failed'

// =============== 字段值（通用 KV）相关类型 ===============
export interface FileFieldValue {
  id: string
  projectId: string
  projectFileId: string
  docTypeCode: string
  fieldCode: string
  fieldName: string
  value: string | null
  status: FieldStatus
  evidenceRef: EvidenceRef | null
  updatedAt: string
}

export type FieldStatus = 'auto' | 'pending' | 'confirmed' | 'missing'

export interface EvidenceRef {
  page?: number
  snippet?: string
  bbox?: {
    x: number
    y: number
    width: number
    height: number
  }
  anchor?: string
}

// =============== 项目台账相关类型 ===============
export interface ProjectLedger {
  id: string
  projectId: string
  projectName: string
  tenderCompanyName: string | null
  tenderContactPhone: string | null
  tenderMethod: string | null
  agencyName: string | null
  agencyContact: string | null
  maxBidPrice: string | null
  bidderCompanyName: string | null
  bidAmount: string | null
  bidderContact: string | null
  bidderContactPhone: string | null
  isWinningBid: boolean | null
  createdAt: string
  updatedAt: string
}

export interface LedgerFieldInfo {
  fieldName: string
  value: string | null
  source: 'auto' | 'manual'
  sourceFile?: string
  sourceField?: string
  evidenceRef?: EvidenceRef
}

// =============== 审计风险相关类型 ===============
export interface AuditRisk {
  id: string
  projectId: string
  ruleId: string
  ruleName: string
  ruleCode: string
  category: string
  result: AuditResult
  severity: RiskSeverity
  description: string
  suggestion: string
  usedFields: UsedField[]
  lawReferences: LawReference[]
  evidenceRefs: EvidenceRef[]
  createdAt: string
  updatedAt: string
}

export type AuditResult = 'pass' | 'fail' | 'missing' | 'review'
export type RiskSeverity = 'low' | 'medium' | 'high' | 'critical'

export interface UsedField {
  fieldCode: string
  fieldName: string
  value: string | null
  sourceFile: string
}

export interface LawReference {
  lawDocumentId: string
  lawDocumentName: string
  clauseId: string
  clauseNumber: string
  clauseContent: string
}

// =============== 数据中台相关类型 ===============
export interface DocType {
  id: string
  code: string
  name: string
  description: string
  category: string
  isEnabled: boolean
  fieldCount: number
}

// 数据中台返回的字段定义（实际 API 格式）
export interface DocFieldDef {
  id: string
  docTypeId?: string          // 所属文件类型ID
  fieldCode: string           // 字段编码，如 ZTZA790000001-001
  fieldName: string           // 字段名称
  fieldCategory: string       // 字段类别：文字、日期、数量、金额、枚举
  requiredFlag: 0 | 1         // 是否必填：0-否，1-是
  valueSource: string | null  // 取值方式
  enumOptions: string | null  // 枚举值（JSON字符串）
  exampleValue: string | null // 示例数据
  fieldDescription: string | null // 字段说明
  anchorWord: string | null   // 定位词
  outputFormat: string | null // 输出格式
  extractMethod: string | null // 提取方法
  status?: number             // 状态
  rowVersion?: number         // 数据版本号
  createdAt?: string          // 创建时间
  updatedAt?: string          // 更新时间
  // 以下为兼容旧代码的别名
  code?: string
  name?: string
  description?: string
  dataType?: 'string' | 'number' | 'date' | 'boolean' | 'array'
  isRequired?: boolean
  sortOrder?: number
  groupName?: string
}

export interface AuditRule {
  id: string
  code: string
  name: string
  description: string
  category: string
  stage: string
  isEnabled: boolean
  expression: string
}

export interface LawDocument {
  id: string
  name: string
  code: string
  issueDate: string
  effectiveDate: string
  isEffective: boolean
}

export interface LawClause {
  id: string
  lawDocumentId: string
  clauseNumber: string
  content: string
  keywords: string[]
}

// =============== 文件资产相关类型 ===============
export interface FileAsset {
  id: string
  fileName: string
  fileSize: number
  mimeType: string
  sha256: string
  previewUrl: string
  downloadUrl: string
  createdAt: string
}

// =============== API 响应类型 ===============
export interface ApiResponse<T> {
  code: number
  message: string
  data: T
  traceId: string
}

export interface PaginatedResponse<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  totalPages: number
}

// =============== 数据中台配置 ===============
export const DATA_HUB_CONFIG = {
  // 招标文件类型编码
  TENDER_DOC_TYPE_CODE: 'ZTZA790000001',
}

// =============== 字段定义扩展（用于提取）===============
export interface ExtractFieldDef {
  id: string
  fieldCode: string           // 字段编码
  fieldName: string           // 字段名称
  fieldCategory: string       // 字段类别：文字、日期、数量、金额、枚举
  requiredFlag: 0 | 1         // 是否必填
  valueSource: string | null  // 取值方式
  enumOptions: string | null  // 枚举值
  exampleValue: string | null // 示例数据
  fieldDescription: string | null // 字段说明
  anchorWord: string | null   // 定位词
  outputFormat: string | null // 输出格式
  extractMethod: string | null // 提取方法
  // 兼容字段
  code?: string
  name?: string
  groupName?: string
}

// =============== 招标文件解析字段（备用，从数据中台获取失败时使用）===============
export const TENDER_FIELD_DEFINITIONS_FALLBACK = [
  { code: 'projectName', name: '项目名称', group: '基本信息', required: true },
  { code: 'serviceScope', name: '服务范围/建设规模', group: '基本信息', required: false },
  { code: 'bidOpeningTime', name: '开标时间', group: '时间要求', required: false },
  { code: 'servicePeriod', name: '服务期限', group: '时间要求', required: false },
  { code: 'bidDeadline', name: '投标截止时间', group: '时间要求', required: false },
  { code: 'bidderQualification', name: '投标人资格条件-投标人资质能力', group: '资格条件', required: false },
  { code: 'pmQualification', name: '投标人资格条件-项目负责人资质能力', group: '资格条件', required: false },
  { code: 'similarProjects', name: '投标人资格条件-类似业绩类似项目', group: '资格条件', required: false },
  { code: 'evaluationCommittee', name: '评标委员会组成', group: '评标信息', required: false },
  { code: 'consortiumBid', name: '联合体投标', group: '投标要求', required: false },
  { code: 'contractPriceForm', name: '合同价格形式', group: '合同信息', required: false },
  { code: 'tenderMethod', name: '招标方式', group: '招标信息', required: false },
  { code: 'qualificationReviewMethod', name: '资格审查方式', group: '招标信息', required: false },
  { code: 'evaluationMethod', name: '评标方法', group: '评标信息', required: false },
  { code: 'bidBond', name: '投标保证金', group: '保证金', required: false },
  { code: 'performanceBondRate', name: '履约保证金金额百分比', group: '保证金', required: false },
  { code: 'documentObtainTime', name: '招标文件获取时间', group: '时间要求', required: false },
  { code: 'maxBidPrice', name: '最高投标限价', group: '价格信息', required: false },
  { code: 'clarificationTime', name: '招标人书面澄清的时间', group: '时间要求', required: false },
  { code: 'rejectionClauses', name: '废标条款', group: '评标信息', required: false },
  { code: 'evaluationCriteria', name: '评标标准', group: '评标信息', required: false },
  { code: 'hasSpecificCriteria', name: '是否有特定标准描述', group: '评标信息', required: false },
] as const

export type TenderFieldCode = typeof TENDER_FIELD_DEFINITIONS_FALLBACK[number]['code']

// =============== 台账字段定义（固定）===============
export const LEDGER_FIELD_DEFINITIONS = [
  { code: 'projectName', name: '项目名称' },
  { code: 'tenderCompanyName', name: '招标人公司名称' },
  { code: 'tenderContactPhone', name: '招标人联系电话' },
  { code: 'tenderMethod', name: '招标方式' },
  { code: 'agencyName', name: '招标代理机构名称' },
  { code: 'agencyContact', name: '招标代理机构联系人' },
  { code: 'maxBidPrice', name: '最高投标限价' },
  { code: 'bidderCompanyName', name: '投标人公司名称' },
  { code: 'bidAmount', name: '投标金额' },
  { code: 'bidderContact', name: '投标人联系人' },
  { code: 'bidderContactPhone', name: '投标人联系电话' },
  { code: 'isWinningBid', name: '是否中标' },
] as const
