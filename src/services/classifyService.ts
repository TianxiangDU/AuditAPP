import { agentChatService, agentFileService, agentKbService } from './agentClient'

// 文件分类结果
export interface FileClassifyResult {
  fileId: string
  fileName: string
  docTypeCode: string | null
  docTypeName: string | null
  confidence?: number
  rawResponse?: string
}

// 文件上传和索引结果
export interface FileIndexResult {
  fileId: string
  dsId: number
  fileName: string
}

/**
 * 文件分拣服务
 */
export const classifyService = {
  /**
   * 上传文件并加入知识库
   * 文件名格式：fileId_原名.后缀名
   */
  async uploadAndIndex(file: File): Promise<FileIndexResult> {
    // 1. 上传文件获取 fileId
    const fileId = await agentFileService.upload(file, 'id')
    console.log('[分拣服务] 文件上传成功:', fileId)
    
    // 2. 构建知识库文件名：fileId_原名.后缀名
    const ext = file.name.split('.').pop() || ''
    const baseName = file.name.replace(/\.[^/.]+$/, '')
    const kbFileName = `${fileId}_${baseName}.${ext}`
    
    // 3. 创建知识库数据集
    const dsId = await agentKbService.createDataset(fileId, kbFileName)
    console.log('[分拣服务] 知识库创建成功:', { dsId, kbFileName })
    
    return { fileId, dsId, fileName: file.name }
  },

  /**
   * 等待知识库解析完成
   */
  async waitForParsing(dsId: number): Promise<boolean> {
    console.log('[分拣服务] 等待知识库解析...')
    
    while (true) {
      const datasets = await agentKbService.queryDatasets([dsId])
      const dataset = datasets.find(d => d.id === dsId)
      
      if (!dataset) {
        throw new Error('数据集不存在')
      }
      
      // taskStatus: 30 表示 embedding 完成
      if (dataset.taskStatus === 30) {
        console.log('[分拣服务] 解析完成')
        return true
      }
      
      // taskStatus: 3 或 4 表示失败或取消
      if (dataset.taskStatus === 3 || dataset.taskStatus === 4) {
        throw new Error('文件解析失败')
      }
      
      console.log(`[分拣服务] 解析中... status=${dataset.taskStatus}, progress=${dataset.progress}`)
      await new Promise(resolve => setTimeout(resolve, 3000))
    }
  },

  /**
   * 调用分拣智能体进行文件分类
   */
  async classifyFile(fileId: string, fileName: string): Promise<FileClassifyResult> {
    const currentTime = new Date().toISOString()
    
    console.log('[分拣服务] 开始分类文件:', { fileId, fileName })
    
    try {
      // 调用分拣智能体，files 传入 fileId 信息
      const response = await agentChatService.chat(
        'fileClassify',
        currentTime,
        { fileId },  // state 中也传入 fileId
        undefined,
        [{ fileId }]  // files 参数
      )
      
      const content = agentChatService.getTextContent(response)
      console.log('[分拣服务] 分类结果:', content)
      
      // 解析返回的内容
      let docTypeCode: string | null = null
      let docTypeName: string | null = null
      
      // 清理内容：去除 markdown 代码块
      let cleanContent = content.trim()
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/^```json\s*/, '').replace(/\s*```$/, '')
      } else if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.replace(/^```\s*/, '').replace(/\s*```$/, '')
      }
      
      console.log('[分拣服务] 清理后内容:', cleanContent)
      
      try {
        const parsed = JSON.parse(cleanContent)
        
        // 支持多种返回格式
        // 格式1: { "一级分类": "合同", "二级分类": "施工合同", "三级分类": "总承包合同" }
        // 格式2: { "文件类型": "合同" }
        // 格式3: { "docTypeName": "合同" }
        
        const level3 = parsed['三级分类'] || parsed.三级分类 || parsed.level3
        const level2 = parsed['二级分类'] || parsed.二级分类 || parsed.level2
        const level1 = parsed['一级分类'] || parsed.一级分类 || parsed.level1
        
        // 构建分类名称
        if (level3) {
          docTypeName = level3
          docTypeCode = `${level1 || ''}/${level2 || ''}/${level3}`.replace(/^\/+|\/+$/g, '')
        } else if (level2) {
          docTypeName = level2
          docTypeCode = `${level1 || ''}/${level2}`.replace(/^\/+|\/+$/g, '')
        } else if (level1) {
          docTypeName = level1
          docTypeCode = level1
        }
        
        // 兼容其他格式
        if (!docTypeName) {
          docTypeCode = parsed.docTypeCode || parsed.code || parsed.类型编码 || null
          docTypeName = parsed.docTypeName || parsed.name || parsed.类型名称 || parsed.文件类型 || parsed.分类 || parsed.类型 || null
        }
        
        // 如果是对象但只有一个键，取那个值
        if (!docTypeName && typeof parsed === 'object') {
          const keys = Object.keys(parsed)
          if (keys.length === 1) {
            const value = parsed[keys[0]]
            if (typeof value === 'string') {
              docTypeName = value
              docTypeCode = keys[0]
            }
          }
        }
        
        console.log('[分拣服务] 解析分类:', { level1, level2, level3, docTypeCode, docTypeName })
      } catch (parseError) {
        console.warn('[分拣服务] JSON解析失败，尝试从文本提取:', parseError)
        
        // 尝试从文本中提取类型信息
        // 例如："该文件是施工总承包合同" 或 "合同"
        const typePatterns = [
          /文件类型[：:]\s*[「『"']?(.+?)[」』"']?$/m,
          /分类[：:]\s*[「『"']?(.+?)[」』"']?$/m,
          /是[「『"']?(.+?)[」』"']?文件/,
          /属于[「『"']?(.+?)[」』"']?/,
        ]
        
        for (const pattern of typePatterns) {
          const match = cleanContent.match(pattern)
          if (match) {
            docTypeName = match[1].trim()
            break
          }
        }
        
        // 如果还是没有，使用清理后的整个内容作为类型名（如果内容较短）
        if (!docTypeName && cleanContent.length <= 50 && !cleanContent.includes('\n')) {
          docTypeName = cleanContent
        }
      }
      
      return {
        fileId,
        fileName,
        docTypeCode,
        docTypeName,
        rawResponse: content,
      }
    } catch (error) {
      console.error('[分拣服务] 分类失败:', error)
      console.error('[分拣服务] 错误详情:', error instanceof Error ? error.stack : error)
      return {
        fileId,
        fileName,
        docTypeCode: null,
        docTypeName: null,
        rawResponse: String(error),
      }
    }
  },

  /**
   * 完整的文件处理流程：上传 -> 解析 -> 分类
   */
  async processFile(file: File): Promise<FileClassifyResult & { dsId: number }> {
    // 1. 上传并加入知识库
    const { fileId, dsId, fileName } = await this.uploadAndIndex(file)
    
    // 2. 等待解析完成
    await this.waitForParsing(dsId)
    
    // 3. 调用分拣智能体
    const classifyResult = await this.classifyFile(fileId, fileName)
    
    return {
      ...classifyResult,
      dsId,
    }
  },

  /**
   * 批量处理文件
   */
  async processFiles(files: File[]): Promise<Array<FileClassifyResult & { dsId: number }>> {
    const results: Array<FileClassifyResult & { dsId: number }> = []
    
    for (const file of files) {
      try {
        const result = await this.processFile(file)
        results.push(result)
      } catch (error) {
        console.error(`[分拣服务] 处理文件失败: ${file.name}`, error)
        results.push({
          fileId: '',
          dsId: 0,
          fileName: file.name,
          docTypeCode: null,
          docTypeName: null,
          rawResponse: String(error),
        })
      }
    }
    
    return results
  },
}
