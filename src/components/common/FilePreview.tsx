import { useState, useEffect } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface FilePreviewProps {
  fileId?: string           // 智能体平台的文件ID（可选）
  fileName: string
  file?: File               // 本地文件对象（用于预览）
  previewUrl?: string       // 直接指定预览URL
  currentPage?: number
  totalPages?: number
  highlightBbox?: { x: number; y: number; width: number; height: number }
  onPageChange?: (page: number) => void
  className?: string
}

export function FilePreview({
  fileId,
  fileName,
  file,
  previewUrl,
  currentPage = 1,
  totalPages = 1,
  highlightBbox,
  onPageChange,
  className,
}: FilePreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [localPreviewUrl, setLocalPreviewUrl] = useState<string | null>(null)

  // 为本地文件创建预览 URL
  useEffect(() => {
    if (file) {
      const url = URL.createObjectURL(file)
      setLocalPreviewUrl(url)
      return () => URL.revokeObjectURL(url)
    }
    return undefined
  }, [file])

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 20, 200))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 20, 60))

  // 确定最终的预览 URL
  const finalPreviewUrl = previewUrl || localPreviewUrl

  const handlePrevPage = () => {
    if (currentPage > 1 && onPageChange) onPageChange(currentPage - 1)
  }

  const handleNextPage = () => {
    if (currentPage < totalPages && onPageChange) onPageChange(currentPage + 1)
  }

  return (
    <div className={cn('flex h-full flex-col bg-muted/20', className)}>
      {/* 简洁工具栏 */}
      <div className="flex items-center justify-between border-b bg-background px-3 py-2">
        <span className="text-sm font-medium truncate max-w-[200px]">{fileName}</span>
        
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomOut}>
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-10 text-center text-xs">{zoom}%</span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleZoomIn}>
            <ZoomIn className="h-4 w-4" />
          </Button>
          {finalPreviewUrl && (
            <Button variant="ghost" size="icon" className="h-7 w-7" asChild>
              <a href={finalPreviewUrl} download={fileName}>
                <Download className="h-4 w-4" />
              </a>
            </Button>
          )}
        </div>
      </div>

      {/* 预览区域 - 最大化空间 */}
      <ScrollArea className="flex-1">
        <div 
          className="flex min-h-full items-start justify-center p-4"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          <div className="relative w-full max-w-[700px] rounded border bg-white shadow-sm">
            {finalPreviewUrl ? (
              // 有预览 URL 时使用 iframe 或 embed
              file?.type === 'application/pdf' || fileName.endsWith('.pdf') ? (
                <embed
                  src={finalPreviewUrl}
                  type="application/pdf"
                  className="h-[900px] w-full"
                  title={fileName}
                />
              ) : file?.type?.startsWith('image/') || /\.(png|jpg|jpeg|gif|webp)$/i.test(fileName) ? (
                <img
                  src={finalPreviewUrl}
                  alt={fileName}
                  className="w-full object-contain"
                />
              ) : (
                <iframe
                  src={finalPreviewUrl}
                  className="h-[900px] w-full"
                  title={fileName}
                />
              )
            ) : (
              // 无预览 URL 时显示占位符
              <div className="flex h-[900px] w-full flex-col items-center justify-center bg-muted/30 text-muted-foreground">
                <FileText className="h-16 w-16 mb-4" />
                <p className="text-sm">{fileName}</p>
                <p className="text-xs mt-1">文件预览加载中...</p>
              </div>
            )}
            
            {highlightBbox && (
              <div
                className="absolute border-2 border-yellow-400 bg-yellow-200/30"
                style={{
                  left: `${highlightBbox.x}%`,
                  top: `${highlightBbox.y}%`,
                  width: `${highlightBbox.width}%`,
                  height: `${highlightBbox.height}%`,
                }}
              />
            )}
          </div>
        </div>
      </ScrollArea>

      {/* 简洁分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 border-t bg-background py-2">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handlePrevPage} disabled={currentPage <= 1}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-xs text-muted-foreground">
            {currentPage} / {totalPages}
          </span>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={handleNextPage} disabled={currentPage >= totalPages}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
