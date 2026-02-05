import { type ClassValue, clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function formatDate(dateString: string): string {
  const date = new Date(dateString)
  return new Intl.DateTimeFormat('zh-CN', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  }).format(date)
}

export function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

export async function calculateSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer()
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map(b => b.toString(16).padStart(2, '0')).join('')
}

export function getStatusColor(status: string): string {
  const colorMap: Record<string, string> = {
    auto: 'bg-blue-100 text-blue-800',
    pending: 'bg-yellow-100 text-yellow-800',
    confirmed: 'bg-green-100 text-green-800',
    missing: 'bg-red-100 text-red-800',
    pass: 'bg-green-100 text-green-800',
    fail: 'bg-red-100 text-red-800',
    review: 'bg-orange-100 text-orange-800',
    draft: 'bg-gray-100 text-gray-800',
    parsing: 'bg-blue-100 text-blue-800',
    confirming: 'bg-yellow-100 text-yellow-800',
    auditing: 'bg-purple-100 text-purple-800',
    completed: 'bg-green-100 text-green-800',
  }
  return colorMap[status] || 'bg-gray-100 text-gray-800'
}

export function getStatusText(status: string): string {
  const textMap: Record<string, string> = {
    auto: '自动抽取',
    pending: '待确认',
    confirmed: '已确认',
    missing: '缺失',
    pass: '通过',
    fail: '不通过',
    review: '需复核',
    draft: '草稿',
    parsing: '解析中',
    confirming: '确认中',
    auditing: '审计中',
    completed: '已完成',
  }
  return textMap[status] || status
}

export function getSeverityColor(severity: string): string {
  const colorMap: Record<string, string> = {
    low: 'bg-blue-100 text-blue-800 border-blue-200',
    medium: 'bg-yellow-100 text-yellow-800 border-yellow-200',
    high: 'bg-orange-100 text-orange-800 border-orange-200',
    critical: 'bg-red-100 text-red-800 border-red-200',
  }
  return colorMap[severity] || 'bg-gray-100 text-gray-800'
}

export function getSeverityText(severity: string): string {
  const textMap: Record<string, string> = {
    low: '低风险',
    medium: '中风险',
    high: '高风险',
    critical: '严重',
  }
  return textMap[severity] || severity
}

export function debounce<T extends (...args: unknown[]) => void>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: ReturnType<typeof setTimeout> | null = null
  return (...args: Parameters<T>) => {
    if (timeout) clearTimeout(timeout)
    timeout = setTimeout(() => func(...args), wait)
  }
}

export function formatRelativeTime(date: Date | string): string {
  const now = new Date()
  const target = typeof date === 'string' ? new Date(date) : date
  const diffMs = now.getTime() - target.getTime()
  const diffSec = Math.floor(diffMs / 1000)
  const diffMin = Math.floor(diffSec / 60)
  const diffHour = Math.floor(diffMin / 60)
  const diffDay = Math.floor(diffHour / 24)

  if (diffSec < 60) return '刚刚'
  if (diffMin < 60) return `${diffMin}分钟前`
  if (diffHour < 24) return `${diffHour}小时前`
  if (diffDay < 7) return `${diffDay}天前`
  
  return formatDate(target.toISOString())
}
