import { route } from 'quasar/wrappers'
import { createRouter, createMemoryHistory, createWebHistory, createWebHashHistory } from 'vue-router'
import routes from './routes'
import { App } from '@capacitor/app'
window.App = App

/*
 * If not building with SSR mode, you can
 * directly export the Router instantiation;
 *
 * The function below can be async too; either use
 * async/await or return a Promise which resolves
 * with the Router instance.
 */

export default route(function (/* { store, ssrContext } */) {
  const Router = getRouter()

  App.addListener('appUrlOpen', event => {
    const url = new URL(event?.url)
    console.log(url)
    if (url.pathname.includes('link') && url.searchParams.get('code')) {
      Router.push({ name: 'home', query: { walletLinkUrl: url.searchParams.get('code') } })
    }
  })

  return Router
})

let _Router
/**
 * @returns {import('vue-router').Router}
 */
export function getRouter() {
  if (!_Router) {
    const createHistory = process.env.SERVER
    ? createMemoryHistory
    : (process.env.VUE_ROUTER_MODE === 'history' ? createWebHistory : createWebHashHistory)

    _Router = createRouter({
      scrollBehavior: () => ({ left: 0, top: 0 }),
      routes,
  
      // Leave this as is and make changes in quasar.conf.js instead!
      // quasar.conf.js -> build -> vueRouterMode
      // quasar.conf.js -> build -> publicPath
      history: createHistory(process.env.MODE === 'ssr' ? void 0 : process.env.VUE_ROUTER_BASE)
    })
  }
  return _Router
}
