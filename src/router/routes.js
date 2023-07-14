
const routes = [
  {
    path: '/',
    component: () => import('layouts/MainLayout.vue'),
    children: [
      { path: '', component: () => import('src/pages/Home.vue'), name: 'home', props: route => route?.query},
      {
        path: 'receive',
        name: 'receive-page',
        component: () => import('src/pages/ReceivePage.vue'),
        props: route => Object.assign(route.query, {
          setAmount: Number(route.query?.setAmount) || route.query?.setAmount,
          lockAmount: String(route.query?.lockAmount).toLowerCase() === 'false' ? false : Boolean(route.query?.lockAmount),
        }),
      },
      { path: 'receive/select', component: () => import('src/pages/SelectReceivePage.vue'), name: 'select-receive-page'},
      { path: 'settings', component: () => import('pages/Settings.vue'), name: 'settings'}
    ]
  },
  {
    path: '/marketplace',
    component: () => import('layouts/MarketplaceLayout.vue'),
    children: [
      {
        path: '',
        meta: { requireAuth: true },
        children: [
          { path: '', component: () => import('src/pages/marketplace/index.vue'), name: 'marketplace', props: route => route?.query},
          { path: 'settings', component: () => import('src/pages/marketplace/MarketplaceSettings.vue'), name: 'marketplace-settings', props: route => route?.query},
          { path: 'products', component: () => import('src/pages/marketplace/products/ProductsPage.vue'), name: 'marketplace-products', props: route => route?.query},
          { path: 'products/add', component: () => import('src/pages/marketplace/products/AddProduct.vue'), name: 'marketplace-add-product', props: route => route?.query},
          { path: 'products/batch-add', component: () => import('src/pages/marketplace/products/BatchAddProduct.vue'), name: 'marketplace-batch-add-product', props: route => route?.query},
          { path: 'products/:productId/edit', component: () => import('src/pages/marketplace/products/UpdateProduct.vue'), name: 'marketplace-edit-product', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'inventory', component: () => import('src/pages/marketplace/inventory/StocksPage.vue'), name: 'marketplace-stocks', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'inventory/stocks/update', component: () => import('src/pages/marketplace/inventory/BatchStockUpdatePage.vue'), name: 'marketplace-stocks-update', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'inventory/stock-recounts/create', component: () => import('src/pages/marketplace/inventory/CreateStockRecount.vue'), name: 'marketplace-add-stock-recount', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'inventory/purchase-orders/create', component: () => import('src/pages/marketplace/inventory/CreatePurchaseOrderPage.vue'), name: 'marketplace-create-purchase-order', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'inventory/purchase-orders', component: () => import('src/pages/marketplace/inventory/PurchaseOrdersPage.vue'), name: 'marketplace-purchase-orders', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'inventory/purchase-orders/:purchaseOrderId', component: () => import('src/pages/marketplace/inventory/PurchaseOrderDetail.vue'), name: 'marketplace-purchase-order', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'staff', component: () => import('src/pages/marketplace/StaffPage.vue'), name: 'marketplace-staff', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'sales', component: () => import('src/pages/marketplace/sales/SalesPage.vue'), name: 'marketplace-sales', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'sales/:salesOrderId', component: () => import('src/pages/marketplace/sales/SalesOrderDetail.vue'), name: 'marketplace-sales-order', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'sales/reports', component: () => import('src/pages/marketplace/sales/SalesReportPage.vue'), name: 'marketplace-sales-reports', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'sales/create', component: () => import('src/pages/marketplace/sales/CreateSalePage.vue'), name: 'marketplace-sale', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'user', component: () => import('src/pages/marketplace/UserPage.vue'), name: 'marketplace-user', props: route => Object.assign({}, route?.query, route?.params)},
        ]
      },
      {
        path: 'storefront',
        meta: { requireAuth: true },
        children: [
          { path: '', component: () => import('src/pages/marketplace/storefront/index.vue'), name: 'marketplace-storefront', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'setup', component: () => import('src/pages/marketplace/storefront/SetupStorefrontPage.vue'), name: 'marketplace-storefront-setup', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'settings', redirect: { name: 'marketplace-storefront-setup' }, name: 'marketplace-storefront-settings' },
          { path: 'products', component: () => import('src/pages/marketplace/storefront/StorefrontProducts.vue'), name: 'marketplace-storefront-products', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'collections', component: () => import('src/pages/marketplace/storefront/CollectionsPage.vue'), name: 'marketplace-storefront-collections', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'collections/:collectionId', component: () => import('src/pages/marketplace/storefront/CollectionPage.vue'), name: 'marketplace-storefront-collection', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'orders', component: () => import('src/pages/marketplace/storefront/OrdersPage.vue'), name: 'marketplace-storefront-orders', props: route => Object.assign({}, route?.query, route?.params)},
          { path: 'orders/:orderId', component: () => import('src/pages/marketplace/storefront/OrderPage.vue'), name: 'marketplace-storefront-order', props: route => Object.assign({}, route?.query, route?.params)},
        ]
      },
      {
        path: 'auth',
        meta: { requireAuth: false },
        children: [
          { path: 'login', component: () => import('src/pages/marketplace/auth/LoginPage.vue'), name: 'marketplace-login', props: route => route?.query},
          { path: 'register', component: () => import('src/pages/marketplace/auth/RegisterPage.vue'), name: 'marketplace-register', props: route => route?.query},
        ]
      },
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
