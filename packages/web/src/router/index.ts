import { createRouter, createWebHistory } from 'vue-router'
import { session } from '@/lib/session'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
    { path: '/login', name: 'login', component: () => import('@/pages/LoginPage.vue'), meta: { public: true } },
    { path: '/signup', name: 'signup', component: () => import('@/pages/SignupPage.vue'), meta: { public: true } },
    { path: '/', name: 'overview', component: () => import('@/pages/OverviewPage.vue') },
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
      path: '/projects/:projectId/tests',
      name: 'tests',
      component: () => import('@/pages/TestsPage.vue'),
      props: true,
    },
    {
      path: '/projects/:projectId/test',
      name: 'test',
      component: () => import('@/pages/TestHistoryPage.vue'),
      props: true,
    },
  ],
  scrollBehavior: () => ({ top: 0 }),
})

// Wait for the session to resolve, then gate: guests to /login, authed users
// away from the public auth pages.
router.beforeEach(async (to) => {
  await session.ensure()
  const authed = !!session.user.value
  if (!authed && !to.meta.public)
    return { name: 'login' }
  if (authed && to.meta.public)
    return { name: 'overview' }
})
