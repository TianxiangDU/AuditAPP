import { useState } from 'react'
import { Check, X, Edit2, AlertCircle, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from './StatusBadge'
import { EvidenceLink } from './EvidenceLink'
import type { FieldStatus, EvidenceRef } from '@/types'
import { cn } from '@/lib/utils'

interface FieldEditorProps {
  fieldCode: string
  fieldName: string
  value: string | null
  status: FieldStatus
  evidenceRef: EvidenceRef | null
  isTextarea?: boolean
  onValueChange?: (value: string) => void
  onStatusChange?: (status: FieldStatus) => void
  onViewEvidence?: (evidenceRef: EvidenceRef) => void
  className?: string
}

export function FieldEditor({
  fieldCode,
  fieldName,
  value,
  status,
  evidenceRef,
  isTextarea = false,
  onValueChange,
  onStatusChange,
  onViewEvidence,
  className,
}: FieldEditorProps) {
  const [isEditing, setIsEditing] = useState(false)
  const [editValue, setEditValue] = useState(value || '')

  const handleSave = () => {
    onValueChange?.(editValue)
    onStatusChange?.('confirmed')
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(value || '')
    setIsEditing(false)
  }

  const handleMarkMissing = () => {
    onStatusChange?.('missing')
  }

  const handleConfirm = () => {
    onStatusChange?.('confirmed')
  }

  return (
    <div className={cn('group rounded-lg border p-4 transition-colors hover:bg-muted/30', className)}>
      {/* 字段头部 */}
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="font-medium text-sm">{fieldName}</span>
          <StatusBadge status={status} />
        </div>
        
        <div className="flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100">
          {!isEditing && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setIsEditing(true)}
              >
                <Edit2 className="h-3.5 w-3.5" />
              </Button>
              {status !== 'missing' && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-orange-600 hover:text-orange-700"
                  onClick={handleMarkMissing}
                  title="标记为缺失"
                >
                  <AlertCircle className="h-3.5 w-3.5" />
                </Button>
              )}
              {status !== 'confirmed' && value && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-green-600 hover:text-green-700"
                  onClick={handleConfirm}
                  title="确认字段"
                >
                  <Check className="h-3.5 w-3.5" />
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {/* 字段值 */}
      <div className="mb-2">
        {isEditing ? (
          <div className="space-y-2">
            {isTextarea ? (
              <Textarea
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                className="min-h-[100px]"
                placeholder={`请输入${fieldName}`}
              />
            ) : (
              <Input
                value={editValue}
                onChange={(e) => setEditValue(e.target.value)}
                placeholder={`请输入${fieldName}`}
              />
            )}
            <div className="flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={handleCancel}>
                <X className="mr-1 h-3 w-3" />
                取消
              </Button>
              <Button size="sm" onClick={handleSave}>
                <Check className="mr-1 h-3 w-3" />
                保存
              </Button>
            </div>
          </div>
        ) : (
          <div className="min-h-[24px]">
            {value ? (
              <p className="text-sm text-foreground whitespace-pre-wrap">{value}</p>
            ) : (
              <p className="text-sm text-muted-foreground italic">
                {status === 'missing' ? '未在原文中找到' : '暂无数据'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* 证据链接 */}
      {!isEditing && (
        <div className="flex items-center justify-between border-t pt-2">
          <EvidenceLink evidenceRef={evidenceRef} onView={onViewEvidence} />
          <span className="text-xs text-muted-foreground">{fieldCode}</span>
        </div>
      )}
    </div>
  )
}
