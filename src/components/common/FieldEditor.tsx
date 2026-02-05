import { useState, useMemo } from 'react'
import { Check, Edit2, AlertCircle, FileText, Image as ImageIcon } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { StatusBadge } from './StatusBadge'
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

// 图片链接正则 - 匹配常见图片扩展名
const IMAGE_EXT_REGEX = /(https?:\/\/[^\s"'<>]+\.(?:png|jpg|jpeg|gif|webp|bmp)(?:\?[^\s"'<>]*)?)/gi

// 匹配 <img src="..." /> 标签中的链接
const IMG_TAG_REGEX = /<img\s+src=["']([^"']+)["']\s*\/?>/gi

// 匹配 agentspro API 图片链接（无扩展名）
const AGENT_FS_REGEX = /(https?:\/\/[^\s"'<>]*agentspro\.cn\/api\/fs\/[a-zA-Z0-9]+)/gi

// 解析 value，提取纯文本值
function parseFieldValue(value: string | null): string {
  if (!value) return ''
  
  // 尝试解析 JSON 格式 { "字段名": "值" }
  try {
    const trimmed = value.trim()
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      const parsed = JSON.parse(trimmed)
      // 取第一个值
      const values = Object.values(parsed)
      if (values.length > 0 && typeof values[0] === 'string') {
        return values[0] as string
      }
    }
  } catch {
    // 不是 JSON，继续
  }
  
  return value
}

// 提取图片链接
function extractImageUrls(text: string): string[] {
  const urls: string[] = []
  
  // 1. 从 <img src="..." /> 标签中提取
  let match
  while ((match = IMG_TAG_REGEX.exec(text)) !== null) {
    urls.push(match[1])
  }
  IMG_TAG_REGEX.lastIndex = 0 // 重置正则
  
  // 2. 匹配 agentspro API 链接
  while ((match = AGENT_FS_REGEX.exec(text)) !== null) {
    urls.push(match[1])
  }
  AGENT_FS_REGEX.lastIndex = 0
  
  // 3. 匹配常见图片扩展名
  while ((match = IMAGE_EXT_REGEX.exec(text)) !== null) {
    urls.push(match[1])
  }
  IMAGE_EXT_REGEX.lastIndex = 0
  
  // 去重
  return [...new Set(urls)]
}

// 渲染文本内容（处理换行符等）
function renderTextContent(text: string) {
  // 移除图片相关内容
  let textWithoutImages = text
    .replace(IMG_TAG_REGEX, '') // 移除 <img /> 标签
    .replace(AGENT_FS_REGEX, '') // 移除 agentspro 链接
    .replace(IMAGE_EXT_REGEX, '') // 移除图片链接
    .trim()
  
  // 重置正则
  IMG_TAG_REGEX.lastIndex = 0
  AGENT_FS_REGEX.lastIndex = 0
  IMAGE_EXT_REGEX.lastIndex = 0
  
  // 处理换行符 \n
  const lines = textWithoutImages.split(/\\n|\n/)
  
  return (
    <div className="space-y-1">
      {lines.map((line, idx) => {
        const trimmedLine = line.trim()
        if (!trimmedLine) return null
        
        // 检测是否是编号行（如 1. 2. 3. 或 n1. n2.）
        const isNumberedItem = /^[n]?\d+[.、]/.test(trimmedLine)
        
        return (
          <p 
            key={idx} 
            className={cn(
              "text-sm leading-relaxed",
              isNumberedItem && "pl-2"
            )}
          >
            {trimmedLine}
          </p>
        )
      })}
    </div>
  )
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
  
  // 解析后的纯值
  const parsedValue = useMemo(() => parseFieldValue(value), [value])
  const [editValue, setEditValue] = useState(parsedValue)
  
  // 提取图片链接
  const imageUrls = useMemo(() => extractImageUrls(parsedValue), [parsedValue])
  
  // 判断是否需要大文本框
  const needsTextarea = isTextarea || parsedValue.length > 100 || parsedValue.includes('\n') || parsedValue.includes('\\n')

  const handleSave = () => {
    onValueChange?.(editValue)
    onStatusChange?.('confirmed')
    setIsEditing(false)
  }

  const handleCancel = () => {
    setEditValue(parsedValue)
    setIsEditing(false)
  }

  const handleConfirm = () => {
    onStatusChange?.('confirmed')
  }

  const handleMarkMissing = () => {
    onStatusChange?.('missing')
  }

  const needsAction = status === 'auto' || status === 'pending'

  return (
    <div
      className={cn(
        'rounded-lg border p-4 transition-colors',
        needsAction && 'border-amber-200 bg-amber-50/50',
        status === 'confirmed' && 'border-green-100 bg-green-50/30',
        status === 'missing' && 'border-red-100 bg-red-50/30',
        className
      )}
    >
      {/* 标题行 */}
      <div className="mb-3 flex items-center justify-between">
        <span className="font-medium text-foreground">{fieldName}</span>
        <div className="flex items-center gap-2">
          <StatusBadge status={status} />
          {!isEditing && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7"
              onClick={() => {
                setEditValue(parsedValue)
                setIsEditing(true)
              }}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* 值内容 */}
      {isEditing ? (
        <div className="space-y-3">
          {needsTextarea ? (
            <Textarea
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="min-h-[120px] text-sm"
              placeholder={`输入${fieldName}`}
            />
          ) : (
            <Input
              value={editValue}
              onChange={(e) => setEditValue(e.target.value)}
              className="h-9 text-sm"
              placeholder={`输入${fieldName}`}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={handleCancel}>
              取消
            </Button>
            <Button size="sm" onClick={handleSave}>
              保存
            </Button>
          </div>
        </div>
      ) : (
        <>
          {/* 文本内容 */}
          <div className="mb-3">
            {parsedValue ? (
              <div className="rounded-md bg-background/50 p-3">
                {renderTextContent(parsedValue)}
              </div>
            ) : (
              <p className="py-2 text-sm italic text-muted-foreground">
                未找到相关内容
              </p>
            )}
          </div>

          {/* 图片预览 */}
          {imageUrls.length > 0 && (
            <div className="mb-3 space-y-2">
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <ImageIcon className="h-3.5 w-3.5" />
                <span>相关图片 ({imageUrls.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {imageUrls.map((url, idx) => (
                  <a
                    key={idx}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group relative overflow-hidden rounded-md border bg-muted/50"
                  >
                    <img
                      src={url}
                      alt={`图片 ${idx + 1}`}
                      className="h-20 w-auto max-w-[120px] object-cover transition-transform group-hover:scale-105"
                      onError={(e) => {
                        // 图片加载失败时隐藏
                        (e.target as HTMLElement).parentElement!.style.display = 'none'
                      }}
                    />
                  </a>
                ))}
              </div>
            </div>
          )}

          {/* 操作行 */}
          <div className="flex items-center justify-between pt-2 border-t border-border/50">
            {evidenceRef?.page ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-7 px-2 text-xs"
                onClick={() => onViewEvidence?.(evidenceRef)}
              >
                <FileText className="mr-1 h-3.5 w-3.5" />
                查看原文 (第{evidenceRef.page}页)
              </Button>
            ) : (
              <span />
            )}

            {needsAction && (
              <div className="flex items-center gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-3 text-xs text-amber-600 hover:text-amber-700 hover:bg-amber-100"
                  onClick={handleMarkMissing}
                >
                  <AlertCircle className="mr-1 h-3.5 w-3.5" />
                  缺失
                </Button>
                <Button
                  variant="default"
                  size="sm"
                  className="h-7 px-3 text-xs"
                  onClick={handleConfirm}
                >
                  <Check className="mr-1 h-3.5 w-3.5" />
                  确认
                </Button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
