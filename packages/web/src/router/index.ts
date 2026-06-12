import { createRouter, createWebHistory } from 'vue-router'
import { session } from '@/lib/session'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
    { path: '/signup', name: 'signup', component: () => import('@/pages/SignupPage.vue'), meta: { public: true } },
    { path: '/', name: 'overview', component: () => import('@/pages/OverviewPage.vue') },
    {
      path: '/settings',
      component: () => import('@/pages/SettingsLayout.vue'),
      children: [
        { path: '', redirect: { name: 'settings-account' } },
        { path: 'account', name: 'settings-account', component: () => import('@/pages/AccountSettingsPage.vue') },
        { path: 'workspace', name: 'settings-workspace', component: () => import('@/pages/WorkspaceSettingsPage.vue') },
      ],
    },
    {
      path: '/accept-invite/:invitationId',
      name: 'accept-invite',
      component: () => import('@/pages/AcceptInvitePage.vue'),
      props: true,
      meta: { invite: true },
    },
    {
      path: '/projects/:projectId',
      name: 'project',
      component: () => import('@/pages/ProjectPage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/runs/:runId',
      name: 'run',
      component: () => import('@/pages/RunPage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/compare',
      name: 'compare',
      component: () => import('@/pages/ComparePage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/tests',
      name: 'tests',
      component: () => import('@/pages/TestsPage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/settings',
      name: 'project-settings',
      component: () => import('@/pages/ProjectSettingsPage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/test',
      name: 'test',
      component: () => import('@/pages/TestHistoryPage.vue'),
      props: true,
    },
    { path: '/:pathMatch(.*)*', name: 'not-found', component: () => import('@/pages/NotFoundPage.vue') },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Wait for the session to resolve, then gate: guests to /login, authed users
// away from the public auth pages.
router.beforeEach(async (to) => {
  await session.ensure()
  const authed = !!session.user.value
  // Invite acceptance handles both guest and authed states itself.
  if (to.meta.invite)
    return
  if (!authed && !to.meta.public)
    return { name: 'login' }
  if (authed && to.meta.public)
    return { name: 'overview' }
})
