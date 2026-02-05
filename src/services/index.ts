// App 端 API 客户端
export { appClient, dataHubClient, cachedGet, clearCache } from './apiClient'

// 数据中台服务
export { fileService, docTypeService, fieldDefService, fieldDefService as docFieldDefService, auditRuleService as dataHubAuditRuleService, lawService, tenderService } from './dataHubService'

// 项目相关服务
export { projectService, projectFileService, fieldValueService, fieldValueService as fileFieldService, ledgerService, auditService, auditRuleService } from './projectService'
export type { AuditRuleData } from './projectService'

// 智能体配置
export { getConfig, getBearerToken, getAccountToken, getAgentToken, CURRENT_ENV } from './agentConfig'
export type { Environment } from './agentConfig'

// 智能体客户端
export { agentClient, agentFileService, agentKbService, agentChatService } from './agentClient'
export type {
  AgentChatRequest,
  AgentChatResponse,
  AgentChoice,
  FileUploadResponse,
  KbCreateResponse,
  KbQueryResponse,
  KbDataset,
} from './agentClient'

// 提取服务
export { extractService } from './extractService'
export type { ExtractFieldRequest, ExtractFieldResult, BatchExtractRequest } from './extractService'

// 分拣服务
export { classifyService } from './classifyService'
export type { FileClassifyResult, FileIndexResult } from './classifyService'

// 审计智能体服务
export { auditAgentService } from './auditAgentService'
export type { AuditRequest, AuditAgentResult, AuditClue, AuditItem } from './auditAgentService'
