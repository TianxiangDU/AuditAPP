import { appClient } from './apiClient'
import type {
  Project,
  ProjectFile,
  FileFieldValue,
  AuditRisk,
  FieldStatus,
  EvidenceRef,
} from '@/types'

// 后端响应格式
interface AppResponse<T> {
  code: number
  data: T
  message?: string
}

// =============== 项目相关 ===============
export const projectService = {
  // 创建项目
  async create(data: {
    name: string
    tenderFileId?: string | null
    tenderDsId?: number | null
    fields?: Array<{
      fieldCode: string
      fieldName: string
      value: string | null
      status: FieldStatus
      groupName?: string
      evidenceRef?: EvidenceRef | null
    }>
  }): Promise<{ id: string; name: string }> {
    const response = await appClient.post<AppResponse<{ id: string; name: string }>>(
      '/projects',
      data
    )
    return response.data.data
  },

  // 获取项目列表
  async getList(): Promise<Project[]> {
    const response = await appClient.get<AppResponse<Project[]>>('/projects')
    return response.data.data
  },

  // 获取项目详情
  async getById(id: string): Promise<Project> {
    const response = await appClient.get<AppResponse<Project>>(`/projects/${id}`)
    return response.data.data
  },

  // 更新项目
  async update(id: string, data: Partial<Project>): Promise<void> {
    await appClient.put(`/projects/${id}`, data)
  },

  // 删除项目
  async delete(id: string): Promise<void> {
    await appClient.delete(`/projects/${id}`)
  },

  // 获取项目字段
  async getFields(projectId: string): Promise<Array<{
    fieldCode: string
    fieldName: string
    value: string | null
    status: FieldStatus
    groupName?: string
    evidenceRef?: EvidenceRef | null
  }>> {
    const response = await appClient.get<AppResponse<Array<{
      fieldCode: string
      fieldName: string
      value: string | null
      status: FieldStatus
      groupName?: string
      evidenceRef?: EvidenceRef | null
    }>>>(`/projects/${projectId}/fields`)
    return response.data.data
  },

  // 更新项目字段
  async updateField(projectId: string, fieldCode: string, data: {
    value?: string | null
    status?: FieldStatus
    fieldName?: string
    groupName?: string
  }): Promise<void> {
    await appClient.put(`/projects/${projectId}/fields/${fieldCode}`, data)
  },
}

// =============== 项目文件相关 ===============
export const projectFileService = {
  // 获取项目文件列表
  async getList(projectId: string): Promise<ProjectFile[]> {
    const response = await appClient.get<AppResponse<ProjectFile[]>>(
      `/projects/${projectId}/files`
    )
    return response.data.data
  },

  // 添加文件
  async add(projectId: string, data: {
    fileName: string
    fileSize: number
    mimeType: string
    fileId: string
    dsId: number
    docTypeCode?: string | null
    docTypeName?: string | null
    isTender?: boolean
    status?: string
  }): Promise<{ id: string }> {
    const response = await appClient.post<AppResponse<{ id: string }>>(
      `/projects/${projectId}/files`,
      data
    )
    return response.data.data
  },

  // 更新文件信息
  async update(projectId: string, fileId: string, data: {
    docTypeCode?: string | null
    docTypeName?: string | null
    status?: string
    extractionStatus?: string
  }): Promise<void> {
    await appClient.put(`/projects/${projectId}/files/${fileId}`, data)
  },

  // 删除文件
  async delete(projectId: string, fileId: string): Promise<void> {
    await appClient.delete(`/projects/${projectId}/files/${fileId}`)
  },
}

// =============== 字段值相关（KV）===============

// 项目所有字段的类型（包含文件信息）
export interface ProjectFieldWithFile {
  fileId: string
  fileName: string
  docTypeName: string
  isTender: boolean
  fieldCode: string
  fieldName: string
  value: string | null
  status: FieldStatus
  groupName?: string
  evidenceRef?: EvidenceRef | null
}

export const fieldValueService = {
  // 获取文件的字段值
  async getByFile(projectId: string, fileId: string): Promise<FileFieldValue[]> {
    const response = await appClient.get<AppResponse<FileFieldValue[]>>(
      `/projects/${projectId}/files/${fileId}/fields`
    )
    return response.data.data
  },

  // 获取项目所有文件的所有字段（用于审计和台账）
  async getAllFields(projectId: string): Promise<ProjectFieldWithFile[]> {
    const response = await appClient.get<AppResponse<ProjectFieldWithFile[]>>(
      `/projects/${projectId}/all-fields`
    )
    return response.data.data
  },

  // 批量更新字段值
  async batchUpdate(
    projectId: string,
    fileId: string,
    fields: Array<{
      fieldCode: string
      fieldName?: string
      value?: string | null
      status?: FieldStatus
      groupName?: string
      evidenceRef?: EvidenceRef | null
    }>
  ): Promise<void> {
    await appClient.put(
      `/projects/${projectId}/files/${fileId}/fields`,
      { fields }
    )
  },
}

// =============== 台账相关 ===============
export const ledgerService = {
  // TODO: 实现台账相关接口
}

// =============== 审计与风险相关 ===============
export const auditService = {
  // 获取风险列表
  async getRisks(projectId: string): Promise<AuditRisk[]> {
    const response = await appClient.get<AppResponse<AuditRisk[]>>(
      `/projects/${projectId}/risks`
    )
    return response.data.data
  },

  // 添加风险
  async addRisk(projectId: string, data: {
    ruleCode?: string
    ruleName?: string
    riskLevel: string
    description: string
    suggestion?: string
    evidence?: unknown
  }): Promise<{ id: number }> {
    const response = await appClient.post<AppResponse<{ id: number }>>(
      `/projects/${projectId}/risks`,
      data
    )
    return response.data.data
  },

  // 更新风险状态
  async updateRisk(projectId: string, riskId: string, data: {
    status?: string
    description?: string
    suggestion?: string
  }): Promise<void> {
    await appClient.put(`/projects/${projectId}/risks/${riskId}`, data)
  },
}

// =============== 审计规则相关 ===============
export interface AuditRuleData {
  id: number
  sourceId: string      // 数据中台的规则ID
  code: string
  name: string
  description?: string
  category?: string
  stage?: string
  isEnabled?: boolean
  syncedAt?: string     // 同步时间
  createdAt?: string
}

export const auditRuleService = {
  // 获取本地规则列表
  async getList(): Promise<AuditRuleData[]> {
    const response = await appClient.get<AppResponse<AuditRuleData[]>>('/audit-rules')
    return response.data.data
  },

  // 从数据中台同步规则
  async syncFromDataHub(): Promise<{ synced: number; total: number }> {
    const response = await appClient.post<AppResponse<{ synced: number; total: number }>>(
      '/audit-rules/sync'
    )
    return response.data.data
  },

  // 创建规则
  async create(data: {
    code: string
    name: string
    description?: string
    category?: string
    stage?: string
    isEnabled?: boolean
  }): Promise<{ id: number }> {
    const response = await appClient.post<AppResponse<{ id: number }>>('/audit-rules', data)
    return response.data.data
  },

  // 更新规则
  async update(id: number, data: Partial<{
    code: string
    name: string
    description: string
    category: string
    stage: string
    isEnabled: boolean
  }>): Promise<void> {
    await appClient.put(`/audit-rules/${id}`, data)
  },

  // 删除规则
  async delete(id: number): Promise<void> {
    await appClient.delete(`/audit-rules/${id}`)
  },

  // 清空所有规则
  async clearAll(): Promise<void> {
    await appClient.delete('/audit-rules/all')
  },
}
