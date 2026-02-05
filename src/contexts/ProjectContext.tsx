import { createContext, useContext, useState, useEffect, useCallback, type ReactNode } from 'react'

// 项目数据类型
export interface ProjectData {
  id: string
  name: string
  status: 'draft' | 'extracting' | 'auditing' | 'completed'
  tenderFileId: string | null  // 智能体平台的文件ID
  tenderDsId: number | null    // 知识库数据集ID
  createdAt: string
  updatedAt: string
}

// 项目字段值
export interface ProjectFieldValue {
  projectId: string
  fieldCode: string
  fieldName: string
  value: string | null
  status: 'auto' | 'confirmed' | 'modified' | 'missing'
  groupName?: string
}

// 项目文件
export interface ProjectFileData {
  id: string
  projectId: string
  fileName: string
  fileSize: number
  mimeType: string
  fileId: string         // 智能体平台的文件ID
  dsId: number           // 知识库数据集ID
  docTypeCode: string | null
  docTypeName: string | null
  status: 'pending' | 'classified' | 'confirmed'
  extractionStatus: 'pending' | 'processing' | 'completed' | 'failed'
  createdAt: string
}

// Context 状态
interface ProjectContextState {
  // 当前项目
  currentProject: ProjectData | null
  currentFields: ProjectFieldValue[]
  currentFiles: ProjectFileData[]
  
  // 操作方法
  createProject: (data: {
    name: string
    tenderFileId: string | null
    tenderDsId: number | null
    fields: ProjectFieldValue[]
  }) => ProjectData
  
  updateProject: (id: string, updates: Partial<ProjectData>) => void
  
  addFile: (file: ProjectFileData) => void
  updateFile: (fileId: string, updates: Partial<ProjectFileData>) => void
  
  loadProject: (id: string) => void
  
  // 所有项目列表
  projects: ProjectData[]
}

const ProjectContext = createContext<ProjectContextState | null>(null)

// localStorage keys
const STORAGE_KEYS = {
  PROJECTS: 'audit_app_projects',
  FIELDS: 'audit_app_fields',
  FILES: 'audit_app_files',
}

export function ProjectProvider({ children }: { children: ReactNode }) {
  const [projects, setProjects] = useState<ProjectData[]>([])
  const [allFields, setAllFields] = useState<ProjectFieldValue[]>([])
  const [allFiles, setAllFiles] = useState<ProjectFileData[]>([])
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null)

  // 从 localStorage 加载数据
  useEffect(() => {
    try {
      const savedProjects = localStorage.getItem(STORAGE_KEYS.PROJECTS)
      const savedFields = localStorage.getItem(STORAGE_KEYS.FIELDS)
      const savedFiles = localStorage.getItem(STORAGE_KEYS.FILES)
      
      if (savedProjects) setProjects(JSON.parse(savedProjects))
      if (savedFields) setAllFields(JSON.parse(savedFields))
      if (savedFiles) setAllFiles(JSON.parse(savedFiles))
    } catch (error) {
      console.error('加载本地数据失败:', error)
    }
  }, [])

  // 保存到 localStorage
  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.PROJECTS, JSON.stringify(projects))
  }, [projects])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FIELDS, JSON.stringify(allFields))
  }, [allFields])

  useEffect(() => {
    localStorage.setItem(STORAGE_KEYS.FILES, JSON.stringify(allFiles))
  }, [allFiles])

  // 当前项目数据
  const currentProject = projects.find(p => p.id === currentProjectId) || null
  const currentFields = allFields.filter(f => f.projectId === currentProjectId)
  const currentFiles = allFiles.filter(f => f.projectId === currentProjectId)

  // 创建项目
  const createProject = useCallback((data: {
    name: string
    tenderFileId: string | null
    tenderDsId: number | null
    fields: ProjectFieldValue[]
  }): ProjectData => {
    const now = new Date().toISOString()
    const projectId = `project-${Date.now()}`
    
    const newProject: ProjectData = {
      id: projectId,
      name: data.name,
      status: 'draft',
      tenderFileId: data.tenderFileId,
      tenderDsId: data.tenderDsId,
      createdAt: now,
      updatedAt: now,
    }
    
    // 保存项目
    setProjects(prev => [...prev, newProject])
    
    // 保存字段（关联项目ID）
    const fieldsWithProjectId = data.fields.map(f => ({
      ...f,
      projectId,
    }))
    setAllFields(prev => [...prev, ...fieldsWithProjectId])
    
    // 设置当前项目
    setCurrentProjectId(projectId)
    
    console.log('[ProjectContext] 创建项目:', newProject)
    console.log('[ProjectContext] 保存字段:', fieldsWithProjectId.length, '个')
    
    return newProject
  }, [])

  // 更新项目
  const updateProject = useCallback((id: string, updates: Partial<ProjectData>) => {
    setProjects(prev => prev.map(p => 
      p.id === id 
        ? { ...p, ...updates, updatedAt: new Date().toISOString() }
        : p
    ))
  }, [])

  // 添加文件
  const addFile = useCallback((file: ProjectFileData) => {
    setAllFiles(prev => [...prev, file])
    console.log('[ProjectContext] 添加文件:', file.fileName)
  }, [])

  // 更新文件
  const updateFile = useCallback((fileId: string, updates: Partial<ProjectFileData>) => {
    setAllFiles(prev => prev.map(f =>
      f.id === fileId ? { ...f, ...updates } : f
    ))
  }, [])

  // 加载项目
  const loadProject = useCallback((id: string) => {
    setCurrentProjectId(id)
  }, [])

  const value: ProjectContextState = {
    currentProject,
    currentFields,
    currentFiles,
    createProject,
    updateProject,
    addFile,
    updateFile,
    loadProject,
    projects,
  }

  return (
    <ProjectContext.Provider value={value}>
      {children}
    </ProjectContext.Provider>
  )
}

export function useProject() {
  const context = useContext(ProjectContext)
  if (!context) {
    throw new Error('useProject must be used within a ProjectProvider')
  }
  return context
}
