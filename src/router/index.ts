import { createRouter, createWebHistory } from 'vue-router'

export const router = createRouter({
  history: createWebHistory(),
  routes: [
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
