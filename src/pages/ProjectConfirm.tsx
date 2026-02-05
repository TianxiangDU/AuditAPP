import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import {
  ArrowLeft,
  Check,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  ArrowRight,
  X,
  ChevronDown,
  ChevronRight,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { ScrollArea } from '@/components/ui/scroll-area'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@/components/ui/collapsible'
import {
  ResizableHandle,
  ResizablePanel,
  ResizablePanelGroup,
} from '@/components/ui/resizable'
import { projectService, projectFileService, fieldValueService, tenderService } from '@/services'
import { getConfig } from '@/services/agentConfig'
import { cn } from '@/lib/utils'

/**
 * 清理字段值，移除 JSON 格式残留
 */
function cleanFieldValue(value: string | null | undefined): string | null {
  if (!value) return null
  
  let cleaned = String(value).trim()
  
  // 尝试解析为 JSON 并提取值
  try {
    const parsed = JSON.parse(cleaned)
    if (typeof parsed === 'object' && parsed !== null) {
      // 如果是对象，取第一个值
      const keys = Object.keys(parsed)
      if (keys.length === 1) {
        const innerValue = parsed[keys[0]]
        cleaned = typeof innerValue === 'object' ? JSON.stringify(innerValue) : String(innerValue)
      }
    } else if (typeof parsed === 'string') {
      cleaned = parsed
    }
  } catch {
    // 不是 JSON，继续处理
  }
  
  // 匹配 "key": "value" 格式并提取 value
  const kvMatch = cleaned.match(/^"[^"]+"\s*:\s*"([^"]*)"$/)
  if (kvMatch) {
    cleaned = kvMatch[1]
  }
  
  // 移除外层引号
  if (cleaned.startsWith('"') && cleaned.endsWith('"') && cleaned.length > 2) {
    cleaned = cleaned.slice(1, -1)
  }
  
  return cleaned || null
}

interface FieldValue {
  fieldCode: string
  fieldName: string
  value: string | null
  status: 'auto' | 'modified' | 'confirmed' | 'missing'
  groupName?: string
}

interface ProjectData {
  id: string
  name: string
  status: string
  tenderFileId?: string
  tenderDsId?: number
  tenderFileUrl?: string
}

export function ProjectConfirm() {
  const { id } = useParams()
  const navigate = useNavigate()

  // 项目数据
  const [project, setProject] = useState<ProjectData | null>(null)
  const [isLoadingProject, setIsLoadingProject] = useState(true)

  // 字段数据
  const [fields, setFields] = useState<FieldValue[]>([])
  const [isLoadingFields, setIsLoadingFields] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // 编辑状态
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  
  // 保存状态
  const [isSaving, setIsSaving] = useState(false)

  // 分组展开状态
  const [expandedGroups, setExpandedGroups] = useState<Set<string>>(new Set())

  // 加载项目
  useEffect(() => {
    async function loadProject() {
      if (!id) return
      try {
        setIsLoadingProject(true)
        const data = await projectService.getById(id)
        setProject({
          id: data.id,
          name: (data as any).name || data.projectName || '未命名项目',
          status: data.status,
          tenderFileId: (data as any).tenderFileId,
          tenderDsId: (data as any).tenderDsId,
          tenderFileUrl: (data as any).tenderFileUrl,
        })
      } catch (err) {
        console.error('加载项目失败:', err)
        setError('加载项目失败')
      } finally {
        setIsLoadingProject(false)
      }
    }
    loadProject()
  }, [id])

  // 招标文件记录 ID（用于保存字段）
  const [tenderFileRecordId, setTenderFileRecordId] = useState<string | null>(null)

  // 加载字段
  const loadFields = async () => {
    if (!id) return
    try {
      setIsLoadingFields(true)
      setError(null)

      // 1. 获取招标文件的记录（从 project_files 表找到 is_tender=true 的文件）
      const files = await projectFileService.getList(id)
      const tenderFile = files.find(f => (f as any).isTender || f.docTypeName === '招标文件')
      
      if (!tenderFile) {
        console.warn('未找到招标文件记录')
        // 仍然尝试加载字段定义
      } else {
        setTenderFileRecordId(tenderFile.id)
      }

      // 2. 从中台获取字段定义
      let fieldDefs: Array<{ fieldCode: string; fieldName: string; fieldCategory?: string }> = []
      try {
        const defs = await tenderService.getFieldDefinitions()
        fieldDefs = defs.map(d => ({
          fieldCode: d.fieldCode || d.fieldName,
          fieldName: d.fieldName,
          fieldCategory: d.fieldCategory,
        }))
      } catch (err) {
        console.error('获取字段定义失败:', err)
      }

      // 3. 从 file_fields 获取已提取的字段值
      let extractedData: Array<{
        fieldCode: string
        fieldName: string
        value: string | null
        status: string
        groupName?: string
      }> = []
      
      if (tenderFile) {
        try {
          const data = await fieldValueService.getByFile(id, tenderFile.id)
          extractedData = data.map(f => ({
            fieldCode: f.fieldCode,
            fieldName: f.fieldName,
            value: f.value,
            status: f.status,
            groupName: f.groupName,
          }))
          console.log(`[确认页] 从 file_fields 加载了 ${extractedData.length} 个字段`)
        } catch (err) {
          console.error('获取文件字段失败:', err)
        }
      }
      
      const extractedMap = new Map(
        extractedData.map(f => [f.fieldCode || f.fieldName, f])
      )

      // 4. 合并
      let mergedFields: FieldValue[] = []

      if (fieldDefs.length > 0) {
        mergedFields = fieldDefs.map(def => {
          const extracted = extractedMap.get(def.fieldCode) || extractedMap.get(def.fieldName)
          return {
            fieldCode: def.fieldCode,
            fieldName: def.fieldName,
            value: cleanFieldValue(extracted?.value),
            status: (extracted?.status || 'auto') as 'auto' | 'modified' | 'confirmed' | 'missing',
            groupName: def.fieldCategory || '其他',
          }
        })
      } else if (extractedData.length > 0) {
        // 没有字段定义时，直接使用提取的数据
        mergedFields = extractedData.map(f => ({
          fieldCode: f.fieldCode,
          fieldName: f.fieldName,
          value: cleanFieldValue(f.value),
          status: (f.status || 'auto') as 'auto' | 'modified' | 'confirmed' | 'missing',
          groupName: f.groupName || '其他',
        }))
      }

      setFields(mergedFields)

      // 默认展开所有分组
      const groups = new Set(mergedFields.map(f => f.groupName || '其他'))
      setExpandedGroups(groups)
    } catch (err) {
      console.error('加载字段失败:', err)
      setError('加载字段信息失败')
    } finally {
      setIsLoadingFields(false)
    }
  }

  useEffect(() => {
    loadFields()
  }, [id])

  // 按分组整理字段
  const groupedFields = useMemo(() => {
    const groups: Record<string, FieldValue[]> = {}
    fields.forEach(field => {
      const group = field.groupName || '其他'
      if (!groups[group]) {
        groups[group] = []
      }
      groups[group].push(field)
    })
    return groups
  }, [fields])

  const groupNames = Object.keys(groupedFields)

  // 统计
  const confirmedCount = fields.filter(f => f.status === 'confirmed').length
  const filledCount = fields.filter(f => f.value).length
  const progress = fields.length > 0 ? Math.round((confirmedCount / fields.length) * 100) : 0

  // 开始编辑
  const startEdit = (field: FieldValue) => {
    setEditingField(field.fieldCode)
    setEditValue(field.value || '')
  }

  // 保存编辑
  const saveEdit = async (fieldCode: string) => {
    if (!id || !tenderFileRecordId) {
      console.error('无法保存：缺少项目ID或招标文件记录ID')
      return
    }
    try {
      const field = fields.find(f => f.fieldCode === fieldCode)
      
      // 保存到 file_fields 表
      await fieldValueService.batchUpdate(id, tenderFileRecordId, [{
        fieldCode,
        fieldName: field?.fieldName,
        value: editValue,
        status: 'modified',
        groupName: field?.groupName,
      }])

      setFields(prev =>
        prev.map(f =>
          f.fieldCode === fieldCode
            ? { ...f, value: editValue, status: 'modified' }
            : f
        )
      )
      setEditingField(null)
    } catch (err) {
      console.error('保存失败:', err)
    }
  }

  // 确认单个字段
  const confirmField = async (fieldCode: string) => {
    if (!id || !tenderFileRecordId) return
    try {
      const field = fields.find(f => f.fieldCode === fieldCode)
      if (!field) return

      // 保存到 file_fields 表
      await fieldValueService.batchUpdate(id, tenderFileRecordId, [{
        fieldCode,
        fieldName: field.fieldName,
        value: field.value,
        status: 'confirmed',
        groupName: field.groupName,
      }])

      setFields(prev =>
        prev.map(f =>
          f.fieldCode === fieldCode ? { ...f, status: 'confirmed' } : f
        )
      )
    } catch (err) {
      console.error('确认失败:', err)
    }
  }

  // 确认全部并创建项目
  const handleConfirmAll = async () => {
    if (!id || !project || !tenderFileRecordId) {
      setError('缺少必要数据')
      return
    }
    setIsSaving(true)
    setError(null)

    try {
      // 批量保存所有有值的字段到 file_fields
      const fieldsToSave = fields
        .filter(f => f.value)
        .map(f => ({
          fieldCode: f.fieldCode,
          fieldName: f.fieldName,
          value: f.value,
          status: 'confirmed' as const,
          groupName: f.groupName,
        }))

      if (fieldsToSave.length > 0) {
        await fieldValueService.batchUpdate(id, tenderFileRecordId, fieldsToSave)
        console.log(`[确认] 已保存 ${fieldsToSave.length} 个字段到 file_fields`)
      }

      // 更新项目名称
      const nameField = fields.find(f => f.fieldName === '项目名称')
      if (nameField?.value && nameField.value !== project.name) {
        await projectService.update(id, { name: nameField.value })
      }

      // 更新项目状态为 ready
      await projectService.update(id, { status: 'ready' })

      // 跳转到项目工作区
      navigate(`/projects/${id}`)
    } catch (err) {
      console.error('确认失败:', err)
      setError('确认失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  // 切换分组展开
  const toggleGroup = (group: string) => {
    setExpandedGroups(prev => {
      const next = new Set(prev)
      if (next.has(group)) {
        next.delete(group)
      } else {
        next.add(group)
      }
      return next
    })
  }

  if (isLoadingProject) {
    return (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  if (!project) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-red-500" />
        <p className="text-red-500">项目不存在</p>
        <Button variant="outline" onClick={() => navigate('/projects')}>
          返回项目列表
        </Button>
      </div>
    )
  }

  return (
    <div className="flex h-full flex-col">
      {/* 顶部导航栏 */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-background">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => navigate(`/projects/${id}`)}>
            <ArrowLeft className="mr-1 h-4 w-4" />
            返回
          </Button>
          <div>
            <h1 className="font-semibold truncate max-w-md">{project.name}</h1>
            <p className="text-sm text-muted-foreground">确认招标文件关键信息</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="text-sm text-muted-foreground">
            已确认 {confirmedCount}/{fields.length}
          </div>
          <Button onClick={handleConfirmAll} disabled={isSaving}>
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                保存中...
              </>
            ) : (
              <>
                确认并创建项目
                <ArrowRight className="ml-2 h-4 w-4" />
              </>
            )}
          </Button>
        </div>
      </div>

      {/* 主体内容：左右分栏 */}
      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* 左侧：文件预览 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col bg-muted/30">
            <div className="flex items-center justify-between border-b px-4 py-3">
              <div className="flex items-center gap-2">
                <FileText className="h-5 w-5 text-primary" />
                <span className="font-medium">招标文件</span>
              </div>
            </div>

            <div className="flex-1 overflow-auto">
              {project.tenderFileUrl ? (
                // 根据文件类型选择预览方式
                (() => {
                  const fileUrl = project.tenderFileUrl.toLowerCase()
                  const fullUrl = `${getConfig().host}${project.tenderFileUrl}`
                  
                  // PDF - iframe 预览
                  if (fileUrl.endsWith('.pdf')) {
                    return (
                      <iframe
                        src={fullUrl}
                        className="h-full w-full border-0"
                        title="招标文件预览"
                      />
                    )
                  }
                  
                  // 图片 - img 标签预览
                  if (/\.(jpg|jpeg|png|gif|webp|bmp)$/.test(fileUrl)) {
                    return (
                      <div className="flex h-full items-center justify-center p-4">
                        <img
                          src={fullUrl}
                          alt="招标文件"
                          className="max-w-full max-h-full object-contain rounded shadow-lg"
                        />
                      </div>
                    )
                  }
                  
                  // Word/其他格式 - 显示下载提示
                  return (
                    <div className="flex h-full items-center justify-center">
                      <div className="text-center p-8">
                        <FileText className="mx-auto h-20 w-20 text-primary/40" />
                        <p className="mt-6 text-lg font-medium">招标文件</p>
                        <p className="mt-2 text-sm text-muted-foreground">
                          此格式暂不支持在线预览
                        </p>
                        <Button
                          variant="outline"
                          className="mt-6"
                          onClick={() => window.open(fullUrl, '_blank')}
                        >
                          <FileText className="mr-2 h-4 w-4" />
                          下载查看
                        </Button>
                      </div>
                    </div>
                  )
                })()
              ) : project.tenderFileId ? (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-16 w-16 text-muted-foreground/30" />
                    <p className="mt-4 text-muted-foreground">文件预览不可用</p>
                    <p className="mt-2 text-xs text-muted-foreground">
                      文件 ID: {project.tenderFileId}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center">
                  <div className="text-center">
                    <FileText className="mx-auto h-24 w-24 text-muted-foreground/30" />
                    <p className="mt-4 text-muted-foreground">暂无文件</p>
                  </div>
                </div>
              )}
            </div>
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* 右侧：字段确认 */}
        <ResizablePanel defaultSize={50} minSize={30}>
          <div className="h-full flex flex-col">
            {/* 进度条 */}
            <div className="border-b px-4 py-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm text-muted-foreground">
                  {filledCount}/{fields.length} 个字段已填写
                </span>
                <Button variant="ghost" size="sm" onClick={loadFields}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <Progress value={progress} className="h-2" />
            </div>

            {/* 错误提示 */}
            {error && (
              <div className="mx-4 mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
                <AlertCircle className="h-4 w-4" />
                <span className="text-sm">{error}</span>
              </div>
            )}

            {/* 字段列表 */}
            <ScrollArea className="flex-1">
              {isLoadingFields ? (
                <div className="flex items-center justify-center py-12">
                  <Loader2 className="h-8 w-8 animate-spin text-primary" />
                </div>
              ) : fields.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <AlertCircle className="h-12 w-12 text-muted-foreground/50" />
                  <p className="mt-4 text-muted-foreground">暂无字段信息</p>
                  <Button variant="outline" className="mt-4" onClick={loadFields}>
                    刷新
                  </Button>
                </div>
              ) : (
                <div className="p-4 space-y-4">
                  {groupNames.map(groupName => (
                    <Collapsible
                      key={groupName}
                      open={expandedGroups.has(groupName)}
                      onOpenChange={() => toggleGroup(groupName)}
                    >
                      <CollapsibleTrigger asChild>
                        <button className="flex w-full items-center justify-between rounded-lg border bg-card p-3 hover:bg-muted/50">
                          <div className="flex items-center gap-2">
                            <span className="font-medium">{groupName}</span>
                            <Badge variant="secondary">
                              {groupedFields[groupName].filter(f => f.value).length}/
                              {groupedFields[groupName].length}
                            </Badge>
                          </div>
                          {expandedGroups.has(groupName) ? (
                            <ChevronDown className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <ChevronRight className="h-4 w-4 text-muted-foreground" />
                          )}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="mt-2 space-y-2 pl-2">
                          {groupedFields[groupName].map(field => (
                            <FieldRow
                              key={field.fieldCode}
                              field={field}
                              isEditing={editingField === field.fieldCode}
                              editValue={editValue}
                              onEditValueChange={setEditValue}
                              onStartEdit={() => startEdit(field)}
                              onSaveEdit={() => saveEdit(field.fieldCode)}
                              onCancelEdit={() => setEditingField(null)}
                              onConfirm={() => confirmField(field.fieldCode)}
                            />
                          ))}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  ))}
                </div>
              )}
            </ScrollArea>
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  )
}

// 字段行组件
function FieldRow({
  field,
  isEditing,
  editValue,
  onEditValueChange,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onConfirm,
}: {
  field: FieldValue
  isEditing: boolean
  editValue: string
  onEditValueChange: (value: string) => void
  onStartEdit: () => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  onConfirm: () => void
}) {
  return (
    <div
      className={cn(
        'rounded-lg border p-3 transition-colors',
        field.status === 'confirmed' && 'bg-green-50/50 border-green-200'
      )}
    >
      <div className="flex items-start gap-3">
        {/* 状态图标 */}
        <div
          className={cn(
            'flex h-6 w-6 items-center justify-center rounded-full shrink-0 mt-0.5',
            field.status === 'confirmed'
              ? 'bg-green-100 text-green-600'
              : field.value
              ? 'bg-amber-100 text-amber-600'
              : 'bg-gray-100 text-gray-400'
          )}
        >
          {field.status === 'confirmed' ? (
            <CheckCircle2 className="h-4 w-4" />
          ) : field.value ? (
            <AlertCircle className="h-4 w-4" />
          ) : (
            <X className="h-3 w-3" />
          )}
        </div>

        {/* 字段内容 */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-muted-foreground">
              {field.fieldName}
            </span>
            {field.status === 'modified' && (
              <Badge variant="secondary" className="text-xs">已修改</Badge>
            )}
            {field.status === 'confirmed' && (
              <Badge className="bg-green-100 text-green-700 text-xs">已确认</Badge>
            )}
          </div>

          {isEditing ? (
            <div className="flex items-center gap-2">
              <Input
                value={editValue}
                onChange={(e) => onEditValueChange(e.target.value)}
                className="flex-1 h-8"
                autoFocus
              />
              <Button size="sm" className="h-8" onClick={onSaveEdit}>
                <Check className="h-4 w-4" />
              </Button>
              <Button size="sm" variant="ghost" className="h-8" onClick={onCancelEdit}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <p className={cn(
              'text-sm',
              field.value ? 'text-foreground' : 'text-muted-foreground italic'
            )}>
              {field.value || '未提取到'}
            </p>
          )}
        </div>

        {/* 操作按钮 */}
        {!isEditing && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 w-7 p-0"
              onClick={onStartEdit}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            {field.status !== 'confirmed' && field.value && (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 w-7 p-0 text-green-600 hover:text-green-700"
                onClick={onConfirm}
              >
                <Check className="h-3.5 w-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
