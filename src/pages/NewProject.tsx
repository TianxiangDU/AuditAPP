import { useState, useCallback, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Upload,
  FileText,
  Loader2,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  Plus,
  Cloud,
  FileSearch,
  Brain,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Progress } from '@/components/ui/progress'
import { tenderService, projectService, projectFileService, extractService, fieldValueService } from '@/services'
import { useTaskContext } from '@/contexts/TaskContext'
import { cn } from '@/lib/utils'
import type { ExtractFieldDef } from '@/types'

type ProcessingStage = 'idle' | 'creating' | 'uploading' | 'parsing' | 'extracting' | 'done' | 'error'

export function NewProject() {
  const navigate = useNavigate()
  const { addTask, updateTask } = useTaskContext()

  // 文件状态
  const [file, setFile] = useState<File | null>(null)
  const [projectName, setProjectName] = useState('')
  const [isDragging, setIsDragging] = useState(false)

  // 处理状态
  const [stage, setStage] = useState<ProcessingStage>('idle')
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [createdProject, setCreatedProject] = useState<{ id: string; name: string } | null>(null)

  // 处理文件拖放
  const handleFileDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    const droppedFiles = e.dataTransfer.files
    if (droppedFiles.length > 0) {
      handleFileSelect(droppedFiles[0])
    }
  }, [])

  // 处理文件选择
  const handleFileSelect = (selectedFile: File) => {
    setFile(selectedFile)
    setError(null)
    setStage('idle')
    // 从文件名提取项目名称
    const baseName = selectedFile.name.replace(/\.[^/.]+$/, '')
    setProjectName(baseName)
  }

  // 处理文件输入
  const handleFileInputChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFileSelect(files[0])
    }
  }, [])

  // 创建项目并开始处理
  const handleCreateProject = async () => {
    if (!file) {
      setError('请先选择文件')
      return
    }

    const finalName = projectName.trim() || file.name.replace(/\.[^/.]+$/, '')
    if (!finalName) {
      setError('请输入项目名称')
      return
    }

    setError(null)
    setStage('creating')
    setProgress(0)

    try {
      // 1. 创建草稿项目
      const result = await projectService.create({
        name: finalName,
        tenderFileId: null,
        tenderDsId: null,
        fields: [],
      })

      setCreatedProject(result)

      // 2. 更新状态为上传中
      setStage('uploading')
      setProgress(10)
      await projectService.update(result.id, { status: 'uploading' })

      // 创建后台任务（用于任务中心显示）
      const taskId = addTask({
        projectId: result.id,
        projectName: finalName,
        type: 'upload',
        status: 'running',
        progress: 10,
        message: '上传文件中...',
        fileName: file.name,
      })

      // 3. 上传文件
      const uploadResult = await extractService.uploadAndIndex(file)
      
      // 更新项目文件信息（包含预览 URL）
      await projectService.update(result.id, {
        tenderFileId: uploadResult.fileId,
        tenderDsId: uploadResult.dsId,
        tenderFileUrl: uploadResult.fileUrl,
        status: 'parsing',
      })

      // 同时将招标文件添加到项目文件列表（标记为招标文件）
      const tenderFileRecord = await projectFileService.add(result.id, {
        fileName: file.name,
        fileSize: file.size,
        mimeType: file.type,
        fileId: uploadResult.fileId,
        dsId: uploadResult.dsId,
        docTypeCode: '招标文件',
        docTypeName: '招标文件',
        isTender: true,  // 标记为招标文件
        status: 'confirmed',
      })
      
      // 保存招标文件的 file record id，后续用于保存字段
      const tenderFileRecordId = tenderFileRecord.id

      // 4. 解析文档
      setStage('parsing')
      setProgress(30)
      updateTask(taskId, { progress: 30, message: '解析文档中...', type: 'parse' })

      // 模拟解析进度
      const progressInterval = setInterval(() => {
        setProgress(prev => Math.min(prev + 3, 55))
      }, 1500)

      await extractService.waitForParsing(uploadResult.dsId)
      clearInterval(progressInterval)

      // 5. 提取关键信息
      setStage('extracting')
      setProgress(60)
      await projectService.update(result.id, { status: 'extracting' })
      updateTask(taskId, { progress: 60, message: '智能提取中...', type: 'extract' })

      // 获取字段定义
      let fieldDefs: ExtractFieldDef[] = []
      try {
        fieldDefs = await tenderService.getFieldDefinitions()
      } catch {
        // 使用默认
      }

      // 提取字段
      const total = fieldDefs.length || 1
      let completed = 0
      const extractedFields: Array<{
        fieldCode: string
        fieldName: string
        value: string | null
        status: string
        groupName?: string
      }> = []

      for (const def of fieldDefs) {
        try {
          const extractResult = await extractService.extractField({
            fileId: uploadResult.fileId,
            字段名称: def.fieldName,
            字段类别: def.fieldCategory || '基本信息',
            取值方式: def.valueSource || '直接提取',
            字段说明: def.fieldDescription || def.fieldName,
            输出格式: def.outputFormat || '字符串',
            定位词: def.anchorWord,
            提取方法: def.extractMethod,
          })

          // 收集提取结果
          extractedFields.push({
            fieldCode: def.fieldCode || def.fieldName,
            fieldName: def.fieldName,
            value: extractResult.value,
            status: extractResult.value ? 'auto' : 'pending',
            groupName: def.fieldCategory,
          })

          // 如果是项目名称且提取成功，更新项目名称
          if (def.fieldName === '项目名称' && extractResult.value) {
            await projectService.update(result.id, { name: extractResult.value })
            setCreatedProject(prev => prev ? { ...prev, name: extractResult.value } : null)
          }
        } catch (err) {
          console.error(`提取字段 ${def.fieldName} 失败:`, err)
          // 记录失败的字段
          extractedFields.push({
            fieldCode: def.fieldCode || def.fieldName,
            fieldName: def.fieldName,
            value: null,
            status: 'pending',
            groupName: def.fieldCategory,
          })
        }

        completed++
        const newProgress = 60 + Math.round((completed / total) * 35)
        setProgress(newProgress)
        updateTask(taskId, {
          progress: newProgress,
          message: `提取中 (${completed}/${total})`,
        })
      }

      // 批量保存提取结果到 file_fields 表（使用招标文件的记录ID）
      if (extractedFields.length > 0) {
        try {
          await fieldValueService.batchUpdate(result.id, tenderFileRecordId, extractedFields)
          console.log(`[新建项目] 已保存 ${extractedFields.length} 个字段到 file_fields`)
          
          // 更新招标文件的提取状态为已完成
          await projectFileService.update(result.id, tenderFileRecordId, { extractionStatus: 'completed' })
        } catch (saveErr) {
          console.error('保存提取结果失败:', saveErr)
        }
      }

      // 6. 完成，更新状态为待确认
      setProgress(100)
      setStage('done')
      await projectService.update(result.id, { status: 'confirming' })
      updateTask(taskId, {
        status: 'completed',
        progress: 100,
        message: '处理完成，待确认',
      })

    } catch (err) {
      console.error('处理失败:', err)
      setError(err instanceof Error ? err.message : '处理失败')
      setStage('error')

      // 如果已创建项目，更新状态为错误
      if (createdProject) {
        try {
          await projectService.update(createdProject.id, { status: 'error' })
        } catch {
          // ignore
        }
      }
    }
  }

  // 继续创建下一个
  const handleCreateAnother = () => {
    setFile(null)
    setProjectName('')
    setCreatedProject(null)
    setError(null)
    setStage('idle')
    setProgress(0)
  }

  // 查看已创建的项目
  const handleViewProject = () => {
    if (createdProject) {
      navigate(`/projects/${createdProject.id}/confirm`)
    }
  }

  // 获取当前阶段信息
  const getStageInfo = () => {
    switch (stage) {
      case 'creating':
        return { icon: Loader2, label: '创建项目...', color: 'text-blue-600' }
      case 'uploading':
        return { icon: Cloud, label: '上传文件到知识库...', color: 'text-blue-600' }
      case 'parsing':
        return { icon: FileSearch, label: '解析文档内容...', color: 'text-indigo-600' }
      case 'extracting':
        return { icon: Brain, label: '智能体提取关键信息...', color: 'text-purple-600' }
      case 'done':
        return { icon: CheckCircle2, label: '处理完成', color: 'text-green-600' }
      case 'error':
        return { icon: AlertCircle, label: '处理失败', color: 'text-red-600' }
      default:
        return null
    }
  }

  const stageInfo = getStageInfo()
  const isProcessing = ['creating', 'uploading', 'parsing', 'extracting'].includes(stage)

  return (
    <div className="p-6 max-w-2xl mx-auto">
      {/* 标题 */}
      <div className="mb-8 text-center">
        <h1 className="text-2xl font-bold">新建审计项目</h1>
        <p className="mt-2 text-muted-foreground">
          上传招标文件，系统将在后台自动提取关键信息
        </p>
      </div>

      {/* 错误提示 */}
      {error && stage !== 'error' && (
        <div className="mb-6 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-4 text-red-700">
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* 处理中界面 */}
      {isProcessing && stageInfo && (
        <div className="rounded-xl border bg-card p-8">
          {/* 阶段指示器 */}
          <div className="flex items-center justify-center gap-3 mb-8">
            {['uploading', 'parsing', 'extracting'].map((s, index) => {
              const stages = ['uploading', 'parsing', 'extracting']
              const currentIndex = stages.indexOf(stage)
              const isActive = s === stage
              const isDone = stages.indexOf(s) < currentIndex
              
              return (
                <div key={s} className="flex items-center">
                  <div
                    className={cn(
                      'flex h-10 w-10 items-center justify-center rounded-full transition-colors',
                      isActive && 'bg-primary text-primary-foreground',
                      isDone && 'bg-green-100 text-green-600',
                      !isActive && !isDone && 'bg-muted text-muted-foreground'
                    )}
                  >
                    {isDone ? (
                      <CheckCircle2 className="h-5 w-5" />
                    ) : s === 'uploading' ? (
                      <Cloud className={cn('h-5 w-5', isActive && 'animate-pulse')} />
                    ) : s === 'parsing' ? (
                      <FileSearch className={cn('h-5 w-5', isActive && 'animate-pulse')} />
                    ) : (
                      <Brain className={cn('h-5 w-5', isActive && 'animate-pulse')} />
                    )}
                  </div>
                  {index < 2 && (
                    <div
                      className={cn(
                        'w-16 h-1 mx-2 rounded',
                        isDone ? 'bg-green-200' : 'bg-muted'
                      )}
                    />
                  )}
                </div>
              )
            })}
          </div>

          {/* 当前状态 */}
          <div className="text-center mb-6">
            <stageInfo.icon className={cn('mx-auto h-12 w-12 animate-spin', stageInfo.color)} />
            <p className={cn('mt-4 text-lg font-medium', stageInfo.color)}>
              {stageInfo.label}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{file?.name}</p>
          </div>

          {/* 进度条 */}
          <div className="mx-auto max-w-sm">
            <Progress value={progress} className="h-2" />
            <p className="mt-2 text-center text-sm text-muted-foreground">{progress}%</p>
          </div>

          {/* 提示 */}
          <p className="mt-6 text-center text-sm text-muted-foreground">
            处理过程中可以切换页面，进度会在任务中心显示
          </p>
        </div>
      )}

      {/* 完成界面 */}
      {stage === 'done' && createdProject && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100">
              <CheckCircle2 className="h-6 w-6 text-green-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-green-800">处理完成</h3>
              <p className="mt-1 text-green-700">
                「{createdProject.name}」已创建成功，请确认提取的关键信息
              </p>
              <div className="mt-4 flex gap-3">
                <Button onClick={handleViewProject}>
                  确认信息
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
                <Button variant="outline" onClick={handleCreateAnother}>
                  <Plus className="mr-2 h-4 w-4" />
                  继续创建
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 错误界面 */}
      {stage === 'error' && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100">
              <AlertCircle className="h-6 w-6 text-red-600" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-red-800">处理失败</h3>
              <p className="mt-1 text-red-700">{error || '未知错误'}</p>
              <div className="mt-4 flex gap-3">
                <Button onClick={handleCreateProject}>
                  重试
                </Button>
                <Button variant="outline" onClick={handleCreateAnother}>
                  重新选择文件
                </Button>
                {createdProject && (
                  <Button variant="ghost" onClick={handleViewProject}>
                    查看项目
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 上传界面（初始状态） */}
      {stage === 'idle' && (
        <>
          {/* 文件拖放区 */}
          <div
            className={cn(
              'rounded-xl border-2 border-dashed p-8 transition-all text-center',
              isDragging
                ? 'border-primary bg-primary/5 scale-[1.02]'
                : 'border-muted-foreground/25 hover:border-primary/50',
              file && 'border-solid border-primary/50 bg-primary/5'
            )}
            onDragOver={(e) => {
              e.preventDefault()
              setIsDragging(true)
            }}
            onDragLeave={() => setIsDragging(false)}
            onDrop={handleFileDrop}
          >
            {!file ? (
              <label className="flex cursor-pointer flex-col items-center gap-4">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10">
                  <Upload className="h-8 w-8 text-primary" />
                </div>
                <div>
                  <p className="text-lg font-medium">拖拽招标文件或点击上传</p>
                  <p className="mt-1 text-sm text-muted-foreground">支持 PDF、Word 格式</p>
                </div>
                <input
                  type="file"
                  className="hidden"
                  accept=".pdf,.doc,.docx"
                  onChange={handleFileInputChange}
                />
              </label>
            ) : (
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-primary/10 shrink-0">
                  <FileText className="h-6 w-6 text-primary" />
                </div>
                <div className="flex-1 min-w-0 text-left">
                  <p className="font-medium truncate">{file.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation()
                    setFile(null)
                    setProjectName('')
                  }}
                >
                  重选
                </Button>
              </div>
            )}
          </div>

          {/* 项目名称 */}
          {file && (
            <div className="mt-6">
              <Label htmlFor="projectName" className="text-base">
                项目名称
              </Label>
              <p className="text-sm text-muted-foreground mb-2">
                已从文件名自动生成，处理完成后将更新为实际项目名
              </p>
              <Input
                id="projectName"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                placeholder="输入项目名称"
                className="text-lg h-12"
              />
            </div>
          )}

          {/* 操作按钮 */}
          {file && (
            <div className="mt-6 flex justify-end">
              <Button size="lg" onClick={handleCreateProject} disabled={!file}>
                创建项目
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          )}

          {/* 提示 */}
          {file && (
            <p className="mt-4 text-center text-sm text-muted-foreground">
              项目创建后可以切换页面，处理会在后台继续进行
            </p>
          )}
        </>
      )}
    </div>
  )
}
