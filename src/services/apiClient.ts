import axios, { type AxiosInstance, type AxiosError } from 'axios'
import type { ApiResponse } from '@/types'

// 创建 axios 实例
const createApiClient = (baseURL: string): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    timeout: 30000,
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      // 添加 traceId
      config.headers['X-Trace-Id'] = generateTraceId()
      return config
    },
    (error) => Promise.reject(error)
  )

  // 响应拦截器
  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError) => {
      const config = error.config
      
      // 重试逻辑
      if (config && shouldRetry(error)) {
        const retryCount = (config as { _retryCount?: number })._retryCount || 0
        if (retryCount < 3) {
          (config as { _retryCount?: number })._retryCount = retryCount + 1
          await sleep(1000 * (retryCount + 1))
          return instance(config)
        }
      }
      
      return Promise.reject(error)
    }
  )

  return instance
}

// 生成 traceId
function generateTraceId(): string {
  return `${Date.now()}-${Math.random().toString(36).substring(2, 11)}`
}

// 判断是否应该重试
function shouldRetry(error: AxiosError): boolean {
  if (!error.response) return true // 网络错误
  const status = error.response.status
  return status >= 500 || status === 408 || status === 429
}

// 延迟函数
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

// App 端 API 客户端
export const appClient = createApiClient('/api/app')

// 数据中台 API 客户端
export const dataHubClient = createApiClient('/api/v1')

// 简单的内存缓存
const cache = new Map<string, { data: unknown; timestamp: number }>()
const CACHE_TTL = 5 * 60 * 1000 // 5 分钟

export async function cachedGet<T>(
  client: AxiosInstance,
  url: string,
  cacheKey?: string
): Promise<T> {
  const key = cacheKey || url
  const cached = cache.get(key)
  
  if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
    return cached.data as T
  }
  
  const response = await client.get<ApiResponse<T>>(url)
  const data = response.data.data
  
  cache.set(key, { data, timestamp: Date.now() })
  
  return data
}

export function clearCache(pattern?: string): void {
  if (pattern) {
    for (const key of cache.keys()) {
      if (key.includes(pattern)) {
        cache.delete(key)
      }
    }
  } else {
    cache.clear()
  }
}
