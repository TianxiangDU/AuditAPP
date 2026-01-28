import { X, Check, FolderOpen, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { cn } from '@/lib/utils'

interface BatchActionBarProps {
  selectedCount: number
  docTypes?: Array<{ code: string; name: string }>
  onClear: () => void
  onChangeType?: (docTypeCode: string) => void
  onConfirm?: () => void
  onReExtract?: () => void
  className?: string
}

export function BatchActionBar({
  selectedCount,
  docTypes = [],
  onClear,
  onChangeType,
  onConfirm,
  onReExtract,
  className,
}: BatchActionBarProps) {
  if (selectedCount === 0) return null

  return (
    <div
      className={cn(
        'fixed bottom-4 left-1/2 z-50 flex -translate-x-1/2 items-center gap-4 rounded-lg border bg-background px-4 py-3 shadow-lg',
        className
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">
          已选择 <span className="text-primary">{selectedCount}</span> 项
        </span>
        <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onClear}>
          <X className="h-4 w-4" />
        </Button>
      </div>

      <div className="h-6 w-px bg-border" />

      {onChangeType && docTypes.length > 0 && (
        <div className="flex items-center gap-2">
          <FolderOpen className="h-4 w-4 text-muted-foreground" />
          <Select onValueChange={onChangeType}>
            <SelectTrigger className="h-8 w-40">
              <SelectValue placeholder="修改文件类型" />
            </SelectTrigger>
            <SelectContent>
              {docTypes.map((type) => (
                <SelectItem key={type.code} value={type.code}>
                  {type.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {onReExtract && (
        <Button variant="outline" size="sm" onClick={onReExtract}>
          <RefreshCw className="mr-1 h-3 w-3" />
          重新提取
        </Button>
      )}

      {onConfirm && (
        <Button size="sm" onClick={onConfirm}>
          <Check className="mr-1 h-3 w-3" />
          批量确认
        </Button>
      )}
    </div>
  )
}
