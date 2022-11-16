
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('src/pages/Home.vue'), name: 'home'},
      { path: 'receive', component: () => import('src/pages/ReceivePage.vue'), props: route => route.query, name: 'receive-page'},
      { path: 'receive/select', component: () => import('src/pages/SelectReceivePage.vue'), name: 'select-receive-page'},
      { path: 'settings', component: () => import('pages/Settings.vue'), name: 'settings'}
    ]
  },

  // Always leave this as last one,
  // but you can also remove it
  {
    path: '/:catchAll(.*)*',
    component: () => import('pages/ErrorNotFound.vue')
  }
]

export default routes
