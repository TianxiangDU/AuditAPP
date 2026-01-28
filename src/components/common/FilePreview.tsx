import { useState } from 'react'
import { ChevronLeft, ChevronRight, ZoomIn, ZoomOut, Download, Search } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { ScrollArea } from '@/components/ui/scroll-area'
import { cn } from '@/lib/utils'

interface FilePreviewProps {
  fileId: string
  fileName: string
  currentPage?: number
  totalPages?: number
  highlightBbox?: { x: number; y: number; width: number; height: number }
  onPageChange?: (page: number) => void
  className?: string
}

export function FilePreview({
  fileId,
  fileName,
  currentPage = 1,
  totalPages = 1,
  highlightBbox,
  onPageChange,
  className,
}: FilePreviewProps) {
  const [zoom, setZoom] = useState(100)
  const [searchText, setSearchText] = useState('')

  const handleZoomIn = () => setZoom((prev) => Math.min(prev + 25, 200))
  const handleZoomOut = () => setZoom((prev) => Math.max(prev - 25, 50))

  const handlePrevPage = () => {
    if (currentPage > 1 && onPageChange) {
      onPageChange(currentPage - 1)
    }
  }

  const handleNextPage = () => {
    if (currentPage < totalPages && onPageChange) {
      onPageChange(currentPage + 1)
    }
  }

  return (
    <div className={cn('flex h-full flex-col', className)}>
      {/* 工具栏 */}
      <div className="flex items-center justify-between border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate max-w-[200px]" title={fileName}>
            {fileName}
          </span>
        </div>
        
        <div className="flex items-center gap-2">
          {/* 搜索 */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="搜索..."
              value={searchText}
              onChange={(e) => setSearchText(e.target.value)}
              className="h-8 w-40 pl-8"
            />
          </div>
          
          {/* 缩放 */}
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" onClick={handleZoomOut} disabled={zoom <= 50}>
              <ZoomOut className="h-4 w-4" />
            </Button>
            <span className="w-12 text-center text-sm">{zoom}%</span>
            <Button variant="ghost" size="icon" onClick={handleZoomIn} disabled={zoom >= 200}>
              <ZoomIn className="h-4 w-4" />
            </Button>
          </div>

          {/* 下载 */}
          <Button variant="ghost" size="icon" asChild>
            <a href={`/api/v1/files/${fileId}/download`} download>
              <Download className="h-4 w-4" />
            </a>
          </Button>
        </div>
      </div>

      {/* 预览区域 */}
      <ScrollArea className="flex-1">
        <div 
          className="relative flex items-center justify-center p-4"
          style={{ transform: `scale(${zoom / 100})`, transformOrigin: 'top center' }}
        >
          {/* 这里将使用 iframe 或 PDF.js 来预览文件 */}
          <div className="relative min-h-[800px] w-full max-w-[800px] rounded-lg border bg-white shadow-sm">
            <iframe
              src={`/api/v1/files/${fileId}/preview?page=${currentPage}`}
              className="h-full min-h-[800px] w-full"
              title={fileName}
            />
            
            {/* 高亮区域 */}
            {highlightBbox && (
              <div
                className="absolute border-2 border-yellow-400 bg-yellow-200/30 transition-all"
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

      {/* 分页 */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-4 border-t bg-muted/30 py-2">
          <Button
            variant="ghost"
            size="icon"
            onClick={handlePrevPage}
            disabled={currentPage <= 1}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <span className="text-sm">
            第 {currentPage} 页 / 共 {totalPages} 页
          </span>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleNextPage}
            disabled={currentPage >= totalPages}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  )
}
