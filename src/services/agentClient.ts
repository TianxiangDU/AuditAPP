import axios, { type AxiosInstance } from 'axios'
import { getConfig, getAccountToken, getAgentToken, type Environment } from './agentConfig'

// 创建智能体 API 客户端
function createAgentClient(): AxiosInstance {
  const config = getConfig()
  
  const instance = axios.create({
    baseURL: config.host,
    timeout: 600000, // 10 分钟超时
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器 - 添加 traceId
  instance.interceptors.request.use((reqConfig) => {
    reqConfig.headers['X-Trace-Id'] = `${Date.now()}-${Math.random().toString(36).slice(2)}`
    return reqConfig
  })

  return instance
}

export const agentClient = createAgentClient()

// =============== 类型定义 ===============

// 智能体聊天请求
export interface AgentChatRequest {
  agentId: string
  chatId?: number | null
  userChatInput: string
  images?: Array<{ url: string }>
  files?: string[]
  state?: Record<string, unknown>
  debug?: boolean
}

// 智能体聊天响应
export interface AgentChatResponse {
  chatId: number
  conversationId: string
  state?: Record<string, unknown>
  memory?: Record<string, unknown>
  choices: AgentChoice[]
}

export interface AgentChoice {
  chatId: number
  complete: boolean
  content: string
  conversationId: string
  messageId: string
  finish: boolean
  type: 'text' | 'pic' | 'file' | 'buttons' | 'feedback' | 'table' | 'chart'
  role: {
    avatar: string
    id: string
    name: string
  }
  reference?: string
  referenceType?: string
}

// 文件上传响应
export interface FileUploadResponse {
  code: number
  msg: string
  data: string // fileId 或 url
}

// 知识库数据集创建响应
export interface KbCreateResponse {
  code: number
  msg: string
  data: number // dsId
}

// 知识库查询响应
export interface KbQueryResponse {
  code: number
  msg: string
  data: {
    list: KbDataset[]
    total: number
    pageNum: number
    pageSize: number
  }
}

export interface KbDataset {
  id: number
  state: number
  trainingState: number
  kbId: number
  fileId: string
  name: string
  taskStatus: number // 0:待执行 1:执行中 2:执行成功 3:执行失败 4:已取消
  progress: string
  taskId: number
  createAt: string
}

// =============== 文件上传服务 ===============
export const agentFileService = {
  /**
   * 上传文件到智能体平台
   */
  async upload(file: File, returnType: 'id' | 'url' = 'id'): Promise<string> {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('returnType', returnType)

    const response = await agentClient.post<FileUploadResponse>(
      '/openapi/fs/upload',
      formData,
      {
        headers: {
          'Authorization': getAccountToken(),
          'Content-Type': 'multipart/form-data',
        },
      }
    )

    if (response.data.code !== 1) {
      throw new Error(response.data.msg || '文件上传失败')
    }

    return response.data.data
  },

  /**
   * 获取文件预览/下载 URL
   * 智能体平台的文件 URL 格式: {host}/openapi/fs/{fileId}
   */
  getFileUrl(fileId: string): string {
    const config = getConfig()
    return `${config.host}/openapi/fs/${fileId}`
  },
}

// =============== 知识库服务 ===============
export const agentKbService = {
  /**
   * 创建数据集并开始解析任务
   */
  async createDataset(fileId: string, fileName: string): Promise<number> {
    const config = getConfig()
    
    const response = await agentClient.post<KbCreateResponse>(
      '/openapi/kb/createDsAndTask',
      {
        kbId: config.kbId,
        fileId,
        name: fileName,
        parserType: 'general',
      },
      {
        headers: {
          'Authorization': getAccountToken(),
        },
      }
    )

    if (response.data.code !== 1) {
      throw new Error(response.data.msg || '创建数据集失败')
    }

    return response.data.data // 返回 dsId
  },

  /**
   * 查询数据集解析状态
   */
  async queryDatasets(dsIds: number[]): Promise<KbDataset[]> {
    const config = getConfig()
    
    const response = await agentClient.post<KbQueryResponse>(
      '/openapi/kb/ds/query',
      {
        kbId: config.kbId,
        dsIds,
        pageNum: 1,
        pageSize: 100,
      },
      {
        headers: {
          'Authorization': getAccountToken(),
        },
      }
    )

    if (response.data.code !== 1) {
      throw new Error(response.data.msg || '查询数据集失败')
    }

    return response.data.data.list
  },

  /**
   * 等待数据集解析完成
   */
  async waitForParsing(dsId: number, maxWaitMs = 300000, intervalMs = 3000): Promise<KbDataset> {
    const startTime = Date.now()
    
    while (Date.now() - startTime < maxWaitMs) {
      const datasets = await this.queryDatasets([dsId])
      const dataset = datasets.find(d => d.id === dsId)
      
      if (!dataset) {
        throw new Error('数据集不存在')
      }

      // taskStatus: 0:待执行 1:执行中 2:执行成功 3:执行失败 4:已取消
      if (dataset.taskStatus === 2) {
        return dataset // 解析成功
      }
      
      if (dataset.taskStatus === 3) {
        throw new Error('数据集解析失败')
      }
      
      if (dataset.taskStatus === 4) {
        throw new Error('数据集解析已取消')
      }

      // 等待后重试
      await new Promise(resolve => setTimeout(resolve, intervalMs))
    }

    throw new Error('数据集解析超时')
  },
}

import type { AgentType } from './agentConfig'

// 文件参数
interface AgentFileParam {
  fileId: string
  url?: string
}

// =============== 智能体调用服务 ===============
export const agentChatService = {
  /**
   * 调用智能体
   */
  async chat(
    agentType: AgentType,
    input: string,
    state?: Record<string, unknown>,
    chatId?: number,
    files?: AgentFileParam[]
  ): Promise<AgentChatResponse> {
    const config = getConfig()
    const agent = config.agents[agentType]

    const requestBody: Record<string, unknown> = {
      agentId: agent.uuid,
      chatId: chatId || null,
      userChatInput: input,
      state: state || {},
      debug: true,
    }
    
    // 如果有文件参数，添加到请求体
    if (files && files.length > 0) {
      requestBody.files = files
    }

    // 打印完整请求
    console.log('\n========== Agent 调用请求 ==========')
    console.log('URL:', `${config.host}/openapi/v2/chat/completions`)
    console.log('AgentType:', agentType)
    console.log('AgentId:', agent.uuid)
    console.log('Request Body:')
    console.log(JSON.stringify(requestBody, null, 2))
    console.log('=====================================\n')

    const response = await agentClient.post<AgentChatResponse>(
      '/openapi/v2/chat/completions',
      requestBody,
      {
        headers: {
          'Authorization': getAgentToken(agentType),
        },
      }
    )

    // 打印完整响应
    console.log('\n========== Agent 调用响应 ==========')
    console.log('Response:')
    console.log(JSON.stringify(response.data, null, 2))
    console.log('=====================================\n')

    return response.data
  },

  /**
   * 获取智能体响应的最终文本内容
   */
  getTextContent(response: AgentChatResponse): string {
    const textChoices = response.choices.filter(c => c.type === 'text' && c.content)
    return textChoices.map(c => c.content).join('')
  },

  /**
   * 解析智能体响应（尝试解析为 JSON）
   */
  parseContent<T = unknown>(response: AgentChatResponse): T | null {
    const content = this.getTextContent(response)
    try {
      return JSON.parse(content) as T
    } catch {
      return null
    }
  },
}
