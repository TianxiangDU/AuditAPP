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
  ExtractFieldDef,
} from '@/types'
import { DATA_HUB_CONFIG } from '@/types'

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

// =============== 招标文件相关（专用） ===============

// 数据中台返回的完整信息结构
interface DocTypeFullResponse {
  docType: DocType
  fields: DocFieldDef[]
  templates: unknown[]
}

export const tenderService = {
  /**
   * 获取招标文件的字段定义
   * 从数据中台获取 ZTZA790000001 类型的字段列表
   */
  async getFieldDefinitions(): Promise<ExtractFieldDef[]> {
    const docTypeCode = DATA_HUB_CONFIG.TENDER_DOC_TYPE_CODE
    
    try {
      // 获取文件类型详情（含字段）
      const response = await dataHubClient.get<{ data: DocTypeFullResponse; meta: unknown }>(
        `/doc-types/full/${docTypeCode}`
      )
      
      // 调试：打印完整的 API 原始响应
      console.log('========== 数据中台 API 原始响应 ==========')
      console.log('完整响应:', JSON.stringify(response.data, null, 2).substring(0, 2000) + '...')
      console.log('============================================')
      
      const { fields } = response.data.data
      
      // 调试：打印原始数据（使用 any 绕过类型检查，查看实际返回的所有字段）
      console.log('========== 数据中台原始字段 ==========')
      console.log('字段数量:', fields.length)
      if (fields.length > 0) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const f = fields[0] as any
        console.log('第一个字段所有键:', Object.keys(f))
        console.log('--- 关键字段值（从原始响应） ---')
        console.log('anchorWord:', f.anchorWord)
        console.log('valueSource:', f.valueSource)
        console.log('extractMethod:', f.extractMethod)
        console.log('outputFormat:', f.outputFormat)
        console.log('完整原始数据:', JSON.stringify(f, null, 2))
      }
      console.log('=======================================')
      
      // 转换为提取字段格式（字段一一对应数据中台）
      const extractFields: ExtractFieldDef[] = fields.map(field => ({
        id: field.id,
        fieldCode: field.fieldCode,
        fieldName: field.fieldName,
        fieldCategory: field.fieldCategory,
        requiredFlag: field.requiredFlag,
        valueSource: field.valueSource,       // 取值方式
        enumOptions: field.enumOptions,       // 枚举值
        exampleValue: field.exampleValue,     // 示例数据
        fieldDescription: field.fieldDescription, // 字段说明
        anchorWord: field.anchorWord,         // 定位词
        outputFormat: field.outputFormat,     // 输出格式
        extractMethod: field.extractMethod,   // 提取方法
        // 兼容字段
        code: field.fieldCode,
        name: field.fieldName,
        groupName: field.fieldCategory,
      }))
      
      return extractFields
    } catch (error) {
      console.error('获取招标文件字段定义失败:', error)
      throw error
    }
  },
  
  /**
   * 获取招标文件类型信息
   */
  async getDocType(): Promise<DocType> {
    const docTypeCode = DATA_HUB_CONFIG.TENDER_DOC_TYPE_CODE
    const response = await dataHubClient.get<{ data: DocTypeFullResponse; meta: unknown }>(
      `/doc-types/full/${docTypeCode}`
    )
    return response.data.data.docType
  },
}

