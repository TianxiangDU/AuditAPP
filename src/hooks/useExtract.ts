import { useState, useCallback } from 'react'
import { extractService, type ExtractFieldResult, type BatchExtractRequest } from '@/services'

interface UseExtractState {
  isUploading: boolean
  isParsing: boolean
  isExtracting: boolean
  error: string | null
  fileId: string | null
  dsId: number | null
  results: ExtractFieldResult[]
}

export function useExtract() {
  const [state, setState] = useState<UseExtractState>({
    isUploading: false,
    isParsing: false,
    isExtracting: false,
    error: null,
    fileId: null,
    dsId: null,
    results: [],
  })

  /**
   * 上传文件并加入知识库
   */
  const uploadFile = useCallback(async (file: File) => {
    setState(prev => ({ ...prev, isUploading: true, error: null }))
    
    try {
      const { fileId, dsId } = await extractService.uploadAndIndex(file)
      setState(prev => ({ ...prev, isUploading: false, fileId, dsId }))
      return { fileId, dsId }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '上传失败'
      setState(prev => ({ ...prev, isUploading: false, error: msg }))
      throw error
    }
  }, [])

  /**
   * 等待文件解析完成（无超时限制）
   */
  const waitForParsing = useCallback(async (dsId: number) => {
    setState(prev => ({ ...prev, isParsing: true, error: null }))
    
    try {
      // 持续轮询直到解析完成，不设置超时
      while (true) {
        const status = await extractService.checkParsingStatus(dsId)
        
        if (status.status === 'completed') {
          setState(prev => ({ ...prev, isParsing: false }))
          return true
        }
        
        if (status.status === 'failed') {
          throw new Error('文件解析失败')
        }
        
        // 等待 3 秒后重试
        await new Promise(resolve => setTimeout(resolve, 3000))
      }
    } catch (error) {
      const msg = error instanceof Error ? error.message : '解析失败'
      setState(prev => ({ ...prev, isParsing: false, error: msg }))
      throw error
    }
  }, [])

  /**
   * 提取字段
   */
  const extractFields = useCallback(async (request: BatchExtractRequest) => {
    setState(prev => ({ ...prev, isExtracting: true, error: null, results: [] }))
    
    try {
      const results = await extractService.batchExtract(request)
      setState(prev => ({ ...prev, isExtracting: false, results }))
      return results
    } catch (error) {
      const msg = error instanceof Error ? error.message : '提取失败'
      setState(prev => ({ ...prev, isExtracting: false, error: msg }))
      throw error
    }
  }, [])

  /**
   * 完整流程：上传 -> 等待解析 -> 提取字段
   */
  const processFile = useCallback(async (
    file: File,
    fields: BatchExtractRequest['fields']
  ) => {
    // 1. 上传
    const { fileId, dsId } = await uploadFile(file)
    
    // 2. 等待解析
    await waitForParsing(dsId)
    
    // 3. 提取字段
    const results = await extractFields({ fileId, fields })
    
    return { fileId, dsId, results }
  }, [uploadFile, waitForParsing, extractFields])

  const reset = useCallback(() => {
    setState({
      isUploading: false,
      isParsing: false,
      isExtracting: false,
      error: null,
      fileId: null,
      dsId: null,
      results: [],
    })
  }, [])

  return {
    ...state,
    uploadFile,
    waitForParsing,
    extractFields,
    processFile,
    reset,
  }
}
