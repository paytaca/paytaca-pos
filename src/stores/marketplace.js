import { defineStore } from 'pinia';
import { backend } from 'src/marketplace/backend'
import { Shop, ROLES, User } from 'src/marketplace/objects';
import { useWalletStore } from './wallet';


export const useMarketplaceStore = defineStore('marketplace', {
  state: () => {
    return {
      fetchingUser: false,
      user: {
        id: 0,
        username: '',
        email: '',
        firstName: '',
        lastName: '',
        shopRoles: [{ shopId: 0, roles: [''] }],
      },
      fetchingMerchant: false,
      merchant: {
        id: 1,
        name: 'Dummy Data',
        paytacaWalletHash: '',
        currency: { code: '', symbol: '' },
      },
      fetchingShop: false,
      activeShopId: 1,
      lastShopSync: 0,
      shopData: {
        id: 0,
        watchtower_branch_id: null,
        merchant_id: 0,
        name: '',
        location: { id: 0, address1: '', address2: '', street: '', city: '', state: '', country: '', longitude: '', latitude: '' },
      },
      shopSettingsData: {
        id: 0,
        defaultPurchaseOrderReviewer: {
          id: 0, first_name: '', last_name: '',
        },
        startingPurchaseOrderNumber: 0,
        startingSalesOrderNumber: 0,
      }
    }
  },

  getters: {
    currency() {
      return this.merchant?.currency?.symbol
    },
    shop() {
      return Shop.parse(this.shopData)
    },
    shopSettings() {
      const data = Object.assign({}, this.shopSettingsData)
      data.defaultPurchaseOrderReviewer = User.parse(data.defaultPurchaseOrderReviewer)
      return data
    },
    shopUserRole() {
      return this.user.shopRoles?.find?.(shopRole => shopRole?.shopId === this.activeShopId)
    },
    hasRole() {
      return Boolean(this.shopUserRole && this.shopUserRole?.roles?.length)
    },
    userRoles() {
      if (!Array.isArray(this.shopUserRole?.roles)) return []
      return this.shopUserRole?.roles
    },
    userPermissions() {
      return {
        admin: this.userRoles?.indexOf?.(this.roles.admin) >= 0,
        inventory: this.userRoles?.indexOf?.(this.roles.inventory) >= 0,
        cashier: this.userRoles?.indexOf?.(this.roles.cashier) >= 0,
      }  
    },
    roles() {
      return ROLES
    },
  },
  actions: {
    clearShop() {
      this.setMerchant(null)
      this.setShopData(null)
      this.activeShopId = null
    },
    refetchShopSettings() {
      backend.get(`shops/${this.shop.id}/settings/`)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          this.setShopSettingsData(response?.data)
          return response
        })
    },
    /**
     * @param {Object} data 
     * @param {Number} data.id
     * @param {{id:Number, first_name:String, last_name:String}} [data.default_purchase_order_reviewer] 
     * @param {Number} data.starting_purchase_order_number
     * @param {Number} data.starting_sales_order_number
     */
    setShopSettingsData(data) {
      this.shopSettingsData = {
        id: data?.id,
        defaultPurchaseOrderReviewer: {
          id: data?.default_purchase_order_reviewer?.id,
          first_name: data?.default_purchase_order_reviewer?.first_name,
          last_name: data?.default_purchase_order_reviewer?.last_name,
        },
        startingPurchaseOrderNumber: data?.starting_purchase_order_number,
        startingSalesOrderNumber: data?.starting_sales_order_number,
      }
    },
    /**
     * 
     * @param {Object} opts 
     * @param {Boolean} opts.silent will set loading state if true
     * @param {Boolean} opts.forceSync will attempt to sync shop details with branch details in server instead of a `get or create` action if true
     * @param {Number} opts.forceSyncAge if forceSync is true, it will abort if the last forceSync timestamp is less than this age
     */
    updateActiveShopId(opts={silent: true, forceSync: false, forceSyncAge: 60 * 1000}) {
      const walletStore = useWalletStore()
      if (!walletStore.deviceInfo.branchId) return Promise.reject(this.clearShop())
      if (!opts?.silent) this.fetchingShop = true

      let path = `shops/resolve-watchtower-branch/${walletStore.deviceInfo.branchId}/`
      if (opts?.forceSync) path = `shops/sync-watchtower-branch/${walletStore.deviceInfo.branchId}/`

      if (opts?.forceSync && (this.lastShopSync + opts?.forceSyncAge > Date.now())) return Promise.reject('last force sync is less than age')
      
      return backend.post(path)
        .finally(() => {
          if (!opts?.silent) this.fetchingShop = false
        })
        .then(response => {
          const shopData = response?.data
          if (!shopData?.id) return Promise.reject({ response })
          this.activeShopId = shopData.id
          this.setShopData(shopData)

          if (this.shopData?.merchant_id != this.merchant?.id) this.refetchMerchant()
          if (opts?.forceSync) this.lastShopSync = Date.now()
          return response
        })
        .catch(error => {
          if (error?.response?.status === 404) this.clearShop()
          return Promise.reject(error)
        })
    },
    refetchShop(opts={ silent: true }) {
      if (!this.activeShopId) return Promise.reject()
      if (!opts?.silent) this.fetchingShop = true
      return backend.get(`shops/${this.activeShopId}/`)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          this.setShopData(response?.data)
          return response
        })
        .finally(() => {
          if (!opts?.silent) this.fetchingShop = false
        })
    },
    setShopData(data) {
      this.shopData = {
        id: data?.id,
        watchtower_branch_id: data?.watchtower_branch_id,
        merchant_id: data?.merchant_id,
        name: data?.name,
        location: {
          id: data?.location?.id,
          address1: data?.location?.address1,
          address2: data?.location?.address2,
          street: data?.location?.street,
          city: data?.location?.city,
          state: data?.location?.state,
          country: data?.location?.country,
          longitude: data?.location?.longitude,
          latitude: data?.location?.latitude,
        },
      }
    },
    refetchMerchant(opts={ silent: true }) {
      const merchantId = this.shopData?.merchant_id || this.merchant?.id
      if (!merchantId) return Promise.reject()

      if (!opts?.silent) this.fetchingMerchant = true
      return backend.get(`merchants/${merchantId}/`)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          this.setMerchant(response?.data)
          return response
        })
        .finally(() => {
          if (!opts?.silent) this.fetchingMerchant = false
        })
    },
    setMerchant(data) {
      this.merchant = {
        id: data?.id,
        name: data?.name,
        paytacaWalletHash: data?.paytaca_wallet_hash,
        currency: {
          code: data?.currency?.code,
          symbol: data?.currency?.symbol,
        }
      }
    },
    refreshUser(opts = { silent: true }) {
      if (!opts?.silent) this.fetchingUser = true
      return backend.get('users/me/')
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          this.setUser(response?.data)
          return response
        })
        .catch(error => {
          if (error?.response?.status === 401) this.setUser(null)
          return Promise.reject(error)
        })
        .finally(() => {
          this.fetchingUser = false
        })
    },
    /**
     * 
     * @param {Object} data 
     * @param {Number} data.id
     * @param {String} data.first_name
     * @param {String} data.last_name
     * @param {String} data.username
     * @param {String} data.email
     * @param {{ shop_id:Number, roles: String[] }[]} data.shop_roles
     */
    setUser(data) {
      this.user = {
        id: data?.id,
        firstName: data?.first_name,
        lastName: data?.last_name,
        username: data?.username,
        email: data?.email,
        shopRoles: data?.shop_roles?.map?.(shopRole => {
          return { shopId: shopRole?.shop_id, roles: shopRole.roles }
        }),
      }
    }
  }
})