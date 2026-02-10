import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react'
import { projectService } from '@/services'

// 任务类型
export type TaskType = 'upload' | 'parse' | 'classify' | 'extract' | 'audit'

// 任务状态
export type TaskStatus = 'pending' | 'running' | 'completed' | 'failed'

// 任务超时时间（禁用）
export const TASK_TIMEOUT_MS = 0 // 不限制超时

// 单个任务
export interface Task {
  id: string
  projectId: string
  projectName: string
  type: TaskType
  status: TaskStatus
  progress: number // 0-100
  message: string
  fileName?: string
  createdAt: Date
  completedAt?: Date
  error?: string
  retryCount?: number // 重试次数
  fileId?: string // 用于重试
}

// 任务统计
export interface TaskStats {
  running: number
  completed: number
  failed: number
}

interface TaskContextType {
  tasks: Task[]
  stats: TaskStats
  addTask: (task: Omit<Task, 'id' | 'createdAt'>) => string
  updateTask: (id: string, updates: Partial<Task>) => void
  removeTask: (id: string) => void
  removeProjectTasks: (projectId: string) => void  // 删除项目的所有任务
  clearCompleted: () => void
  getProjectTasks: (projectId: string) => Task[]
  retryTask: (id: string) => void  // 重试任务
  getTimedOutTasks: () => Task[]  // 获取超时的任务
}

const TaskContext = createContext<TaskContextType | undefined>(undefined)

// 任务类型的中文名称
export const TASK_TYPE_NAMES: Record<TaskType, string> = {
  upload: '文件上传',
  parse: '文档解析',
  classify: '智能分拣',
  extract: '信息提取',
  audit: '智能审计',
}

export function TaskProvider({ children }: { children: React.ReactNode }) {
  const [tasks, setTasks] = useState<Task[]>(() => {
    try {
      const stored = localStorage.getItem('auditTasks')
      if (stored) {
        const parsed = JSON.parse(stored)
        // 恢复日期对象
        return parsed.map((t: any) => ({
          ...t,
          createdAt: new Date(t.createdAt),
          completedAt: t.completedAt ? new Date(t.completedAt) : undefined,
        }))
      }
    } catch {
      // ignore
    }
    return []
  })

  // 持久化任务列表
  useEffect(() => {
    localStorage.setItem('auditTasks', JSON.stringify(tasks))
  }, [tasks])

  // 清理无效任务（对应的项目已被删除）
  const cleanupRef = useRef(false)
  useEffect(() => {
    if (cleanupRef.current || tasks.length === 0) return
    cleanupRef.current = true

    async function cleanupOrphanTasks() {
      try {
        const projects = await projectService.getList()
        const projectIds = new Set(projects.map(p => p.id))
        
        // 找出没有对应项目的任务
        const orphanTaskIds = tasks
          .filter(t => !projectIds.has(t.projectId))
          .map(t => t.id)
        
        if (orphanTaskIds.length > 0) {
          console.log('[TaskContext] 清理无效任务:', orphanTaskIds.length)
          setTasks(prev => prev.filter(t => !orphanTaskIds.includes(t.id)))
        }
      } catch (err) {
        console.error('清理任务失败:', err)
      }
    }

    cleanupOrphanTasks()
  }, [])

  // 计算统计
  const stats: TaskStats = {
    running: tasks.filter(t => t.status === 'running' || t.status === 'pending').length,
    completed: tasks.filter(t => t.status === 'completed').length,
    failed: tasks.filter(t => t.status === 'failed').length,
  }

  const addTask = useCallback((task: Omit<Task, 'id' | 'createdAt'>): string => {
    const id = `task-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
    const newTask: Task = {
      ...task,
      id,
      createdAt: new Date(),
    }
    setTasks(prev => [newTask, ...prev])
    return id
  }, [])

  const updateTask = useCallback((id: string, updates: Partial<Task>) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          const updated = { ...t, ...updates }
          // 如果任务完成，记录完成时间
          if (updates.status === 'completed' || updates.status === 'failed') {
            updated.completedAt = new Date()
          }
          return updated
        }
        return t
      })
    )
  }, [])

  const removeTask = useCallback((id: string) => {
    setTasks(prev => prev.filter(t => t.id !== id))
  }, [])

  const removeProjectTasks = useCallback((projectId: string) => {
    setTasks(prev => prev.filter(t => t.projectId !== projectId))
  }, [])

  const clearCompleted = useCallback(() => {
    setTasks(prev => prev.filter(t => t.status !== 'completed'))
  }, [])

  const getProjectTasks = useCallback(
    (projectId: string) => tasks.filter(t => t.projectId === projectId),
    [tasks]
  )

  // 获取超时的任务
  const getTimedOutTasks = useCallback(() => {
    const now = Date.now()
    return tasks.filter(t => 
      (t.status === 'running' || t.status === 'pending') &&
      now - t.createdAt.getTime() > TASK_TIMEOUT_MS
    )
  }, [tasks])

  // 重试任务（标记为待重试，需要外部处理实际重试逻辑）
  const retryTask = useCallback((id: string) => {
    setTasks(prev =>
      prev.map(t => {
        if (t.id === id) {
          return {
            ...t,
            status: 'pending' as TaskStatus,
            progress: 0,
            message: '等待重试...',
            error: undefined,
            retryCount: (t.retryCount || 0) + 1,
            createdAt: new Date(),
          }
        }
        return t
      })
    )
  }, [])

  // 定时检测超时任务（已禁用）
  // useEffect(() => {
  //   if (TASK_TIMEOUT_MS <= 0) return // 超时已禁用
  //   const checkTimeout = () => { ... }
  //   const interval = setInterval(checkTimeout, 30000)
  //   return () => clearInterval(interval)
  // }, [])

  return (
    <TaskContext.Provider
      value={{ tasks, stats, addTask, updateTask, removeTask, removeProjectTasks, clearCompleted, getProjectTasks, retryTask, getTimedOutTasks }}
    >
      {children}
    </TaskContext.Provider>
  )
}

export function useTaskContext() {
  const context = useContext(TaskContext)
  if (context === undefined) {
    throw new Error('useTaskContext must be used within a TaskProvider')
  }
  return context
}
