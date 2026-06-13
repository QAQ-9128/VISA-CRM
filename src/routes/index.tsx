import { createBrowserRouter } from 'react-router-dom'
import type { RouteObject } from 'react-router-dom'
import { AuthLayout } from '../layouts/AuthLayout'
import { AppLayout } from '../layouts/AppLayout'
import { ProtectedRoute } from './ProtectedRoute'
import { RoleRoute } from './RoleRoute'
import { LoginPage } from '../pages/LoginPage'
import { DashboardPage } from '../pages/DashboardPage'
import { CustomerListPage } from '../pages/customers/CustomerListPage'
import { CustomerDetailPage } from '../pages/customers/CustomerDetailPage'
import { GroupManagementPage } from '../pages/customers/GroupManagementPage'
import { CustomerFormPage } from '../pages/customers/CustomerFormPage'
import { CasesPage } from '../pages/cases/CasesPage'
import { CaseFormPage } from '../pages/cases/CaseFormPage'
import { EmployerListPage } from '../pages/employers/EmployerListPage'
import { EmployerFormPage } from '../pages/employers/EmployerFormPage'
import { ReferrerListPage } from '../pages/referrers/ReferrerListPage'
import { ReferrerFormPage } from '../pages/referrers/ReferrerFormPage'
import { ImmiAccountsPage } from '../pages/immiAccounts/ImmiAccountsPage'
import { FinancePage } from '../pages/finance/FinancePage'
import { ArchivePage } from '../pages/archive/ArchivePage'
import { UserManagementPage } from '../pages/admin/UserManagementPage'
import { NotFoundPage } from '../pages/NotFoundPage'

/** 路由表（导出供 linkCoverage 测试做「全站链接都有路由承接」校验）。 */
export const appRoutes: RouteObject[] = [
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
          { path: 'customers/:id/group', element: <GroupManagementPage /> },
          // 案件详情页已删（案件功能全部在客户详情页 ?case= 选中）；保留 递交进度 + 新建/编辑表单
          { path: 'cases', element: <CasesPage /> },
          { path: 'cases/new', element: <CaseFormPage /> },
          { path: 'cases/:id/edit', element: <CaseFormPage /> },
          { path: 'employers', element: <EmployerListPage /> },
          { path: 'employers/new', element: <EmployerFormPage /> },
          { path: 'employers/:id/edit', element: <EmployerFormPage /> },
          { path: 'referrers', element: <ReferrerListPage /> },
          { path: 'referrers/new', element: <ReferrerFormPage /> },
          { path: 'referrers/:id/edit', element: <ReferrerFormPage /> },
          { path: 'immi-accounts', element: <ImmiAccountsPage /> },
          { path: 'finance', element: <FinancePage /> },
          { path: 'storage', element: <ArchivePage /> },
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
]

export const router = createBrowserRouter(appRoutes)
