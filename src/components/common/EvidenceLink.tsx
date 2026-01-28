import { ExternalLink, FileText } from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip'
import type { EvidenceRef } from '@/types'

interface EvidenceLinkProps {
  evidenceRef: EvidenceRef | null
  onView?: (evidenceRef: EvidenceRef) => void
  className?: string
}

export function EvidenceLink({ evidenceRef, onView, className }: EvidenceLinkProps) {
  if (!evidenceRef) {
    return (
      <span className="text-xs text-muted-foreground">无证据</span>
    )
  }

  const handleClick = () => {
    if (onView && evidenceRef) {
      onView(evidenceRef)
    }
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className={className}
            onClick={handleClick}
          >
            <FileText className="mr-1 h-3 w-3" />
            {evidenceRef.page ? `第 ${evidenceRef.page} 页` : '查看原文'}
            <ExternalLink className="ml-1 h-3 w-3" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="top" className="max-w-sm">
          {evidenceRef.snippet ? (
            <p className="text-xs">{evidenceRef.snippet}</p>
          ) : (
            <p className="text-xs">点击查看原文证据</p>
          )}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
