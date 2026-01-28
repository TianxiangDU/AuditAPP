import { dataHubClient, cachedGet } from './apiClient'
import type {
  DocType,
  DocFieldDef,
  AuditRule,
  LawDocument,
  LawClause,
  FileAsset,
  ApiResponse,
  PaginatedResponse,
} from '@/types'

// =============== 文件资产相关 ===============
export const fileService = {
  // 上传文件
  async upload(file: File): Promise<FileAsset> {
    const formData = new FormData()
    formData.append('file', file)
    const response = await dataHubClient.post<ApiResponse<FileAsset>>(
      '/files/upload',
      formData,
      {
        headers: { 'Content-Type': 'multipart/form-data' },
      }
    )
    return response.data.data
  },

  // 检查文件是否存在（去重）
  async checkDuplicate(sha256: string): Promise<FileAsset | null> {
    try {
      const response = await dataHubClient.get<ApiResponse<FileAsset>>(
        `/files/check/${sha256}`
      )
      return response.data.data
    } catch {
      return null
    }
  },

  // 获取文件信息
  async getInfo(fileId: string): Promise<FileAsset> {
    const response = await dataHubClient.get<ApiResponse<FileAsset>>(
      `/files/${fileId}/info`
    )
    return response.data.data
  },

  // 获取预览 URL
  getPreviewUrl(fileId: string, page?: number): string {
    return `/api/v1/files/${fileId}/preview${page ? `?page=${page}` : ''}`
  },

  // 获取下载 URL
  getDownloadUrl(fileId: string): string {
    return `/api/v1/files/${fileId}/download`
  },
}

// =============== 文件类型相关 ===============
export const docTypeService = {
  // 获取所有启用的文件类型
  async getAll(): Promise<DocType[]> {
    return cachedGet<DocType[]>(dataHubClient, '/doc-types/all', 'doc-types-all')
  },

  // 获取文件类型列表（分页）
  async getList(params?: {
    page?: number
    pageSize?: number
    category?: string
  }): Promise<PaginatedResponse<DocType>> {
    const response = await dataHubClient.get<ApiResponse<PaginatedResponse<DocType>>>(
      '/doc-types/list',
      { params }
    )
    return response.data.data
  },

  // 获取文件类型完整信息（含字段）
  async getFull(idOrCode: string): Promise<DocType & { fields: DocFieldDef[] }> {
    return cachedGet<DocType & { fields: DocFieldDef[] }>(
      dataHubClient,
      `/doc-types/full/${idOrCode}`,
      `doc-type-full-${idOrCode}`
    )
  },

  // 获取筛选选项
  async getFilterOptions(): Promise<{ categories: string[] }> {
    return cachedGet<{ categories: string[] }>(
      dataHubClient,
      '/doc-types/filter-options',
      'doc-types-filter-options'
    )
  },
}

// =============== 字段定义相关 ===============
export const fieldDefService = {
  // 获取字段列表
  async getList(params?: {
    page?: number
    pageSize?: number
    docTypeId?: string
  }): Promise<PaginatedResponse<DocFieldDef>> {
    const response = await dataHubClient.get<ApiResponse<PaginatedResponse<DocFieldDef>>>(
      '/doc-field-defs/list',
      { params }
    )
    return response.data.data
  },

  // 按文件类型获取字段
  async getByDocType(docTypeId: string): Promise<DocFieldDef[]> {
    return cachedGet<DocFieldDef[]>(
      dataHubClient,
      `/doc-field-defs/by-doc-type/${docTypeId}`,
      `field-defs-${docTypeId}`
    )
  },
}

// =============== 审计规则相关 ===============
export const auditRuleService = {
  // 获取规则列表
  async getList(params?: {
    page?: number
    pageSize?: number
    category?: string
    stage?: string
  }): Promise<PaginatedResponse<AuditRule>> {
    const response = await dataHubClient.get<ApiResponse<PaginatedResponse<AuditRule>>>(
      '/audit-rules/list',
      { params }
    )
    return response.data.data
  },

  // 获取所有启用的规则
  async getAll(): Promise<AuditRule[]> {
    return cachedGet<AuditRule[]>(
      dataHubClient,
      '/audit-rules/all',
      'audit-rules-all'
    )
  },

  // 获取规则关联的字段
  async getFieldLinks(ruleId: string): Promise<
    Array<{ fieldCode: string; fieldName: string; docTypeCode: string }>
  > {
    const response = await dataHubClient.get<
      ApiResponse<Array<{ fieldCode: string; fieldName: string; docTypeCode: string }>>
    >(`/audit-rule-field-links/by-rule/${ruleId}`)
    return response.data.data
  },

  // 获取规则关联的法规
  async getLawLinks(ruleId: string): Promise<
    Array<{ lawDocumentId: string; lawClauseId: string }>
  > {
    const response = await dataHubClient.get<
      ApiResponse<Array<{ lawDocumentId: string; lawClauseId: string }>>
    >(`/audit-rule-law-links/by-rule/${ruleId}`)
    return response.data.data
  },
}

// =============== 法规相关 ===============
export const lawService = {
  // 获取法规列表
  async getList(params?: {
    page?: number
    pageSize?: number
    keyword?: string
  }): Promise<PaginatedResponse<LawDocument>> {
    const response = await dataHubClient.get<ApiResponse<PaginatedResponse<LawDocument>>>(
      '/law-documents/list',
      { params }
    )
    return response.data.data
  },

  // 获取法规条款
  async getClauses(lawDocumentId: string): Promise<LawClause[]> {
    return cachedGet<LawClause[]>(
      dataHubClient,
      `/law-clauses/by-law/${lawDocumentId}`,
      `law-clauses-${lawDocumentId}`
    )
  },
}
