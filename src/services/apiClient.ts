import axios, { type AxiosInstance, type AxiosError } from 'axios'
import type { ApiResponse } from '@/types'

// 数据中台认证配置
// Token 有效期 7 天，过期后需重新获取
// 登录接口: POST http://115.190.44.247/api/v1/auth/login { username: "admin", password: "admin123" }
export const DATA_HUB_AUTH = {
  // JWT Token - 从环境变量获取，或使用默认值
  token: import.meta.env.VITE_DATA_HUB_TOKEN || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJzdWIiOiIxIiwidXNlcm5hbWUiOiJhZG1pbiIsInJvbGUiOiJhZG1pbiIsInJvbGVJZCI6bnVsbCwiaWF0IjoxNzcwMTg3OTM5LCJleHAiOjE3NzA3OTI3Mzl9.z0ANwnqnN08_mtMC4Q01NFg8Sv9G15mNTk95uARGKTY',
  // 是否启用认证
  enabled: true,
}

// 设置数据中台 Token（用于运行时更新）
export function setDataHubToken(token: string) {
  DATA_HUB_AUTH.token = token
  DATA_HUB_AUTH.enabled = !!token
}

// 创建 axios 实例
const createApiClient = (baseURL: string, useAuth = false): AxiosInstance => {
  const instance = axios.create({
    baseURL,
    timeout: 600000, // 10 分钟超时
    headers: {
      'Content-Type': 'application/json',
    },
  })

  // 请求拦截器
  instance.interceptors.request.use(
    (config) => {
      // 添加 traceId
      config.headers['X-Trace-Id'] = generateTraceId()
      
      // 添加数据中台认证
      if (useAuth && DATA_HUB_AUTH.enabled && DATA_HUB_AUTH.token) {
        config.headers['Authorization'] = `Bearer ${DATA_HUB_AUTH.token}`
      }
      
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

// 数据中台 API 客户端（需要 JWT 认证）
export const dataHubClient = createApiClient('/api/v1', true)

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
