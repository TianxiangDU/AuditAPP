import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { ArrowLeft, Check, Loader2, FileText, AlertCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  ResizablePanelGroup,
  ResizablePanel,
  ResizableHandle,
} from '@/components/ui/resizable'
import { FieldEditor } from '@/components/common'
import { projectFileService, fieldValueService, docTypeService, docFieldDefService, extractService } from '@/services'
import { getConfig } from '@/services/agentConfig'
import type { FileFieldValue, EvidenceRef, ExtractFieldDef, ProjectFile, DocType } from '@/types'

export function FileFields() {
  const { id: projectId, fileId } = useParams()
  const navigate = useNavigate()
  
  // 文件信息
  const [file, setFile] = useState<ProjectFile | null>(null)
  
  // 字段定义
  const [fieldDefs, setFieldDefs] = useState<ExtractFieldDef[]>([])
  
  // 提取的字段值
  const [fields, setFields] = useState<FileFieldValue[]>([])
  
  // 状态
  const [isLoading, setIsLoading] = useState(true)
  const [isExtracting, setIsExtracting] = useState(false)
  const [extractProgress, setExtractProgress] = useState('')
  const [error, setError] = useState<string | null>(null)
  
  // 预览相关
  const [currentPage, setCurrentPage] = useState(1)
  const [highlightEvidence, setHighlightEvidence] = useState<EvidenceRef | null>(null)

  // 加载文件信息和字段定义
  useEffect(() => {
    async function loadData() {
      if (!projectId || !fileId) return
      
      try {
        setIsLoading(true)
        setError(null)
        
        // 加载文件信息
        const files = await projectFileService.getList(projectId)
        const currentFile = files.find(f => f.id === fileId)
        if (!currentFile) {
          setError('文件不存在')
          return
        }
        
        setFile(currentFile)
        
        // 根据文件类型获取字段定义
        if (currentFile.docTypeName) {
          try {
            // 获取所有文件类型，找到匹配的
            const allDocTypes = await docTypeService.getAll()
            const matchedDocType = allDocTypes.find(dt => 
              dt.name === currentFile.docTypeName ||
              (currentFile.docTypeCode && currentFile.docTypeCode.endsWith(dt.name))
            ) || allDocTypes.find(dt => 
              dt.name && currentFile.docTypeName?.includes(dt.name)
            )
            
            if (matchedDocType) {
              console.log(`[FileFields] 匹配到文件类型: ${matchedDocType.name}, ID: ${matchedDocType.id}`)
              const defs = await docFieldDefService.getByDocType(matchedDocType.id)
              setFieldDefs(defs)
            } else {
              console.warn(`[FileFields] 未找到匹配的文件类型: ${currentFile.docTypeName}`)
            }
          } catch (err) {
            console.error('获取字段定义失败:', err)
          }
        }
        
        // 尝试加载已提取的字段
        try {
          const existingFields = await fieldValueService.getByFile(projectId, fileId)
          if (existingFields.length > 0) {
            setFields(existingFields)
          }
        } catch {
          // 没有已提取的字段，保持空数组
        }
        
      } catch (err) {
        console.error('加载数据失败:', err)
        setError('加载数据失败')
      } finally {
        setIsLoading(false)
      }
    }
    
    loadData()
  }, [projectId, fileId])

  // 开始提取
  const handleStartExtract = async () => {
    if (!file || !file.fileId || !file.dsId) {
      setError('文件信息不完整，无法提取')
      return
    }
    
    if (fieldDefs.length === 0) {
      setError(`未找到"${file.docTypeName || '未知类型'}"的字段定义，请先在数据中台配置该文件类型的字段`)
      return
    }
    
    setIsExtracting(true)
    setExtractProgress('准备提取...')
    
    try {
      // 使用字段定义进行批量提取
      const extractFields = fieldDefs.map(def => ({
        fileId: file.fileId!,
        字段名称: def.fieldName,
        字段类别: def.fieldCategory || '基本信息',
        取值方式: def.valueSource || '直接提取',
        枚举值: def.enumOptions,
        示例数据: def.exampleValue,
        字段说明: def.fieldDescription,
        输出格式: def.outputFormat || '字符串',
        定位词: def.anchorWord,
        提取方法: def.extractMethod,
      }))
      
      const results: FileFieldValue[] = []
      
      for (let i = 0; i < extractFields.length; i++) {
        const field = extractFields[i]
        const def = fieldDefs[i]
        
        setExtractProgress(`提取中: ${field.字段名称} (${i + 1}/${extractFields.length})`)
        
        try {
          const result = await extractService.extractField(field)
          
          results.push({
            id: `${fileId}-${def.fieldCode}`,
            projectId: projectId!,
            projectFileId: fileId!,
            docTypeCode: file.docTypeCode || '',
            fieldCode: def.fieldCode,
            fieldName: def.fieldName,
            value: result.value,
            status: result.value ? 'auto' : 'pending',
            evidenceRef: result.page ? { page: result.page, snippet: result.value } : null,
            updatedAt: new Date().toISOString(),
          })
        } catch {
          results.push({
            id: `${fileId}-${def.fieldCode}`,
            projectId: projectId!,
            projectFileId: fileId!,
            docTypeCode: file.docTypeCode || '',
            fieldCode: def.fieldCode,
            fieldName: def.fieldName,
            value: null,
            status: 'pending',
            evidenceRef: null,
            updatedAt: new Date().toISOString(),
          })
        }
      }
      
      setFields(results)
      setExtractProgress('保存提取结果...')
      
      // 保存提取结果到数据库
      try {
        await fieldValueService.batchUpdate(
          projectId!,
          fileId!,
          results.map(f => ({
            fieldCode: f.fieldCode,
            fieldName: f.fieldName,
            value: f.value,
            status: f.status,
            groupName: f.docTypeCode,
            evidenceRef: f.evidenceRef,
          }))
        )
        console.log(`[提取] 已保存 ${results.length} 个字段到数据库`)
      } catch (saveErr) {
        console.error('保存提取结果失败:', saveErr)
      }
      
      setExtractProgress('')
      
      // 更新文件提取状态
      await projectFileService.update(projectId!, fileId!, { extractionStatus: 'completed' })
      
    } catch (err) {
      console.error('提取失败:', err)
      setError('提取过程中出错')
    } finally {
      setIsExtracting(false)
    }
  }

  // 暂存待保存的值（用于处理异步状态更新）
  const pendingValues = useRef<Map<string, string>>(new Map())

  // 保存单个字段到后端
  const saveFieldToBackend = async (field: FileFieldValue, overrideValue?: string) => {
    console.log('[saveFieldToBackend] 开始保存:', field.fieldName, 'projectId:', projectId, 'fileId:', fileId)
    
    if (!projectId || !fileId) {
      console.error('[saveFieldToBackend] projectId 或 fileId 为空!')
      return
    }
    
    const valueToSave = overrideValue !== undefined ? overrideValue : field.value
    
    try {
      console.log('[saveFieldToBackend] 调用 API:', {
        fieldCode: field.fieldCode,
        fieldName: field.fieldName,
        value: valueToSave?.slice(0, 30),
        status: field.status,
      })
      
      await fieldValueService.batchUpdate(projectId, fileId, [{
        fieldCode: field.fieldCode,
        fieldName: field.fieldName,
        value: valueToSave,
        status: field.status,
        groupName: field.docTypeCode,
        evidenceRef: field.evidenceRef,
      }])
      console.log(`[saveFieldToBackend] 保存成功: ${field.fieldName}`)
    } catch (err) {
      console.error('[saveFieldToBackend] 保存失败:', err)
    }
  }

  const handleFieldChange = (fieldCode: string, value: string) => {
    // 暂存新值
    pendingValues.current.set(fieldCode, value)
    
    setFields((prev) =>
      prev.map((f) => (f.fieldCode === fieldCode ? { ...f, value, status: 'modified' } : f))
    )
  }

  const handleStatusChange = async (fieldCode: string, status: FileFieldValue['status']) => {
    console.log('[handleStatusChange] 被调用:', fieldCode, status)
    
    // 获取当前字段
    const currentField = fields.find(f => f.fieldCode === fieldCode)
    console.log('[handleStatusChange] 当前字段:', currentField?.fieldName, currentField?.value?.slice(0, 30))
    
    // 获取待保存的值（如果有的话）
    const pendingValue = pendingValues.current.get(fieldCode)
    
    // 更新本地状态
    const newValue = pendingValue !== undefined ? pendingValue : currentField?.value
    setFields((prev) =>
      prev.map((f) => (f.fieldCode === fieldCode ? { ...f, value: newValue ?? f.value, status } : f))
    )
    
    // 如果是确认状态，保存到后端
    if (status === 'confirmed' && currentField) {
      console.log('[handleStatusChange] 准备保存到后端...')
      await saveFieldToBackend({ ...currentField, status: 'confirmed' }, pendingValue)
      // 清除暂存值
      pendingValues.current.delete(fieldCode)
    } else {
      console.log('[handleStatusChange] 未保存:', status !== 'confirmed' ? '状态不是confirmed' : '找不到字段')
    }
  }

  const handleViewEvidence = (evidenceRef: EvidenceRef) => {
    if (evidenceRef.page) {
      setCurrentPage(evidenceRef.page)
    }
    setHighlightEvidence(evidenceRef)
  }

  const handleConfirmAll = async () => {
    console.log('[全部确认] 开始保存，字段数:', fields.length)
    
    const updated = fields.map((f) => ({ 
      ...f, 
      status: (f.value ? 'confirmed' : 'missing') as FileFieldValue['status']
    }))
    setFields(updated)
    
    // 保存到后端
    try {
      console.log('[全部确认] 调用 batchUpdate:', projectId, fileId)
      await fieldValueService.batchUpdate(
        projectId!,
        fileId!,
        updated.map(f => ({
          fieldCode: f.fieldCode,
          fieldName: f.fieldName,
          value: f.value,
          status: f.status,
          groupName: f.docTypeCode,
          evidenceRef: f.evidenceRef,
        }))
      )
      console.log('[全部确认] 保存成功')
    } catch (err) {
      console.error('[全部确认] 保存字段失败:', err)
    }
  }

  const pendingCount = fields.filter((f) => f.status === 'pending' || f.status === 'auto').length
  const confirmedCount = fields.filter((f) => f.status === 'confirmed').length

  // 加载中
  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  // 错误
  if (error) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-500">{error}</p>
        <Button variant="outline" onClick={() => navigate(-1)}>
          返回
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部操作栏 */}
      <div className="flex items-center justify-between border-b px-4 py-3">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <div className="text-sm">
            <span className="font-medium">{file?.fileName}</span>
            {file?.docTypeName && (
              <span className="ml-2 text-muted-foreground">({file.docTypeName})</span>
            )}
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {fields.length === 0 && !isExtracting && (
            <Button onClick={handleStartExtract}>
              开始提取
            </Button>
          )}
          {fields.length > 0 && (
            <>
              <span className="text-sm text-muted-foreground">
                已确认 {confirmedCount}/{fields.length}
              </span>
              <Button size="sm" onClick={handleConfirmAll} disabled={pendingCount === 0}>
                <Check className="mr-1 h-4 w-4" />
                全部确认
              </Button>
            </>
          )}
        </div>
      </div>

      {/* 提取进度 */}
      {isExtracting && (
        <div className="flex items-center gap-3 border-b bg-blue-50 px-4 py-3 text-blue-700">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{extractProgress}</span>
        </div>
      )}

      {/* 主体内容 */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* 左侧：文件预览 */}
        <ResizablePanel defaultSize={55} minSize={40}>
          <div className="h-full bg-muted/20 overflow-auto">
            {file?.fileId ? (
              // 根据文件类型选择预览方式
              (() => {
                const fileName = file.fileName?.toLowerCase() || ''
                const fileExt = fileName.match(/\.[^.]+$/)?.[0] || ''
                const previewUrl = `${getConfig().host}/api/fs/${file.fileId}${fileExt}`
                
                // PDF - iframe 预览
                if (fileName.endsWith('.pdf')) {
                  return (
                    <iframe
                      src={previewUrl}
                      className="h-full w-full border-0"
                      title={file.fileName}
                    />
                  )
                }
                
                // 图片 - img 标签预览
                if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(fileName)) {
                  return (
                    <div className="flex h-full items-center justify-center p-4">
                      <img
                        src={previewUrl}
                        alt={file.fileName}
                        className="max-w-full max-h-full object-contain rounded shadow-lg"
                      />
                    </div>
                  )
                }
                
                // Word/其他格式 - 显示下载提示
                return (
                  <div className="flex h-full flex-col items-center justify-center p-8">
                    <FileText className="h-20 w-20 text-primary/40" />
                    <p className="mt-6 text-lg font-medium text-center">{file?.fileName}</p>
                    {file?.docTypeName && (
                      <p className="mt-2 text-sm text-primary">{file.docTypeName}</p>
                    )}
                    <p className="mt-4 text-sm text-muted-foreground">
                      此格式暂不支持在线预览
                    </p>
                    <Button
                      variant="outline"
                      className="mt-6"
                      onClick={() => window.open(previewUrl, '_blank')}
                    >
                      <FileText className="mr-2 h-4 w-4" />
                      下载查看
                    </Button>
                  </div>
                )
              })()
            ) : (
              <div className="flex h-full flex-col items-center justify-center p-8">
                <FileText className="h-16 w-16 text-muted-foreground/50" />
                <p className="mt-4 font-medium">{file?.fileName}</p>
                <p className="text-sm text-muted-foreground">暂无预览</p>
              </div>
            )}
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右侧：字段列表 */}
        <ResizablePanel defaultSize={45} minSize={30}>
          <ScrollArea className="h-full p-4">
            {fields.length === 0 && !isExtracting ? (
              <div className="flex h-full flex-col items-center justify-center text-muted-foreground space-y-2">
                <p>暂无提取结果</p>
                {fieldDefs.length === 0 ? (
                  <p className="text-sm text-amber-600">
                    未找到"{file?.docTypeName || '未知类型'}"的字段定义
                    <br />
                    请先在数据中台配置该文件类型的字段
                  </p>
                ) : (
                  <p className="text-sm">点击"开始提取"开始智能提取关键信息</p>
                )}
              </div>
            ) : (
              <div className="space-y-3">
                {fields.map((field) => (
                  <FieldEditor
                    key={field.fieldCode}
                    fieldCode={field.fieldCode}
                    fieldName={field.fieldName}
                    value={field.value}
                    status={field.status}
                    evidenceRef={field.evidenceRef}
                    onValueChange={(v) => handleFieldChange(field.fieldCode, v)}
                    onStatusChange={(s) => handleStatusChange(field.fieldCode, s)}
                    onViewEvidence={handleViewEvidence}
                  />
                ))}
              </div>
            )}
          </ScrollArea>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}
