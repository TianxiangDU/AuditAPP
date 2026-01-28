import { Check, ArrowRight, Clock } from 'lucide-react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { cn } from '@/lib/utils'

export interface StepInfo {
  id: string
  title: string
  description: string
  status: 'pending' | 'in_progress' | 'completed'
  progress?: number
  pendingCount?: number
  ctaText?: string
  ctaHref?: string
  onCtaClick?: () => void
}

interface StepCardsProps {
  steps: StepInfo[]
  className?: string
}

export function StepCards({ steps, className }: StepCardsProps) {
  return (
    <div className={cn('grid gap-4 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5', className)}>
      {steps.map((step, index) => (
        <StepCard key={step.id} step={step} stepNumber={index + 1} />
      ))}
    </div>
  )
}

interface StepCardProps {
  step: StepInfo
  stepNumber: number
}

function StepCard({ step, stepNumber }: StepCardProps) {
  const getStatusIcon = () => {
    switch (step.status) {
      case 'completed':
        return <Check className="h-5 w-5 text-green-600" />
      case 'in_progress':
        return <Clock className="h-5 w-5 text-blue-600 animate-pulse" />
      default:
        return <span className="text-sm font-bold text-muted-foreground">{stepNumber}</span>
    }
  }

  const getStatusStyles = () => {
    switch (step.status) {
      case 'completed':
        return 'border-green-200 bg-green-50/50'
      case 'in_progress':
        return 'border-blue-200 bg-blue-50/50 ring-2 ring-blue-200'
      default:
        return 'border-muted bg-muted/20'
    }
  }

  return (
    <Card className={cn('relative transition-all hover:shadow-md', getStatusStyles())}>
      <CardHeader className="pb-2">
        <div className="flex items-center justify-between">
          <div className="flex h-8 w-8 items-center justify-center rounded-full border-2 border-current">
            {getStatusIcon()}
          </div>
          {step.pendingCount !== undefined && step.pendingCount > 0 && (
            <span className="flex h-6 w-6 items-center justify-center rounded-full bg-orange-500 text-xs font-bold text-white">
              {step.pendingCount > 99 ? '99+' : step.pendingCount}
            </span>
          )}
        </div>
        <CardTitle className="text-base">{step.title}</CardTitle>
        <CardDescription className="text-xs">{step.description}</CardDescription>
      </CardHeader>
      
      <CardContent className="pt-0">
        {step.progress !== undefined && (
          <div className="mb-3">
            <div className="mb-1 flex justify-between text-xs text-muted-foreground">
              <span>进度</span>
              <span>{step.progress}%</span>
            </div>
            <Progress value={step.progress} className="h-1.5" />
          </div>
        )}
        
        {step.ctaText && (
          <Button
            variant={step.status === 'completed' ? 'outline' : 'default'}
            size="sm"
            className="w-full"
            onClick={step.onCtaClick}
            asChild={!!step.ctaHref}
          >
            {step.ctaHref ? (
              <a href={step.ctaHref}>
                {step.ctaText}
                <ArrowRight className="ml-1 h-3 w-3" />
              </a>
            ) : (
              <>
                {step.ctaText}
                <ArrowRight className="ml-1 h-3 w-3" />
              </>
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  )
}
