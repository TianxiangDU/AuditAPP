import { useState, useEffect } from 'react'
import {
  Check,
  Pencil,
  Loader2,
  AlertCircle,
  CheckCircle2,
  FileText,
  ArrowRight,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { projectService, projectFileService, fieldValueService, tenderService } from '@/services'
import { cn } from '@/lib/utils'

interface FieldValue {
  fieldCode: string
  fieldName: string
  value: string | null
  status: 'auto' | 'modified' | 'confirmed'
  groupName?: string
}

interface ConfirmTenderInfoProps {
  projectId: string
  projectName: string
  onConfirmed: () => void
  onCancel?: () => void
}

// 关键字段列表（优先显示的重要字段）
const PRIORITY_FIELDS = [
  '项目名称',
  '招标人',
  '招标代理机构',
  '招标编号',
  '投标截止时间',
  '开标时间',
  '项目金额',
  '最高投标限价',
  '评标方法',
  '招标范围',
]

export function ConfirmTenderInfo({
  projectId,
  projectName,
  onConfirmed,
  onCancel,
}: ConfirmTenderInfoProps) {
  const [fields, setFields] = useState<FieldValue[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editingField, setEditingField] = useState<string | null>(null)
  const [editValue, setEditValue] = useState('')
  const [displayName, setDisplayName] = useState(projectName)
  const [isEditingName, setIsEditingName] = useState(false)
  const [tenderFileId, setTenderFileId] = useState<string | null>(null)  // 招标文件的记录ID

  // 加载字段
  useEffect(() => {
    loadFields()
  }, [projectId])

  const loadFields = async () => {
    try {
      setIsLoading(true)
      setError(null)
      
      // 1. 获取招标文件的记录（is_tender=true 的文件）
      const files = await projectFileService.getList(projectId)
      const tenderFile = files.find(f => (f as any).isTender || f.docTypeName === '招标文件')
      
      if (!tenderFile) {
        setError('未找到招标文件')
        return
      }
      
      setTenderFileId(tenderFile.id)
      
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
      let extractedData: FieldValue[] = []
      try {
        const data = await fieldValueService.getByFile(projectId, tenderFile.id)
        extractedData = data.map(f => ({
          fieldCode: f.fieldCode,
          fieldName: f.fieldName,
          value: f.value,
          status: f.status as 'auto' | 'modified' | 'confirmed',
          groupName: f.groupName,
        }))
      } catch {
        // 没有已提取的字段
      }
      
      const extractedMap = new Map(
        extractedData.map(f => [f.fieldCode || f.fieldName, f])
      )
      
      // 4. 合并：以中台字段定义为准，填充已提取的值
      let mergedFields: FieldValue[] = []
      
      if (fieldDefs.length > 0) {
        mergedFields = fieldDefs.map(def => {
          const extracted = extractedMap.get(def.fieldCode) || extractedMap.get(def.fieldName)
          return {
            fieldCode: def.fieldCode,
            fieldName: def.fieldName,
            value: extracted?.value || null,
            status: extracted?.status || 'auto',
            groupName: def.fieldCategory,
          }
        })
      } else {
        mergedFields = extractedData
      }
      
      // 5. 排序：优先字段在前
      mergedFields.sort((a, b) => {
        const indexA = PRIORITY_FIELDS.indexOf(a.fieldName)
        const indexB = PRIORITY_FIELDS.indexOf(b.fieldName)
        
        if (indexA >= 0 && indexB >= 0) return indexA - indexB
        if (indexA >= 0) return -1
        if (indexB >= 0) return 1
        
        return (a.groupName || '').localeCompare(b.groupName || '')
      })
      
      setFields(mergedFields)
      
      // 如果有项目名称字段，更新显示名称
      const nameField = mergedFields.find(f => f.fieldName === '项目名称')
      if (nameField?.value) {
        setDisplayName(nameField.value)
      }
    } catch (err) {
      console.error('加载字段失败:', err)
      setError('加载字段信息失败')
    } finally {
      setIsLoading(false)
    }
  }

  // 开始编辑字段
  const startEdit = (field: FieldValue) => {
    setEditingField(field.fieldCode)
    setEditValue(field.value || '')
  }

  // 保存字段编辑
  const saveEdit = async (fieldCode: string) => {
    if (!tenderFileId) return
    
    try {
      const field = fields.find(f => f.fieldCode === fieldCode)
      
      // 保存到 file_fields
      await fieldValueService.batchUpdate(projectId, tenderFileId, [{
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
    try {
      const field = fields.find(f => f.fieldCode === fieldCode)
      if (!field) return

      await projectService.updateField(projectId, fieldCode, {
        value: field.value,
        status: 'confirmed',
        fieldName: field.fieldName,
        groupName: field.groupName,
      })
      
      setFields(prev =>
        prev.map(f =>
          f.fieldCode === fieldCode ? { ...f, status: 'confirmed' } : f
        )
      )
    } catch (err) {
      console.error('确认失败:', err)
    }
  }

  // 确认所有字段
  const confirmAll = async () => {
    if (!tenderFileId) {
      setError('未找到招标文件记录')
      return
    }
    
    setIsSaving(true)
    setError(null)

    try {
      // 批量保存所有字段到 file_fields
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
        await fieldValueService.batchUpdate(projectId, tenderFileId, fieldsToSave)
        console.log(`[确认] 已保存 ${fieldsToSave.length} 个字段`)
      }

      // 更新项目名称（如果有修改）
      const nameField = fields.find(f => f.fieldName === '项目名称')
      if (nameField?.value && nameField.value !== projectName) {
        await projectService.update(projectId, { name: nameField.value })
      }

      // 更新项目状态为 ready（可以开始审计）
      await projectService.update(projectId, { status: 'ready' })

      onConfirmed()
    } catch (err) {
      console.error('确认失败:', err)
      setError('确认失败，请重试')
    } finally {
      setIsSaving(false)
    }
  }

  // 计算进度
  const confirmedCount = fields.filter(f => f.status === 'confirmed').length
  const filledCount = fields.filter(f => f.value).length
  const progress = fields.length > 0 ? Math.round((confirmedCount / fields.length) * 100) : 0

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    )
  }

  return (
    <div className="rounded-xl border bg-card">
      {/* 头部 */}
      <div className="border-b p-6">
        <div className="flex items-start gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-amber-100">
            <FileText className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-semibold">确认关键信息</h2>
            <p className="mt-1 text-muted-foreground">
              请确认从招标文件中提取的关键信息，确认后将正式创建项目
            </p>
          </div>
          {onCancel && (
            <Button variant="ghost" size="icon" onClick={onCancel}>
              <X className="h-5 w-5" />
            </Button>
          )}
        </div>

        {/* 进度 */}
        <div className="mt-6">
          <div className="mb-2 flex justify-between text-sm">
            <span className="text-muted-foreground">
              已确认 {confirmedCount}/{fields.length} 个字段
            </span>
            <span className="font-medium">{progress}%</span>
          </div>
          <Progress value={progress} className="h-2" />
        </div>
      </div>

      {/* 项目名称 */}
      <div className="border-b p-4 bg-muted/30">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-sm text-muted-foreground">项目名称</span>
            {isEditingName ? (
              <div className="mt-1 flex items-center gap-2">
                <Input
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  className="max-w-md"
                  autoFocus
                />
                <Button
                  size="sm"
                  onClick={() => setIsEditingName(false)}
                >
                  <Check className="h-4 w-4" />
                </Button>
              </div>
            ) : (
              <p className="mt-1 text-lg font-semibold">{displayName}</p>
            )}
          </div>
          {!isEditingName && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIsEditingName(true)}
            >
              <Pencil className="h-4 w-4" />
            </Button>
          )}
        </div>
      </div>

      {/* 字段列表 */}
      <div className="divide-y">
        {fields.length === 0 ? (
          <div className="p-8 text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-muted-foreground/50" />
            <p className="mt-4 text-muted-foreground">暂未提取到关键信息</p>
            <p className="mt-2 text-sm text-muted-foreground">
              可能正在处理中，请稍后刷新
            </p>
            <Button variant="outline" className="mt-4" onClick={loadFields}>
              刷新
            </Button>
          </div>
        ) : (
          fields.map((field) => (
            <div
              key={field.fieldCode}
              className={cn(
                'flex items-center gap-4 p-4 transition-colors',
                field.status === 'confirmed' && 'bg-green-50/50'
              )}
            >
              {/* 状态图标 */}
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full shrink-0',
                  field.status === 'confirmed'
                    ? 'bg-green-100 text-green-600'
                    : field.value
                    ? 'bg-amber-100 text-amber-600'
                    : 'bg-gray-100 text-gray-400'
                )}
              >
                {field.status === 'confirmed' ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : field.value ? (
                  <AlertCircle className="h-5 w-5" />
                ) : (
                  <X className="h-4 w-4" />
                )}
              </div>

              {/* 字段信息 */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
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

                {editingField === field.fieldCode ? (
                  <div className="mt-1 flex items-center gap-2">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      className="flex-1"
                      autoFocus
                    />
                    <Button size="sm" onClick={() => saveEdit(field.fieldCode)}>
                      <Check className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => setEditingField(null)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>
                ) : (
                  <p className={cn(
                    'mt-1 truncate',
                    field.value ? 'text-foreground' : 'text-muted-foreground italic'
                  )}>
                    {field.value || '未提取到'}
                  </p>
                )}
              </div>

              {/* 操作按钮 */}
              {editingField !== field.fieldCode && (
                <div className="flex items-center gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => startEdit(field)}
                  >
                    <Pencil className="h-4 w-4" />
                  </Button>
                  {field.status !== 'confirmed' && field.value && (
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-green-600 hover:text-green-700"
                      onClick={() => confirmField(field.fieldCode)}
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 错误提示 */}
      {error && (
        <div className="mx-4 mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-red-700">
          <AlertCircle className="h-4 w-4" />
          <span className="text-sm">{error}</span>
        </div>
      )}

      {/* 底部操作 */}
      <div className="border-t p-4 flex items-center justify-between bg-muted/30">
        <div className="text-sm text-muted-foreground">
          {filledCount}/{fields.length} 个字段已填写
        </div>
        <div className="flex items-center gap-3">
          <Button variant="outline" onClick={loadFields}>
            刷新数据
          </Button>
          <Button
            onClick={confirmAll}
            disabled={isSaving || fields.length === 0}
          >
            {isSaving ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                确认中...
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
    </div>
  )
}
