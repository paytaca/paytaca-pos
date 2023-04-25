import { backend } from "./backend"

export const ROLES = Object.freeze({
  admin: 'shop_admin',
  inventory: 'inventory_control_manager',
  cashier: 'cashier',
})

export class Location {
  static parse(data) {
    return new Location(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {String} data.address1
   * @param {String} data.address2
   * @param {String} data.street
   * @param {String} data.city
   * @param {String} data.state
   * @param {String} data.country
   * @param {String} data.longitude
   * @param {String} data.latitude
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.address1 = data?.address1
    this.address2 = data?.address2
    this.street = data?.street
    this.city = data?.city
    this.state = data?.state
    this.country = data?.country
    this.longitude = data?.longitude
    this.latitude = data?.latitude
  }

  get formatted() {
    const addressStr = [this.address2, this.address1].filter(Boolean).join(' ')
    return [addressStr, this.street, this.city, this.state, this.country].filter(Boolean).join(', ') 
  }
}

export class StockAdjustment {
  static parse(data) {
    return new StockAdjustment(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.source
   * @param {"set" | "add"} data.adjust_type
   * @param {Number} data.previous_quantity
   * @param {Number} data.quantity the meaning of this value depends on the adjust_type
   * @param {Number} [data.sales_order_id]
   * @param {Number} [data.purchase_order_id]
   * @param {Number} [data.stock_recount_id]
   * @param {String} data.created_at
   * @param {{ id:Number, first_name:String, last_name:String }} data.created_by
   */
  set raw(data) {
    this.id = data?.id
    this.source = data?.source
    this.adjustType = data?.adjust_type
    this.previousQuantity = data?.previous_quantity
    this.quantity = data?.quantity
    this.salesOrderId = data?.sales_order_id
    this.purchaseOrderId = data?.purchase_order_id
    this.stockRecountId = data?.stock_recount_id
    this.createdAt = new Date(data?.created_at)
    this.createdBy = {
      id: data?.created_by?.id,
      firstName: data?.created_by?.first_name,
      lastName: data?.created_by?.last_name,
    }
  }

  async fetchSalesOrder() {
    if (!this.salesOrderId) return Promise.reject()
    return backend.get(`sales-orders/${this.salesOrderId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.salesOrder = SalesOrder.parse(response?.data)
        return response
      })
  }

  async fetchPurchaseOrder() {
    if(!this.purchaseOrderId) return Promise.reject()
    return backend.get(`purchase-orders/${this.purchaseOrderId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.purchaseOrder = PurchaseOrder.parse(response?.data)
        return response
      })
  }

  async fetchStockRecount() {
    if (!this.stockRecountId) return Promise.reject()
    return backend.get(`stock-recounts/${this.stockRecountId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.stockRecount = StockRecount.parse(response?.data)
        return response
      })
  }
}

export class Stock {
  static parse(data) {
    return new Stock(data)
  }

  constructor(data) {
    this.raw = data

    this.$state = {
      updating: false,
      updatingFields: new Set(),
      fetchingAdjustments: false,
      fetchingProduct: false,
      fetchingPurchaseOrder: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Object} data.variant
   * @param {Number} data.variant.id
   * @param {Number} data.variant.code
   * @param {String} data.variant.image_url
   * @param {String} data.variant.name
   * @param {Object} data.variant.product
   * @param {Number} data.variant.product.id
   * @param {String} data.variant.product.image_url
   * @param {String} data.variant.product.name
   * @param {Number} data.quantity
   * @param {Number} [data.cost_price]
   * @param {String} [data.expires_at]
   * @param {{id: Number: name: String }} data.shop
   * @param {Object} data.metadata
   * @param {Number} [data.purchase_order_id]
   * @param {String} [data.purchase_order_number]
   * @param {String} data.created_at
   * @param {String} data.updated_at
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.variant = Variant.parse(data?.variant)
    this.quantity = data?.quantity
    this.costPrice = data?.cost_price
    this.shop = data?.shop
    if (data?.expires_at) this.expiresAt = new Date(data?.expires_at)
    else if(this.expiresAt) this.expiresAt = undefined
    this.metadata = data?.metadata
    this.purchaseOrderId = data?.purchase_order_id
    this.purchaseOrderNumber = data?.purchase_order_number
    this.createdAt = new Date(data?.created_at)
    this.updatedAt = new Date(data?.updated_at)
  }

  get imageUrl() {
    return this.variant.imageUrl || this.variant.product.imageUrl
  }

  get itemName() {
    let variantName = this.variant?.name
    let productName = this.variant?.product?.name
    if (!this.variant.id) {
      variantName = variantName || this.metadata?.variant_name
      productName = productName || this.metadata?.product_name
    }
    if (variantName) return `${productName}- ${variantName}`
    return productName
  }

  async fetchProduct() {
    if (!this.variant.product.id) return Promise.reject()
    this.$state.fetchingProduct = true
    return backend.get(`products/${this.variant.product.id}/`).then(response => {
      if (response?.data?.id != this.variant.product.id) return Promise.reject({ response })
      this.product = Product.parse(response.data)
      return this.product
    }).finally(() => {
      this.$state.fetchingProduct = false
    })
  }

  async fetchPurchaseOrder() {
    if (!this.purchaseOrderId) return Promise.reject()

    this.$state.fetchingPurchaseOrder = true
    return backend.get(`purchase-orders/${this.purchaseOrderId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.purchaseOrder = PurchaseOrder.parse(response?.data)
        return response
      })
      .finally(() => {
        this.$state.fetchingPurchaseOrder = false
      })
  }

  async fetchAdjustments(opts={ append: true, limit: 0 }) {
    if (!this.id) return Promise.reject()

    const params = {
      limit: opts?.limit || 5,
    }

    if (opts?.append && Array.isArray(this.adjustments?.data)) {
      this.normalizeAdjustments()
      const dates = this.adjustments.data.map(adjustment => adjustment?.createdAt)?.filter(Boolean)
      const earliest = dates.at(-1)
      if (earliest) params.created_before = earliest.toISOString()
    }

    this.$state.fetchingAdjustments = true
    return backend.get(`stocks/${this.id}/adjustments/`, { params }).then(response => {
      if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
      if (!this.adjustments) this.adjustments = { data: [].map(StockAdjustment.parse), hasMore: false }
    
      this.adjustments.hasMore = response?.data?.count > response?.data?.limit
      const parsedData = response?.data?.results?.map(StockAdjustment.parse)
      if (opts?.append && Array.isArray(this.adjustments.data)) {
        this.adjustments.data = [...this.adjustments.data, ...parsedData]
      } else {
        this.adjustments.data = parsedData
      }
      this.normalizeAdjustments()
      return response
    }).finally(() => {
      this.$state.fetchingAdjustments = false
    })
  }

  /**
   * Sort adjustments by createdAt in descending order, and
   * removes duplicates
   */
  normalizeAdjustments() {
    if (!Array.isArray(this.adjustments?.data)) return
    this.adjustments.data.sort((adjustment1, adjustment2) => {
      return adjustment2?.createdAt - adjustment1?.createdAt
    })

    const uniqueIdFilter = (element, index, list) => {
      return list.findIndex(_element => element?.id == _element?.id) === index
    }
    this.adjustments.data = this.adjustments.data.filter(uniqueIdFilter)
  }

  async refetch(params={}) {
    if (!this.id) return
    this.$state.updating = true
    return backend.get(`stocks/${this.id}/`, { params })
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }
}

export class Variant {
  static parse(data) {
    return new Variant(data)
  }

  /**
   * @param {any} data 
   * @param {Product} [product] 
   */
  constructor(data, product) {
    this.raw = data
    if (product) this.product = product
    this.$state = {
      updating: false,
      fetchingStocks: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {Number} data.position
   * @param {String} data.code
   * @param {String} data.image_url
   * @param {String} data.name
   * @param {Number} data.price
   * @param {Number} data.total_stocks
   * @param {Number} data.expired_stocks
   * @param {{ id:Number, name:String, image_url:String }} [data.product]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.position = data?.position
    this.code = data?.code
    this.imageUrl = data?.image_url
    this.name = data?.name
    this.price = data?.price
    this.totalStocks = data?.total_stocks
    this.expiredStocks = data?.expired_stocks

    if (data?.product?.id) this.product = Product.parse(data?.product)
  }

  get itemImage() {
    return this.imageUrl || this.product?.imageUrl
  }

  get itemName() {
    return [this?.product?.name, this.name].filter(Boolean).join(' - ')
  }

  async fetchStocks(opts={ shop_id: undefined }) {
    const params = Object.assign({}, opts, {
      variant_id: this.id
    })

    this.$state.fetchingStocks = true
    return backend.get('/stocks/', { params })
      .then(({ data }) => {
        if (!Array.isArray(data?.results)) return
        this.stocks = data.results.map(Stock.parse)
        return this.stocks
      })
      .finally(() => {
        this.$state.fetchingStocks = false
      })
  }
}

export class Product {
  static parse(data) {
    return new Product(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
      fetchingStocks: false,
      fetchingShops: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data 
   * @param {Number} data.id
   * @param {String} [data.code]
   * @param {String[]} data.categories
   * @param {String} data.image_url
   * @param {String} [data.variant_image_url]
   * @param {String} data.name
   * @param {String} [data.description]
   * @param {Number} data.total_stocks
   * @param {Number} data.expired_stocks
   * @param {Number} data.variants_count
   * @param {String} [data.created_at]
   * @param {Number[]} data.shop_ids
   * @param {Object[]} [data.variants]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.code = data?.code
    if (Array.isArray(data?.categories)) this.categories = [...data.categories]
    this.imageUrl = data?.image_url
    this.variantImageUrl = data?.variant_image_url
    this.name = data?.name
    this.description = data?.description
    this.totalStocks = data?.total_stocks
    this.expiredStocks = data?.expired_stocks
    this.variantsCount = data?.variants_count
    this.shopIds = data?.shop_ids
    if(data?.created_at) this.createdAt = new Date(data?.created_at)

    this.updateVariants(data?.variants)
  }

  get hasVariants() {
    return (this.variantsCount || this.variants?.length) > 1
  }

  get displayImageUrl() {
    if (this.imageUrl) return this.imageUrl
    if (this.variantImageUrl) return this.variantImageUrl

    if (Array.isArray(this.variants)) {
      return this.variants.map(variant => variant.imageUrl).find(Boolean)
    }
    return ''
  }

  updateVariants(variantsData=[]) {
    const oldVariants = this.variants
    this.variants = [].map(Variant.parse)
    if (Array.isArray(variantsData)) {
      this.variants = variantsData.map(variantData => {
        const existingVariant = oldVariants?.find?.(variant => variant?.id === variantData?.id)

        if (!existingVariant) return new Variant(variantData, this)
        existingVariant.raw = variantData
        existingVariant.product = this
        return existingVariant
      })
    }
  }

  async refetch(params={}) {
    if (!this.id) return
    this.$state.updating = true
    return backend.get(`products/${this.id}/`, { params })
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }

  async fetchVariants() {
    if (!this.id) return Promise.reject()
    return backend.get(`products/${this.id}/variants/`).then(response => {
      if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
      this.updateVariants(response.data?.results)
      return response
    })
  }

  async fetchStocks() {
    this.$state.fetchingStocks = true
    return backend.get('/stocks/', { params: { product_id: this.id } })
      .then(({ data }) => {
        if (!Array.isArray(data?.results)) return
        
        this.stocks = data.results.map(Stock.parse)
        this.variants.forEach(variant => {
          variant.stocks = this.stocks.filter(stock => stock.variant.id == variant.id)
        })
    
        return this.stocks
      })
      .finally(() => {
        this.$state.fetchingStocks = false
      })
  }
}


export class Shop {
  static parse(data) {
    return new Shop(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} [data.watchtower_branch_id]
   * @param {Number} data.id
   * @param {String} data.name
   * @param {Number} [data.product_listing_id]
   * @param {Object} data.location
   * @param {String} data.location.address1
   * @param {String} data.location.address2
   * @param {String} data.location.street
   * @param {String} data.location.city
   * @param {String} data.location.state
   * @param {String} data.location.country
   * @param {String} data.location.longitude
   * @param {String} data.location.latitude
  */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.watchtowerBranchId = data?.watchtower_branch_id
    this.id = data?.id
    this.name = data?.name
    this.productListingId = data?.product_listing_id
    this.location = Location.parse(data?.location)
  }
}


export class User {
  static parse(data) {
    return new User(data)
  }

  static parseShopRole(shopRole) {
    return {
      shopId: shopRole?.shop_id,
      roles: Array.isArray(shopRole?.roles) ? shopRole?.roles : [],
    }
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
  }

  get raw() {
    return this.$raw
  }
  
  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} [data.email]
   * @param {String} [data.username]
   * @param {String} data.first_name
   * @param {String} data.last_name
   * @param {{ user_id:Number, shop_id:Number, roles:String[] }[]} [data.shop_roles]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.email = data?.email
    this.username = data?.username
    this.firstName = data?.first_name
    this.lastName = data?.last_name
    if (Array.isArray(data?.shop_roles)) {
      this.shopRoles = data.shop_roles.map(User.parseShopRole)
    } else {
      this.shopRoles = [].map(User.parseShopRole)
    }
  }

  get fullName() {
    return [this.firstName, this.lastName].filter(Boolean).join(' ')
  }

  getRolesFromShop(shopId) {
    const shopRole = this.shopRoles?.find?.(shopRole => shopRole?.shopId == shopId)
    if (Array.isArray(shopRole?.roles)) return shopRole.roles
    return []
  }
}

export class SalesOrderItem {
  static parse(data) {
    return new SalesOrderItem(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Object} data.variant
   * @param {Number} data.price
   * @param {Number} data.quantity
   * @param {String} data.item_name
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.variant = Variant.parse(data?.variant)
    this.price = data?.price
    this.quantity = data?.quantity
    this.itemName = data?.item_name
  }
}

export class SalesOrder {
  static parse(data) {
    return new SalesOrder(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      updating: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} [data.number]
   * @param {Number} data.total
   * @param {String} data.transaction_date
   * @param {String} data.created_at
   * @param {{ id:Number, first_name:String, last_name:String }} data.created_by
   * @param {{ code:String, symbol:String }} data.currency
   * @param {{ id:Number, name:String }} data.shop
   * @param {Object[]} [data.items]
   * @param {Number} [data.items_count]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.number = data?.number
    if (data?.transaction_date) this.transactionDate = new Date(data?.transaction_date)
    this.total = data?.total
    this.currency = {
      code: data?.currency?.code,
      symbol: data?.currency?.symbol,
    }
    this.shop = { id: data?.shop?.id, name: data?.shop?.name }
    this.createdAt = new Date(data?.created_at)
    this.createdBy = {
      id: data?.created_by?.id,
      firstName: data?.created_by?.first_name,
      lastName: data?.created_by?.last_name,
    }

    this.itemsCount = data?.items_count
    if (Array.isArray(data?.items)) this.items = data?.items.map(SalesOrderItem.parse)
  }

  async fetchItems() {
    if (!this.id) return Promise.reject()

    this.$state.updating = true
    return backend.get(`sales-orders/${this.id}/items/`)
      .then(response => {
        if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
        this.items = response?.data?.results.map(SalesOrderItem.parse)
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }

  async refetch() {
    if (!this.id) return Promise.reject()
    this.$state.updating = true
    return backend.get(`sales-orders/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.updating = false
      })
  }
}


export class Vendor {
  static parse(data) {
    return new Vendor(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      loading: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.name
   * @param {String} data.phone_number
   * @param {Object} data.location
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.name = data?.name
    this.phoneNumber = data?.phone_number
    this.location = Location.parse(data?.location)
  }

  async refetch() {
    if (!this.id) return Promise.reject()

    this.$state.loading = true
    return backend.get(`vendors/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  } 
}

export class PurchaseOrderItem {
  static parse(data) {
    return new PurchaseOrderItem(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Object} data.variant
   * @param {String} data.item_name
   * @param {Number} data.quantity
   * @param {Number} data.cost_price
   * @param {String} [data.delivered_at]
   * @param {Number} [data.stock_id]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })
    this.id = data?.id
    this.variant = Variant.parse(data?.variant)
    this.quantity = data?.quantity
    this.costPrice = data?.cost_price
    if (data?.delivered_at) this.deliveredAt = new Date(data.delivered_at)
    else if (this.deliveredAt) this.deliveredAt = undefined
    if (data?.stock_id) this.stockId = data.stock_id
  }

  get variantName() {
    return [this.variant?.product?.name, this.variant?.name].filter(Boolean).join('- ')
  }

  async fetchStock() {
    if (this.stockId) return Promise.reject()

    return backend.get(`stocks/${this.stockId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.stock = Stock.parse(response?.data)
        return response
      })
  }
}

export class PurchaseOrder {
  static parse(data) {
    return new PurchaseOrder(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      loading: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.status
   * @param {String} data.date
   * @param {Number} data.number
   * @param {{ code:String, symbol:String }} data.currency
   * @param {{ id:Number, name:String }} data.shop
   * @param {{ id:Number, name:String, phone_number:String, location:Object }} data.vendor
   * @param {Number} [data.items_count]
   * @param {Object[]} [data.items]
   * @param {String} data.reviewed_at
   * @param {Object} data.reviewed_by
   * @param {String} data.created_at
   * @param {String} data.updated_at
   * @param {Object} data.created_by
   * @param {Object} data.updated_by
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.status = data?.status
    if(data?.date) this.date = new Date(data?.date)
    this.number = data?.number
    this.currency = data?.currency
    this.shop = data?.shop
    this.vendor = Vendor.parse(data?.vendor)
    this.itemsCount = data?.items_count
    if (Array.isArray(data?.items)) this.items = data?.items?.map(PurchaseOrderItem.parse)

    if (data?.reviewed_at) this.reviewedAt = new Date(data?.reviewed_at)
    this.reviewedBy = User.parse(data?.reviewed_by)

    if (data?.created_at) this.createdAt = new Date(data.created_at)
    if (data?.updated_at) this.updatedAt = new Date(data.updated_at)
    this.createdBy = User.parse(data?.created_by)
    this.updatedBy = User.parse(data?.updated_by)
  }

  get calculatedSubtotal() {
    if (!Array.isArray(this.items)) return

    return this.items
      .map(item => item.costPrice * item.quantity) 
      .filter(itemSubtotal => !isNaN(itemSubtotal))
      .reduce((subtotal, itemSubtotal) => subtotal + itemSubtotal, 0)
  }

  async fetchItems() {
    if (!this.id) return Promise.reject()
    
    this.$state.loading = true
    return backend.get(`purchase-orders/${this.id}/items/`)
      .then(response => {
        if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
        this.items = response?.data?.results.map(PurchaseOrderItem.parse)
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }

  async refetch() {
    if (!this.id) return Promise.reject()

    this.$state.loading = true
    return backend.get(`purchase-orders/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }
  
  async markReviewed() {
    this.$state.loading = true
    return backend.post(`purchase-orders/${this.id}/mark_reviewed/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }

  async complete() {
    this.$state.loading = true
    return backend.post(`purchase-orders/${this.id}/complete/`)
      .then(response => {
        if(!response?.data?.id) return Promise.reject({ response })
        this.raw = response.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }
}

export class StockRecount {
  static parse(data) {
    return new StockRecount(data)
  }

  constructor(data) {
    this.raw = data
    this.$state = {
      loading: false,
    }
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {String} data.remarks
   * @param {Object[]} data.items
   * @param {String} data.created_at
   * @param {Object} data.created_by
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.remarks = data?.remarks
    if (data?.created_at) this.createdAt = new Date(data?.created_at)
    this.createdBy = User.parse(data?.created_by)
    this.items = data?.items?.map?.(StockRecountItem.parse)
  }

  async refetch() {
    this.$state.loading = true
    backend.get(`stock-recounts/${this.id}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.raw = response?.data
        return response
      })
      .finally(() => {
        this.$state.loading = false
      })
  }
}

export class StockRecountItem {
  static parse(data) {
    return new StockRecountItem(data)
  }

  constructor(data) {
    this.raw = data
  }

  get raw() {
    return this.$raw
  }

  /**
   * @param {Object} data
   * @param {Number} data.id
   * @param {Number} data.stock_id
   * @param {Number} data.expected_quantity
   * @param {Number} data.actual_quantity
   * @param {String} data.remarks
   * @param {String} [data.stock_updated_at]
   */
  set raw(data) {
    Object.defineProperty(this, '$raw', { enumerable: false, configurable: true, value: data })

    this.id = data?.id
    this.stockId = data?.stock_id
    this.expectedQuantity = data?.expected_quantity
    this.actualQuantity = data?.actual_quantity
    this.remarks = data?.remarks
    if (data?.stock_updated_at) this.stockUpdatedAt = new Date(data?.stock_updated_at)
  }

  async fetchStock() {
    if (!this.stockId) return Promise.reject()
    return backend.get(`stocks/${this.stockId}/`)
      .then(response => {
        if (!response?.data?.id) return Promise.reject({ response })
        this.stock = Stock.parse(response?.data)
      })
  }
}
