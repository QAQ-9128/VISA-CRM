import { createBrowserRouter } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppLayout } from '../layouts/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleRoute } from './RoleRoute'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { CustomerListPage } from '../pages/customers/CustomerListPage'
import { CustomerDetailPage } from '../pages/customers/CustomerDetailPage'
import { CustomerFormPage } from '../pages/customers/CustomerFormPage'
import { CaseBoardPage } from '../pages/cases/CaseBoardPage'
import { CaseListPage } from '../pages/cases/CaseListPage'
import { CaseDetailPage } from '../pages/cases/CaseDetailPage'
import { CaseFormPage } from '../pages/cases/CaseFormPage'
import { EmployerListPage } from '../pages/employers/EmployerListPage'
import { EmployerFormPage } from '../pages/employers/EmployerFormPage'
import { UserManagementPage } from '../pages/admin/UserManagementPage'
import { NotFoundPage } from '../pages/NotFoundPage'

export const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [{ path: '/login', element: <LoginPage /> }],
  },
  {
    // 鉴权守卫 → 主壳 → 业务页面
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { index: true, element: <DashboardPage /> },
          { path: 'customers', element: <CustomerListPage /> },
          { path: 'customers/new', element: <CustomerFormPage /> },
          { path: 'customers/:id', element: <CustomerDetailPage /> },
          { path: 'customers/:id/edit', element: <CustomerFormPage /> },
          { path: 'cases', element: <CaseBoardPage /> },
          { path: 'cases/list', element: <CaseListPage /> },
          { path: 'cases/new', element: <CaseFormPage /> },
          { path: 'cases/:id', element: <CaseDetailPage /> },
          { path: 'cases/:id/edit', element: <CaseFormPage /> },
          { path: 'employers', element: <EmployerListPage /> },
          { path: 'employers/new', element: <EmployerFormPage /> },
          { path: 'employers/:id/edit', element: <EmployerFormPage /> },
          {
            path: 'admin/users',
            element: (
              <RoleRoute role="admin">
                <UserManagementPage />
              </RoleRoute>
            ),
          },
        ],
      },
    ],
  },
  { path: '*', element: <NotFoundPage /> },
])
