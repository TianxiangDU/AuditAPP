import { appClient, clearCache } from './apiClient'
import type {
  Project,
  ProjectFile,
  FileFieldValue,
  ProjectLedger,
  AuditRisk,
  ApiResponse,
  PaginatedResponse,
  FieldStatus,
  EvidenceRef,
} from '@/types'

// =============== 项目相关 ===============
export const projectService = {
  // 创建项目
  async create(data: {
    tenderFileAssetId: string
    confirmedTenderFields: Array<{
      fieldCode: string
      value: string | null
      status: FieldStatus
      evidenceRef: EvidenceRef | null
    }>
  }): Promise<Project> {
    const response = await appClient.post<ApiResponse<Project>>(
      '/projects',
      data
    )
    clearCache('projects')
    return response.data.data
  },

  // 获取项目列表
  async getList(params?: {
    page?: number
    pageSize?: number
    status?: string
  }): Promise<PaginatedResponse<Project>> {
    const response = await appClient.get<ApiResponse<PaginatedResponse<Project>>>(
      '/projects',
      { params }
    )
    return response.data.data
  },

  // 获取项目详情
  async getById(id: string): Promise<Project> {
    const response = await appClient.get<ApiResponse<Project>>(
      `/projects/${id}`
    )
    return response.data.data
  },

  // 更新项目
  async update(id: string, data: Partial<Project>): Promise<Project> {
    const response = await appClient.put<ApiResponse<Project>>(
      `/projects/${id}`,
      data
    )
    clearCache('projects')
    return response.data.data
  },

  // 删除项目
  async delete(id: string): Promise<void> {
    await appClient.delete(`/projects/${id}`)
    clearCache('projects')
  },
}

// =============== 项目文件相关 ===============
export const projectFileService = {
  // 绑定文件到项目
  async bind(projectId: string, fileAssetId: string): Promise<ProjectFile> {
    const response = await appClient.post<ApiResponse<ProjectFile>>(
      `/projects/${projectId}/files`,
      { fileAssetId }
    )
    return response.data.data
  },

  // 获取项目文件列表
  async getList(projectId: string, params?: {
    page?: number
    pageSize?: number
    status?: string
    docTypeCode?: string
  }): Promise<PaginatedResponse<ProjectFile>> {
    const response = await appClient.get<ApiResponse<PaginatedResponse<ProjectFile>>>(
      `/projects/${projectId}/files`,
      { params }
    )
    return response.data.data
  },

  // 更新文件信息
  async update(
    projectId: string,
    fileId: string,
    data: Partial<Pick<ProjectFile, 'docTypeCode' | 'status'>>
  ): Promise<ProjectFile> {
    const response = await appClient.put<ApiResponse<ProjectFile>>(
      `/projects/${projectId}/files/${fileId}`,
      data
    )
    return response.data.data
  },

  // 批量更新文件类型
  async batchUpdateType(
    projectId: string,
    fileIds: string[],
    docTypeCode: string
  ): Promise<void> {
    await appClient.post(`/projects/${projectId}/files/batch-update-type`, {
      fileIds,
      docTypeCode,
    })
  },

  // 批量确认分拣
  async batchConfirm(projectId: string, fileIds: string[]): Promise<void> {
    await appClient.post(`/projects/${projectId}/files/batch-confirm`, {
      fileIds,
    })
  },

  // 触发文件提取
  async triggerExtraction(projectId: string, fileId: string): Promise<void> {
    await appClient.post(`/projects/${projectId}/files/${fileId}/extract`)
  },
}

// =============== 字段值相关（KV）===============
export const fieldValueService = {
  // 获取文件的字段值
  async getByFile(projectId: string, fileId: string): Promise<FileFieldValue[]> {
    const response = await appClient.get<ApiResponse<FileFieldValue[]>>(
      `/projects/${projectId}/files/${fileId}/fields`
    )
    return response.data.data
  },

  // 批量更新字段值
  async batchUpdate(
    projectId: string,
    fileId: string,
    fields: Array<{
      fieldCode: string
      value?: string | null
      status?: FieldStatus
      evidenceRef?: EvidenceRef | null
    }>
  ): Promise<FileFieldValue[]> {
    const response = await appClient.put<ApiResponse<FileFieldValue[]>>(
      `/projects/${projectId}/files/${fileId}/fields`,
      { fields }
    )
    return response.data.data
  },

  // 确认所有字段
  async confirmAll(projectId: string, fileId: string): Promise<void> {
    await appClient.post(`/projects/${projectId}/files/${fileId}/fields/confirm-all`)
  },
}

// =============== 台账相关 ===============
export const ledgerService = {
  // 生成台账
  async generate(projectId: string): Promise<ProjectLedger> {
    const response = await appClient.post<ApiResponse<ProjectLedger>>(
      `/projects/${projectId}/ledger/generate`
    )
    return response.data.data
  },

  // 获取台账
  async get(projectId: string): Promise<ProjectLedger> {
    const response = await appClient.get<ApiResponse<ProjectLedger>>(
      `/projects/${projectId}/ledger`
    )
    return response.data.data
  },

  // 更新台账
  async update(projectId: string, data: Partial<ProjectLedger>): Promise<ProjectLedger> {
    const response = await appClient.put<ApiResponse<ProjectLedger>>(
      `/projects/${projectId}/ledger`,
      data
    )
    return response.data.data
  },

  // 导出 Excel
  getExportUrl(projectId: string): string {
    return `/api/app/projects/${projectId}/ledger/export.xlsx`
  },

  // 获取缺失字段清单
  async getMissingFields(projectId: string): Promise<
    Array<{ fieldCode: string; fieldName: string }>
  > {
    const response = await appClient.get<
      ApiResponse<Array<{ fieldCode: string; fieldName: string }>>
    >(`/projects/${projectId}/ledger/missing-fields`)
    return response.data.data
  },
}

// =============== 审计与风险相关 ===============
export const auditService = {
  // 执行审计
  async run(projectId: string, ruleIds?: string[]): Promise<AuditRisk[]> {
    const response = await appClient.post<ApiResponse<AuditRisk[]>>(
      `/projects/${projectId}/audit/run`,
      { ruleIds }
    )
    return response.data.data
  },

  // 获取风险列表
  async getRisks(projectId: string): Promise<AuditRisk[]> {
    const response = await appClient.get<ApiResponse<AuditRisk[]>>(
      `/projects/${projectId}/risks`
    )
    return response.data.data
  },

  // 更新风险
  async updateRisk(
    projectId: string,
    riskId: string,
    data: Partial<Pick<AuditRisk, 'description' | 'suggestion' | 'severity'>>
  ): Promise<AuditRisk> {
    const response = await appClient.put<ApiResponse<AuditRisk>>(
      `/projects/${projectId}/risks/${riskId}`,
      data
    )
    return response.data.data
  },

  // 生成报告
  async generateReport(projectId: string): Promise<{ reportId: string }> {
    const response = await appClient.post<ApiResponse<{ reportId: string }>>(
      `/projects/${projectId}/report/generate`
    )
    return response.data.data
  },

  // 获取报告下载 URL
  getReportDownloadUrl(projectId: string): string {
    return `/api/app/projects/${projectId}/report/download`
  },
}
