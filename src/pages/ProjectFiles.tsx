import { useState, useCallback, useEffect } from 'react'
import { useParams, Link, useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  Eye,
  Check,
  Loader2,
  ArrowLeft,
  AlertCircle,
  RefreshCw,
  FolderOpen,
  CheckCircle2,
  Clock,
  Trash2,
  MoreVertical,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { classifyService, projectFileService, projectService, docFieldDefService, fileFieldService, docTypeService } from '@/services'
import { extractService } from '@/services/extractService'
import { useTaskContext } from '@/contexts/TaskContext'
import { formatFileSize, cn } from '@/lib/utils'
import type { ProjectFile, DocFieldDef, DocType } from '@/types'

export function ProjectFiles() {
  const { id: projectId } = useParams()
  const navigate = useNavigate()
  const { addTask, updateTask, getProjectTasks } = useTaskContext()

  const [projectName, setProjectName] = useState('')
  const [files, setFiles] = useState<ProjectFile[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isDragging, setIsDragging] = useState(false)

  // 当前项目的任务
  const projectTasks = projectId ? getProjectTasks(projectId) : []
  const processingTasks = projectTasks.filter(t =>
    (t.status === 'running' || t.status === 'pending') &&
    (t.type === 'upload' || t.type === 'parse' || t.type === 'classify')
  )

  // 加载数据
  useEffect(() => {
    async function loadData() {
      if (!projectId) return
      try {
        setIsLoading(true)
        const [project, fileList] = await Promise.all([
          projectService.getById(projectId),
          projectFileService.getList(projectId).catch(() => []),
        ])
        setProjectName((project as any).name || project.projectName || '未命名项目')
        setFiles(fileList || [])
      } catch (error) {
        console.error('加载文件列表失败:', error)
      } finally {
        setIsLoading(false)
      }
    }
    loadData()
  }, [projectId])

  // 处理文件上传
  const handleFileDrop = useCallback(
    async (e: React.DragEvent) => {
      e.preventDefault()
      setIsDragging(false)
      const droppedFiles = Array.from(e.dataTransfer.files)
      await processFiles(droppedFiles)
    },
    [projectId, projectName]
  )

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const selectedFiles = Array.from(e.target.files || [])
      if (selectedFiles.length > 0) {
        await processFiles(selectedFiles)
      }
      // 清空 input 以便重复选择同一文件
      e.target.value = ''
    },
    [projectId, projectName]
  )

  /**
   * 处理文件 - 添加到任务队列后台处理
   */
  const processFiles = async (filesToProcess: File[]) => {
    if (!projectId) return

    for (const file of filesToProcess) {
      // 创建任务
      const taskId = addTask({
        projectId,
        projectName,
        type: 'classify',
        status: 'running',
        progress: 0,
        message: '准备上传...',
        fileName: file.name,
      })

      // 后台处理
      processFileInBackground(file, taskId)
    }
  }

  /**
   * 后台处理单个文件
   */
  const processFileInBackground = async (file: File, taskId: string) => {
    try {
      // 1. 上传
      updateTask(taskId, { progress: 10, message: '上传中...' })
      const { fileId, dsId } = await classifyService.uploadAndIndex(file)

      // 2. 解析
      updateTask(taskId, { progress: 30, message: '解析中...' })

      // 解析进度模拟
      let parseProgress = 30
      const parseInterval = setInterval(() => {
        parseProgress = Math.min(parseProgress + 5, 60)
        updateTask(taskId, { progress: parseProgress })
      }, 2000)

      await classifyService.waitForParsing(dsId)
      clearInterval(parseInterval)

      // 3. 分拣
      updateTask(taskId, { progress: 70, message: '智能分拣中...' })
      const classifyResult = await classifyService.classifyFile(fileId, file.name)
      
      // 打印分拣结果（便于调试）
      console.log('[分拣结果]', {
        fileName: file.name,
        docTypeCode: classifyResult.docTypeCode,
        docTypeName: classifyResult.docTypeName,
        rawResponse: classifyResult.rawResponse,
      })

      // 4. 保存
      updateTask(taskId, { progress: 90, message: '保存中...' })
      const savedFile = await projectFileService.add(projectId!, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileId,
        dsId,
        docTypeCode: classifyResult.docTypeCode,
        docTypeName: classifyResult.docTypeName,
        status: classifyResult.docTypeName ? 'classified' : 'pending',
      })

      // 5. 完成
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: classifyResult.docTypeName
          ? `分拣完成: ${classifyResult.docTypeName}`
          : `分拣完成（未识别类型）: ${classifyResult.rawResponse?.slice(0, 50) || '无返回'}`,
      })

      // 添加到文件列表
      setFiles(prev => [
        ...prev,
        {
          id: savedFile.id,
          projectId: projectId!,
          fileAssetId: fileId,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          sha256: '',
          docTypeCode: classifyResult.docTypeCode,
          docTypeName: classifyResult.docTypeName,
          status: classifyResult.docTypeName ? 'classified' : 'pending',
          extractionStatus: 'pending',
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
        },
      ])
    } catch (error) {
      updateTask(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : '处理失败',
      })
    }
  }

  // 确认分类并开始提取
  const handleConfirm = async (fileId: string) => {
    const file = files.find(f => f.id === fileId)
    if (!file) return

    try {
      // 1. 更新状态为已确认
      await projectFileService.update(projectId!, fileId, { status: 'confirmed' })
      setFiles(prev =>
        prev.map(f => (f.id === fileId ? { ...f, status: 'confirmed', extractionStatus: 'processing' } : f))
      )

      // 2. 如果有文件类型名称，自动开始提取
      if (file.docTypeName) {
        startExtraction(file)
      }
    } catch (error) {
      console.error('确认失败:', error)
    }
  }

  // 开始提取字段（后台运行，不依赖组件生命周期）
  const startExtraction = (file: ProjectFile) => {
    if (!projectId || !file.docTypeName) return

    // 复制必要的数据到局部变量，避免闭包问题
    const currentProjectId = projectId
    const currentProjectName = projectName
    const currentFile = { ...file }

    // 创建提取任务
    const taskId = addTask({
      projectId: currentProjectId,
      projectName: currentProjectName,
      type: 'extract',
      status: 'running',
      progress: 0,
      message: '获取字段定义...',
      fileName: currentFile.fileName,
    })

    // 立即返回，让提取在后台异步运行
    runExtraction(taskId, currentProjectId, currentFile)
  }

  // 实际的提取逻辑（独立函数，不依赖组件状态）
  const runExtraction = async (taskId: string, currentProjectId: string, file: ProjectFile) => {
    try {
      // 1. 根据 docTypeName 找到对应的 docTypeId
      updateTask(taskId, { progress: 5, message: '查询文件类型...' })
      const allDocTypes = await docTypeService.getAll()
      
      // 匹配文件类型
      const docTypeName = file.docTypeName!
      let matchedDocType: DocType | undefined = allDocTypes.find(dt => 
        dt.name === docTypeName ||
        (file.docTypeCode && file.docTypeCode.endsWith(dt.name))
      )
      
      if (!matchedDocType) {
        matchedDocType = allDocTypes.find(dt => 
          dt.name && docTypeName.includes(dt.name)
        )
      }

      if (!matchedDocType) {
        console.warn(`[提取] 未找到匹配的文件类型: ${docTypeName}`)
        updateTask(taskId, { 
          status: 'failed', 
          error: `未找到文件类型 "${docTypeName}" 的字段定义`
        })
        return
      }

      console.log(`[提取] 匹配到文件类型: ${matchedDocType.name}, ID: ${matchedDocType.id}`)

      // 2. 获取该文件类型的字段定义
      updateTask(taskId, { progress: 10, message: '获取字段定义...' })
      const fieldDefs = await docFieldDefService.getByDocType(matchedDocType.id)
      
      if (fieldDefs.length === 0) {
        updateTask(taskId, { 
          status: 'completed', 
          progress: 100, 
          message: '无需提取的字段' 
        })
        return
      }

      // 3. 更新提取状态
      await projectFileService.update(currentProjectId, file.id, { extractionStatus: 'processing' })

      // 4. 逐个提取字段
      const extractedFields: Array<{
        fieldCode: string
        fieldName: string
        value: string | null
        status: string
        groupName?: string
        evidenceRef?: { page?: number; bbox?: any } | null
      }> = []

      for (let i = 0; i < fieldDefs.length; i++) {
        const fieldDef = fieldDefs[i]
        const progress = 10 + Math.round((i / fieldDefs.length) * 80)
        updateTask(taskId, { 
          progress, 
          message: `提取 ${fieldDef.fieldName} (${i + 1}/${fieldDefs.length})` 
        })

        try {
          const result = await extractService.extractField({
            fileId: file.fileAssetId || (file as any).fileId,
            定位词: fieldDef.anchorWord || undefined,
            字段名称: fieldDef.fieldName,
            字段类别: fieldDef.fieldCategory,
            取值方式: fieldDef.valueSource || '自动',
            提取方法: fieldDef.extractMethod || undefined,
            枚举值: fieldDef.enumOptions || undefined,
            示例数据: fieldDef.exampleValue || undefined,
            字段说明: fieldDef.fieldDescription || undefined,
            输出格式: fieldDef.outputFormat || undefined,
          })

          extractedFields.push({
            fieldCode: fieldDef.fieldCode,
            fieldName: fieldDef.fieldName,
            value: result.value,
            status: result.value ? 'auto' : 'missing',
            groupName: file.docTypeName || undefined,
            evidenceRef: result.evidenceRef,
          })
        } catch (err) {
          console.error(`提取字段 ${fieldDef.fieldName} 失败:`, err)
          extractedFields.push({
            fieldCode: fieldDef.fieldCode,
            fieldName: fieldDef.fieldName,
            value: null,
            status: 'missing',
            groupName: file.docTypeName || undefined,
          })
        }
      }

      // 5. 批量保存提取结果
      updateTask(taskId, { progress: 95, message: '保存提取结果...' })
      await fileFieldService.batchUpdate(currentProjectId, file.id, extractedFields)

      // 6. 更新文件状态
      await projectFileService.update(currentProjectId, file.id, { extractionStatus: 'completed' })
      
      // 尝试更新组件状态（如果组件已卸载会静默失败）
      try {
        setFiles(prev =>
          prev.map(f => (f.id === file.id ? { ...f, extractionStatus: 'completed' } : f))
        )
      } catch {
        // 组件可能已卸载，忽略
      }

      updateTask(taskId, { 
        status: 'completed', 
        progress: 100, 
        message: `提取完成，共 ${extractedFields.filter(f => f.value).length}/${extractedFields.length} 个字段` 
      })
    } catch (error) {
      console.error('提取失败:', error)
      updateTask(taskId, { 
        status: 'failed', 
        error: error instanceof Error ? error.message : '提取失败' 
      })
      
      // 更新文件状态为失败
      try {
        await projectFileService.update(currentProjectId, file.id, { extractionStatus: 'failed' })
        setFiles(prev =>
          prev.map(f => (f.id === file.id ? { ...f, extractionStatus: 'failed' } : f))
        )
      } catch {
        // 忽略
      }
    }
  }

  // 全部确认
  const handleConfirmAll = async () => {
    const toConfirm = files.filter(f => f.status === 'classified' || f.status === 'pending')
    for (const file of toConfirm) {
      await handleConfirm(file.id)
    }
  }

  // 重试分拣
  const handleRetryClassify = async (file: ProjectFile) => {
    // 获取智能体平台的文件ID（可能是 fileAssetId 或 fileId）
    const agentFileId = file.fileAssetId || (file as any).fileId
    
    if (!projectId || !agentFileId) {
      console.error('[重试分拣] 缺少 fileId:', file)
      alert('文件信息不完整，无法重试')
      return
    }

    const taskId = addTask({
      projectId,
      projectName,
      type: 'classify',
      status: 'running',
      progress: 0,
      message: '重新分拣中...',
      fileName: file.fileName,
    })

    try {
      updateTask(taskId, { progress: 50, message: '智能分拣中...' })
      const classifyResult = await classifyService.classifyFile(agentFileId, file.fileName)
      
      console.log('[重试分拣结果]', classifyResult)

      // 更新数据库
      await projectFileService.update(projectId, file.id, {
        docTypeCode: classifyResult.docTypeCode,
        docTypeName: classifyResult.docTypeName,
        status: classifyResult.docTypeName ? 'classified' : 'pending',
      })

      // 更新本地状态
      setFiles(prev =>
        prev.map(f =>
          f.id === file.id
            ? {
                ...f,
                docTypeCode: classifyResult.docTypeCode || undefined,
                docTypeName: classifyResult.docTypeName || undefined,
                status: classifyResult.docTypeName ? 'classified' : 'pending',
              }
            : f
        )
      )

      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: classifyResult.docTypeName
          ? `分拣完成: ${classifyResult.docTypeName}`
          : `分拣完成（未识别）`,
      })
    } catch (error) {
      updateTask(taskId, {
        status: 'failed',
        error: error instanceof Error ? error.message : '分拣失败',
      })
    }
  }

  // 重试提取
  const handleRetryExtract = (file: ProjectFile) => {
    const agentFileId = file.fileAssetId || (file as any).fileId
    
    if (!agentFileId) {
      alert('文件信息不完整，无法提取')
      return
    }
    
    if (!file.docTypeName) {
      alert('请先确认文件类型')
      return
    }
    
    // 重置提取状态
    setFiles(prev =>
      prev.map(f => (f.id === file.id ? { ...f, extractionStatus: 'pending' } : f))
    )
    
    startExtraction(file)
  }

  // 删除文件
  const handleDeleteFile = async (fileId: string) => {
    if (!projectId) return
    if (!confirm('确定要删除这个文件吗？相关的提取数据也会被删除。')) return

    try {
      await projectFileService.delete(projectId, fileId)
      setFiles(prev => prev.filter(f => f.id !== fileId))
    } catch (error) {
      console.error('删除文件失败:', error)
      alert('删除失败')
    }
  }

  const pendingCount = files.filter(f => f.status === 'pending' || f.status === 'classified').length
  const confirmedCount = files.filter(f => f.status === 'confirmed').length

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* 导航 */}
      <Button
        variant="ghost"
        size="sm"
        className="mb-4 -ml-2"
        onClick={() => navigate(`/projects/${projectId}`)}
      >
        <ArrowLeft className="mr-1 h-4 w-4" />
        返回项目
      </Button>

      {/* 标题 */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">资料管理</h1>
          <p className="text-sm text-muted-foreground">
            {projectName} · {files.length} 个文件
            {pendingCount > 0 && `，${pendingCount} 个待确认`}
          </p>
        </div>

        <div className="flex items-center gap-2">
          {pendingCount > 0 && (
            <Button variant="outline" size="sm" onClick={handleConfirmAll}>
              <Check className="mr-1 h-4 w-4" />
              全部确认
            </Button>
          )}
        </div>
      </div>

      {/* 上传区域 */}
      <div
        className={cn(
          'mb-6 rounded-xl border-2 border-dashed p-8 transition-all',
          isDragging
            ? 'border-primary bg-primary/5 scale-[1.02]'
            : 'border-muted-foreground/25 hover:border-primary/50'
        )}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={handleFileDrop}
      >
        <label className="flex cursor-pointer flex-col items-center gap-3 text-center">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
            <Upload className="h-7 w-7 text-primary" />
          </div>
          <div>
            <p className="font-medium">拖拽文件或点击上传</p>
            <p className="text-sm text-muted-foreground">
              支持 PDF、Word、图片等格式，可多选
            </p>
          </div>
          <input
            type="file"
            className="hidden"
            multiple
            accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
            onChange={handleFileSelect}
          />
        </label>
      </div>

      {/* 处理中的任务 */}
      {processingTasks.length > 0 && (
        <div className="mb-6 rounded-xl border bg-blue-50/50 p-4">
          <div className="mb-3 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-blue-600" />
            <span className="font-medium text-blue-900">
              正在处理 ({processingTasks.length})
            </span>
            <span className="text-sm text-blue-600">
              可以离开此页面，处理会在后台继续
            </span>
          </div>
          <div className="space-y-2">
            {processingTasks.map(task => (
              <div
                key={task.id}
                className="flex items-center gap-3 rounded-lg border border-blue-200 bg-white p-3"
              >
                <FileText className="h-5 w-5 text-blue-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{task.fileName}</p>
                  <p className="text-xs text-muted-foreground">{task.message}</p>
                </div>
                <div className="flex items-center gap-2 w-28">
                  <Progress value={task.progress} className="h-1.5 flex-1" />
                  <span className="text-xs text-blue-600 w-8">{task.progress}%</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 文件列表 */}
      {files.length > 0 ? (
        <div className="space-y-2">
          {files.map(file => (
            <div
              key={file.id}
              className={cn(
                'flex items-center gap-4 rounded-xl border p-4 transition-colors',
                file.status === 'confirmed' && 'bg-green-50/50 border-green-200',
                (file.status === 'classified' || file.status === 'pending') &&
                  'bg-amber-50/50 border-amber-200'
              )}
            >
              {/* 图标 */}
              <div
                className={cn(
                  'flex h-10 w-10 items-center justify-center rounded-lg shrink-0',
                  file.status === 'confirmed'
                    ? 'bg-green-100'
                    : 'bg-muted'
                )}
              >
                {file.status === 'confirmed' ? (
                  <CheckCircle2 className="h-5 w-5 text-green-600" />
                ) : (
                  <FileText className="h-5 w-5 text-muted-foreground" />
                )}
              </div>

              {/* 文件信息 */}
              <div className="min-w-0 flex-1">
                <p className="font-medium truncate">{file.fileName}</p>
                <p className="text-sm text-muted-foreground">
                  {formatFileSize(file.fileSize)}
                </p>
              </div>

              {/* 分类结果 */}
              <div className="min-w-[140px]">
                {file.docTypeName ? (
                  <Badge
                    variant="secondary"
                    className="gap-1 bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    <FolderOpen className="h-3 w-3" />
                    {file.docTypeName}
                  </Badge>
                ) : (
                  <span className="text-sm text-muted-foreground">未分类</span>
                )}
              </div>

              {/* 状态 */}
              <FileStatusBadge status={file.status} extractionStatus={file.extractionStatus} />

              {/* 操作 */}
              <div className="flex items-center gap-1">
                {(file.status === 'classified' || file.status === 'pending') && (
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-green-600 hover:text-green-700 hover:bg-green-100"
                    onClick={() => handleConfirm(file.id)}
                    title="确认分类"
                  >
                    <Check className="h-4 w-4" />
                  </Button>
                )}
                <Button variant="ghost" size="icon" asChild>
                  <Link to={`/projects/${projectId}/files/${file.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
                
                {/* 更多操作 */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon">
                      <MoreVertical className="h-4 w-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem onClick={() => handleRetryClassify(file)}>
                      <RotateCcw className="mr-2 h-4 w-4" />
                      重新分拣
                    </DropdownMenuItem>
                    {file.status === 'confirmed' && (
                      <DropdownMenuItem onClick={() => handleRetryExtract(file)}>
                        <RefreshCw className="mr-2 h-4 w-4" />
                        重新提取
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-red-600 focus:text-red-600"
                      onClick={() => handleDeleteFile(file.id)}
                    >
                      <Trash2 className="mr-2 h-4 w-4" />
                      删除文件
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="py-12 text-center">
          <FileText className="mx-auto h-16 w-16 text-muted-foreground/30" />
          <p className="mt-4 text-muted-foreground">暂无文件</p>
          <p className="text-sm text-muted-foreground">上传文件后将自动进行智能分拣</p>
        </div>
      )}
    </div>
  )
}

// 文件状态徽章 - 显示分拣确认+提取状态
function FileStatusBadge({ status, extractionStatus }: { status: string; extractionStatus?: string }) {
  // 优先显示提取状态
  if (extractionStatus === 'completed') {
    return (
      <Badge className="gap-1 bg-green-100 text-green-700">
        <CheckCircle2 className="h-3 w-3" />
        已提取
      </Badge>
    )
  }
  if (extractionStatus === 'processing') {
    return (
      <Badge className="gap-1 bg-blue-100 text-blue-700">
        <Loader2 className="h-3 w-3 animate-spin" />
        提取中
      </Badge>
    )
  }
  if (status === 'confirmed') {
    return (
      <Badge className="gap-1 bg-indigo-100 text-indigo-700">
        <Clock className="h-3 w-3" />
        待提取
      </Badge>
    )
  }
  if (status === 'classified') {
    return (
      <Badge className="gap-1 bg-amber-100 text-amber-700">
        <Clock className="h-3 w-3" />
        待确认
      </Badge>
    )
  }
  return (
    <Badge variant="outline" className="gap-1">
      <Clock className="h-3 w-3" />
      待分拣
    </Badge>
  )
}
