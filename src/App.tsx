import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { TooltipProvider } from '@/components/ui/tooltip'
import { MainLayout } from '@/components/layout/MainLayout'
import { ProjectProvider } from '@/contexts/ProjectContext'
import { TaskProvider } from '@/contexts/TaskContext'
import { AuditProvider } from '@/contexts/AuditContext'
import {
  ProjectList,
  NewProject,
  ProjectWorkspace,
  ProjectConfirm,
  ProjectFiles,
  FileFields,
  ProjectLedger,
  ProjectAudit,
  ProjectRisks,
  Dashboard,
  AuditRules,
} from '@/pages'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      retry: 3,
    },
  },
})

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <TaskProvider>
        <AuditProvider>
          <ProjectProvider>
            <TooltipProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Navigate to="/dashboard" replace />} />
                <Route element={<MainLayout />}>
                  <Route path="/dashboard" element={<Dashboard />} />
                  <Route path="/projects" element={<ProjectList />} />
                  <Route path="/projects/new" element={<NewProject />} />
                  <Route path="/projects/:id" element={<ProjectWorkspace />} />
                  <Route path="/projects/:id/confirm" element={<ProjectConfirm />} />
                  <Route path="/projects/:id/files" element={<ProjectFiles />} />
                  <Route path="/projects/:id/files/:fileId" element={<FileFields />} />
                  <Route path="/projects/:id/ledger" element={<ProjectLedger />} />
                  <Route path="/projects/:id/audit" element={<ProjectAudit />} />
                  <Route path="/projects/:id/risks" element={<ProjectRisks />} />
                  <Route path="/audit-rules" element={<AuditRules />} />
                </Route>
              </Routes>
            </BrowserRouter>
            </TooltipProvider>
          </ProjectProvider>
        </AuditProvider>
      </TaskProvider>
    </QueryClientProvider>
  )
}

export default App
