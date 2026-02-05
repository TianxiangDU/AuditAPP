import { agentChatService, agentFileService, agentKbService } from './agentClient'
import type { FieldStatus, EvidenceRef } from '@/types'

/**
 * 转义字符串中的特殊字符，用于传入智能体
 * 处理换行符、引号等特殊字符
 */
function escapeForAgent(str: string | null | undefined): string {
  if (!str) return ''
  return str
    .replace(/\\/g, '\\\\')     // 反斜杠
    .replace(/"/g, '\\"')        // 双引号
    .replace(/\n/g, '\\n')       // 换行符
    .replace(/\r/g, '\\r')       // 回车符
    .replace(/\t/g, '\\t')       // 制表符
}

// 提取字段请求参数
export interface ExtractFieldRequest {
  fileId: string          // 智能体平台的文件ID
  定位词?: string
  字段名称: string
  字段类别: string
  取值方式: string        // 取值方式
  提取方法?: string       // 提取方法
  枚举值?: string         // 如果是枚举类型
  示例数据?: string
  字段说明?: string
  输出格式?: string       // 输出格式
}

// 提取结果
export interface ExtractFieldResult {
  fieldCode: string
  fieldName: string
  value: string | null
  status: FieldStatus
  evidenceRef: EvidenceRef | null
  rawResponse?: string
}

// 批量提取请求
export interface BatchExtractRequest {
  fileId: string
  fields: Array<{
    fieldCode: string
    fieldName: string
    定位词?: string
    字段类别: string
    取值方式: string
    提取方法?: string
    枚举值?: string
    示例数据?: string
    字段说明?: string
    输出格式?: string
  }>
}

/**
 * 提取服务 - 调用智能体提取文档字段
 */
export const extractService = {
  /**
   * 上传文件并加入知识库
   * 文件名格式：fileId_原名.后缀名
   * 返回 fileId, dsId 以及可预览的 fileUrl
   */
  async uploadAndIndex(file: File): Promise<{ fileId: string; dsId: number; fileUrl: string }> {
    // 1. 上传文件获取 fileId
    const fileId = await agentFileService.upload(file, 'id')
    
    // 2. 同时获取文件 URL（用于预览）
    const fileUrl = await agentFileService.upload(file, 'url')
    
    // 3. 构建知识库文件名：fileId_原名.后缀名
    const ext = file.name.split('.').pop() || ''
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const kbFileName = `${fileId}_${baseName}.${ext}`
    
    // 4. 创建知识库数据集
    const dsId = await agentKbService.createDataset(fileId, kbFileName)
    
    return { fileId, dsId, fileUrl }
  },

  /**
   * 等待知识库解析完成
   */
  async waitForParsing(dsId: number): Promise<boolean> {
    console.log('[提取服务] 等待解析完成...')
    
    while (true) {
      const datasets = await agentKbService.queryDatasets([dsId])
      const dataset = datasets.find(d => d.id === dsId)
      
      if (!dataset) {
        throw new Error('数据集不存在')
      }
      
      // taskStatus: 30 表示 embedding 完成
      if (dataset.taskStatus === 30) {
        console.log('[提取服务] 解析完成')
        return true
      }
      
      // taskStatus: 3 或 4 表示失败或取消
      if (dataset.taskStatus === 3 || dataset.taskStatus === 4) {
        throw new Error('文件解析失败')
      }
      
      console.log(`[提取服务] 解析中... status=${dataset.taskStatus}, progress=${dataset.progress}`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  },

  /**
   * 提取单个字段
   */
  async extractField(request: ExtractFieldRequest): Promise<ExtractFieldResult> {
    const currentTime = new Date().toISOString()
    
    // 对所有字符串进行转义处理
    const state = {
      fileId: request.fileId,
      定位词: escapeForAgent(request.定位词),
      字段名称: escapeForAgent(request.字段名称),
      字段类别: escapeForAgent(request.字段类别),
      取值方式: escapeForAgent(request.取值方式),
      提取方法: escapeForAgent(request.提取方法),
      枚举值: escapeForAgent(request.枚举值),
      示例数据: escapeForAgent(request.示例数据),
      字段说明: escapeForAgent(request.字段说明),
      输出格式: escapeForAgent(request.输出格式) || '字符串',
    }

    try {
      const response = await agentChatService.chat('normalExtract', currentTime, state)
      const content = agentChatService.getTextContent(response)

      // 尝试解析响应
      let value: string | null = null
      let evidenceRef: EvidenceRef | null = null

      // 预处理：移除 markdown 代码块标记
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }

      try {
        const parsed = JSON.parse(cleanContent)
        
        // 提取值，支持多种键名
        if (typeof parsed === 'object' && parsed !== null) {
          // 1. 先尝试标准键名
          value = parsed.value ?? parsed.结果 ?? parsed.提取结果 ?? 
                  parsed.answer ?? parsed.result ?? parsed.data ?? null
          
          // 2. 尝试用字段名作为键
          if (value === null && request.字段名称) {
            value = parsed[request.字段名称] ?? null
          }
          
          // 3. 如果对象只有一个键，使用那个值
          if (value === null) {
            const keys = Object.keys(parsed).filter(k => !['page', '页码', 'snippet', '原文片段', 'bbox', '坐标'].includes(k))
            if (keys.length === 1) {
              const singleValue = parsed[keys[0]]
              value = typeof singleValue === 'object' ? JSON.stringify(singleValue) : singleValue
            }
          }
          
          // 4. 如果 value 仍是对象，尝试进一步解析
          if (typeof value === 'object' && value !== null) {
            const valueKeys = Object.keys(value)
            if (valueKeys.length === 1) {
              // 如果是单键对象，取其值
              const innerValue = value[valueKeys[0]]
              value = typeof innerValue === 'object' ? JSON.stringify(innerValue) : String(innerValue)
            } else {
              value = JSON.stringify(value)
            }
          }
          
          // 提取证据引用
          if (parsed.page || parsed.页码) {
            evidenceRef = {
              page: parsed.page || parsed.页码,
              snippet: parsed.snippet || parsed.原文片段 || '',
            }
          }
        } else if (typeof parsed === 'string') {
          // JSON 解析结果是字符串
          value = parsed
        } else {
          // 数字或其他基本类型
          value = String(parsed)
        }
      } catch {
        // 如果不是 JSON，尝试提取引号内的内容
        // 匹配 "字段名": "值" 或 "字段名":"值" 格式
        const kvMatch = cleanContent.match(/"[^"]+"\s*:\s*"([^"]+)"/)
        if (kvMatch) {
          value = kvMatch[1]
        } else {
          // 直接使用文本内容
          value = cleanContent || null
        }
      }
      
      // 确保 value 是干净的字符串
      if (value !== null) {
        if (typeof value !== 'string') {
          value = String(value)
        }
        value = value.trim()
        
        // 如果值仍然看起来像 JSON 键值对，尝试提取值部分
        // 匹配 "xxx": "yyy" 或 "xxx":"yyy" 格式
        const kvPattern = /^"[^"]+"\s*:\s*"([^"]*)"$/
        const kvMatch = value.match(kvPattern)
        if (kvMatch) {
          value = kvMatch[1]
        }
        
        // 移除可能的外层引号
        if (value.startsWith('"') && value.endsWith('"') && value.length > 2) {
          value = value.slice(1, -1)
        }
        
        // 过滤无效值：agent 返回的表示未找到的文本
        const invalidPatterns = [
          /^未提取到/,
          /^未找到/,
          /^无法提取/,
          /^没有找到/,
          /^不存在/,
          /^无数据/,
          /^null$/i,
          /^undefined$/i,
          /^无$/,
          /^-$/,
          /^N\/A$/i,
        ]
        
        if (invalidPatterns.some(pattern => pattern.test(value!))) {
          console.log(`[提取服务] 过滤无效值: "${value}"`)
          value = null
        }
      }

      return {
        fieldCode: request.字段名称,
        fieldName: request.字段名称,
        value,
        status: value ? 'auto' : 'missing',
        evidenceRef,
        rawResponse: content,
      }
    } catch (error) {
      console.error('提取字段失败:', error)
      return {
        fieldCode: request.字段名称,
        fieldName: request.字段名称,
        value: null,
        status: 'missing',
        evidenceRef: null,
        rawResponse: String(error),
      }
    }
  },

  /**
   * 批量提取字段
   */
  async batchExtract(request: BatchExtractRequest): Promise<ExtractFieldResult[]> {
    const results: ExtractFieldResult[] = []

    // 调试：打印第一个字段的定位词
    if (request.fields.length > 0) {
      console.log('========== batchExtract 收到的字段 ==========')
      console.log('第一个字段:', JSON.stringify(request.fields[0], null, 2))
      console.log('定位词值:', request.fields[0].定位词)
      console.log('==============================================')
    }

    for (const field of request.fields) {
      const result = await this.extractField({
        fileId: request.fileId,
        定位词: field.定位词,
        字段名称: field.fieldName,
        字段类别: field.字段类别,
        取值方式: field.取值方式,
        提取方法: field.提取方法,
        枚举值: field.枚举值,
        示例数据: field.示例数据,
        字段说明: field.字段说明,
        输出格式: field.输出格式,
      })

      results.push({
        ...result,
        fieldCode: field.fieldCode,
        fieldName: field.fieldName,
      })
    }

    return results
  },

  /**
   * 使用视觉模型提取（用于图片或扫描件）
   */
  async extractWithVision(
    fileId: string,
    fieldName: string,
    fieldDescription: string
  ): Promise<ExtractFieldResult> {
    const currentTime = new Date().toISOString()
    
    const state = {
      fileId,
      字段名称: fieldName,
      字段说明: fieldDescription,
    }

    try {
      const response = await agentChatService.chat('visionExtract', currentTime, state)
      const content = agentChatService.getTextContent(response)

      return {
        fieldCode: fieldName,
        fieldName,
        value: content.trim() || null,
        status: content ? 'auto' : 'missing',
        evidenceRef: null,
        rawResponse: content,
      }
    } catch (error) {
      console.error('视觉提取失败:', error)
      return {
        fieldCode: fieldName,
        fieldName,
        value: null,
        status: 'missing',
        evidenceRef: null,
        rawResponse: String(error),
      }
    }
  },

  /**
   * 查询文件解析状态
   */
  async checkParsingStatus(dsId: number): Promise<{
    status: 'pending' | 'processing' | 'completed' | 'failed'
    progress: string
    taskStatus: number
  }> {
    const datasets = await agentKbService.queryDatasets([dsId])
    const dataset = datasets.find(d => d.id === dsId)

    if (!dataset) {
      return { status: 'failed', progress: '0%', taskStatus: -1 }
    }

    // taskStatus 状态码说明:
    // 0: 待执行
    // 1: 执行中
    // 2: 解析成功（文本提取完成）
    // 3: 执行失败
    // 4: 已取消
    // 20-29: embedding 进行中
    // 30: embedding 完成（可以开始使用智能体）
    
    let status: 'pending' | 'processing' | 'completed' | 'failed'
    
    if (dataset.taskStatus === 0) {
      status = 'pending'
    } else if (dataset.taskStatus === 1) {
      status = 'processing'
    } else if (dataset.taskStatus === 2) {
      // 2: 文本解析成功，但可能还在embedding
      // 继续等待直到 taskStatus === 30
      status = 'processing'
    } else if (dataset.taskStatus === 30) {
      // 30: embedding完成，可以使用
      status = 'completed'
    } else if (dataset.taskStatus === 3 || dataset.taskStatus === 4) {
      status = 'failed'
    } else if (dataset.taskStatus > 2 && dataset.taskStatus < 30) {
      // 20-29 之间可能是 embedding 相关状态，视为处理中
      status = 'processing'
    } else {
      // 其他未知状态也视为处理中
      status = 'processing'
    }

    console.log(`[解析状态] dsId=${dsId}, taskStatus=${dataset.taskStatus}, progress=${dataset.progress}, status=${status}`)

    return {
      status,
      progress: dataset.progress || '0%',
      taskStatus: dataset.taskStatus,
    }
  },
}
