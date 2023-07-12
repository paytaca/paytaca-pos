<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">Purchase Order</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>

    <q-tabs v-model="tab">
      <q-tab v-for="(tabOpt, index) in tabs" :key="index" v-bind="tabOpt"/>
    </q-tabs>
    <q-tab-panels v-model="tab" animated keep-alive>
      <q-tab-panel name="items" class="q-pa-none">        
        <q-card-section class="q-pb-none">
          <div class="text-h6">Items</div>
        </q-card-section>
        <!-- <q-separator/> -->
        <q-card-section>
          <template v-if="formData.items?.length">
            <table class="items-table full-width">
              <tr v-for="item in formData.items" :key="item?.variant?.id">
                <td class="full-width">
                  <div class="row items-start no-wrap text-weight-medium">
                    <img
                      v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                      :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                      style="width:50px;"
                      class="rounded-borders q-mr-sm"
                    />
                    <div>
                      {{ item?.variant?.product?.name }}
                      <template v-if="item?.variant?.name">
                        - {{ item?.variant?.name }}
                      </template>
                    </div>
                  </div>
                </td>
                <td class="full-width" style="text-wrap:nowrap;">
                  <template v-if="item.costPrice">
                    {{ item.costPrice }} {{ marketplaceStore?.currency }}
                  </template>
                  <span v-else class="text-grey">
                    Set cost price
                  </span>
                  <q-popup-edit
                    v-model="item.costPrice" v-slot="props"
                    :cover="false"
                  >
                    <q-input
                      flat
                      dense
                      :suffix="marketplaceStore?.currency"
                      type="number"
                      v-model.number="props.value"
                      @keypress.enter="props.set"
                    />
                  </q-popup-edit>
                </td>
                <td class="text-right" style="text-wrap:nowrap">
                  x{{ item.quantity }}
                  <q-popup-edit
                    v-model="item.quantity" v-slot="props"
                    :cover="false"
                    @update:model-value="val => val ? null: removeItem(item)"
                  >
                    <q-input
                      flat
                      dense
                      type="number"
                      v-model.number="props.value"
                      @keypress.enter="props.set"
                    />
                  </q-popup-edit>
                </td>
              </tr>
            </table>
          </template>
          <div v-else class="text-center text-grey">
            No items
          </div>
          <div class="q-mt-md">
            <q-separator/>
            <q-slide-transition>
              <div v-if="!displayAddItemForm" class="q-mt-sm">
                <q-btn
                  flat
                  no-caps
                  label="Add Item"
                  icon="add"
                  class="full-width"
                  @click="() => displayAddItemForm = true"
                />
              </div>
            </q-slide-transition>
            <q-slide-transition>
              <div v-if="displayAddItemForm">
                <div class="text-subtitle1 q-my-sm">Add Item</div>
                <AddItemForm
                  :exludeVariantIds="formData?.items?.map(item => item?.variant?.id)"
                  with-cost-price
                  inline-scanner
                  @cancel="() => displayAddItemForm = false"
                  @submit="addItem"
                />
              </div>
            </q-slide-transition>
          </div>
        </q-card-section>
        <q-card-section v-if="formData?.items?.length" class="q-pt-none">
          <q-btn
            no-caps label="Next"
            color="brandblue"
            class="full-width"
            @click="() => nextTab()"
          />
        </q-card-section>
      </q-tab-panel>
      <q-tab-panel name="vendor" class="q-pa-none">
        <q-card-section >
          <div class="text-h6">Supplier</div>
        </q-card-section>
        <q-card-section class="q-pt-none">
          <q-slide-transition>
            <div v-if="formData.vendor.id" class="row items-center q-mb-sm">
              <div class="q-space">#{{ formData.vendor.id }}</div>
              <q-btn flat no-caps label="Clear" padding="none sm" @click="() => resetVendor()"/>
            </div>
          </q-slide-transition>
          <q-input
            dense
            outlined
            :readonly="Boolean(formData.vendor.id)"
            label="Name"
            v-model="formData.vendor.name"
            bottom-slots
            debounce="500"
            @update:model-value="val => {
              vendorSearch.search = val
              filterVendorOpts()
            }"
            @focus.stop.once="() => filterVendorOpts()"
          >
            <template v-slot:append>
              <q-btn
                flat
                icon="search"
                padding="xs"
                :loading="vendorSearch.loading"
                @click="() => vendorSearch.show = !vendorSearch.show"
              >
                <q-badge v-if="vendorSearch?.opts?.length" class="brandblue">
                  {{ vendorSearch?.opts?.length }}
                </q-badge>
              </q-btn>
            </template>
            <q-menu
              v-model="vendorSearch.show"
              no-focus fit
              no-parent-event
              @hide="() => vendorSearch.search = ''"
              @vnode-updated="onVendorSearchMenuUpdate"
            >
              <q-input
                dense
                outlined
                class="q-mt-sm q-mx-md"
                placeholder="Search ..."
                v-model="vendorSearch.search"
                :loading="vendorSearch.loading"
                debounce="500"
                @update:model-value="() => filterVendorOpts()"
              />
              <q-list v-if="vendorSearch?.opts?.length" separator class="q-mt-sm">
                <q-item
                  v-for="vendor in vendorSearch?.opts" :key="vendor?.id"
                  :active="formData.vendor?.id === vendor?.id"
                  clickable
                  @click="formData.vendor = vendor"
                  v-close-popup
                >
                  <q-item-section>
                    <q-item-label>{{ vendor?.name }}</q-item-label>
                    <q-item-label v-if="vendor?.location?.formatted" class="text-caption">
                      {{ vendor?.location?.formatted }}
                    </q-item-label>
                  </q-item-section>
                </q-item>
              </q-list>
              <q-item v-else>
                <q-item-section>
                  <q-item-label>
                    No data
                  </q-item-label>
                </q-item-section>
              </q-item>
            </q-menu>
          </q-input>
          <q-input
            dense
            outlined
            label="Contact"
            :readonly="Boolean(formData.vendor.id)"
            v-model="formData.vendor.phoneNumber"
            bottom-slots
          />

          <div class="text-subtitle1">Address</div>

          <q-input
            dense
            outlined
            :readonly="Boolean(formData.vendor.id)"
            label="Address 1"
            placeholder="Building name / Lot number"
            v-model="formData.vendor.location.address1"
            bottom-slots
          />
          <q-input
            dense
            outlined
            label="Address 2"
            placeholder="Unit No. / Floor No."
            :readonly="Boolean(formData.vendor.id)"
            v-model="formData.vendor.location.address2"
            bottom-slots
          />

          <q-input
            dense
            outlined
            label="Street"
            :readonly="Boolean(formData.vendor.id)"
            v-model="formData.vendor.location.street"
            bottom-slots
          />

          <q-input
            dense
            outlined
            label="City"
            :readonly="Boolean(formData.vendor.id)"
            v-model="formData.vendor.location.city"
            bottom-slots
          />

          <q-input
            dense
            outlined
            label="Province"
            :readonly="Boolean(formData.vendor.id)"
            v-model="formData.vendor.location.state"
            bottom-slots
          />

          <q-input
            dense
            outlined
            label="Country"
            :readonly="Boolean(formData.vendor.id)"
            v-model="formData.vendor.location.country"
            bottom-slots
          />
        </q-card-section>
        <q-card-section v-if="formData?.vendor" class="q-pt-none">
          <q-btn
            no-caps label="Next"
            color="brandblue"
            class="full-width"
            @click="() => nextTab()"
          />
        </q-card-section>
      </q-tab-panel>
      <q-tab-panel name="review" class="q-pa-none">
        <q-card-section>
          <div class="text-subtitle1">Supplier</div>
          <q-separator/>
          <div>
            <div class="text-caption top text-grey">Name</div>
            <div class="text-body1">{{ formData?.vendor?.name }}</div>
          </div>
          <div>
            <div class="text-caption top text-grey">Contact</div>
            <div class="text-body2">
              <span v-if="formData?.vendor?.phoneNumber">
                {{ formData?.vendor?.phoneNumber }}
              </span>
              <span v-else class="text-grey">No contact</span>
            </div>
          </div>
          <div v-if="formData?.vendor?.location?.formatted">
            <div class="text-caption top text-grey">Address</div>
            <div class="text-body2">{{ formData?.vendor?.location?.formatted }}</div>
          </div>
        </q-card-section>
        <q-card-section>
          <div class="text-subtitle1">Items</div>
          <q-separator class="q-mb-sm"/>
          <table class="items-table full-width">
            <tr v-for="item in formData.items" :key="item?.variant?.id">
              <td class="full-width">
                <div class="row items-start no-wrap text-weight-medium">
                  <img
                    v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                    :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                    style="width:50px;"
                    class="rounded-borders q-mr-sm"
                  />
                  <div>
                    {{ item?.variant?.product?.name }}
                    <template v-if="item?.variant?.name">
                      - {{ item?.variant?.name }}
                    </template>
                  </div>
                </div>
              </td>
              <td class="full-width" style="text-wrap:nowrap;">
                <template v-if="item.costPrice">
                  {{ item.costPrice }} {{ marketplaceStore?.currency }}
                </template>
                <span v-else class="text-grey">
                  No cost price
                </span>
              </td>
              <td class="text-right" style="text-wrap:nowrap">
                x{{ item.quantity }}
              </td>
            </tr>
          </table>
          <q-separator/>
          <div class="row q-px-sm text-subtitle1 q-pt-sm">
            <div class="q-space">Subtotal</div>
            <div>
              {{ formComputedData.subtotal }}
              {{ marketplaceStore?.currency  }}
            </div>
          </div>
        </q-card-section>
        <q-card-section v-if="formComputedData.subtotal > 0">
          <q-btn
            color="brandblue"
            no-caps
            label="Create"
            class="full-width"
            @click="() => createPurchaseOrder()"
          />
        </q-card-section>
      </q-tab-panel>
    </q-tab-panels>
    <VariantInfoDialog
      v-model="variantInfoDialog.show"
      :variant="variantInfoDialog.item?.variant"
    >
      <template v-slot:bottom>
        <q-input
          dense
          outlined
          label="Cost Price"
          :suffix="marketplaceStore?.currency"
          v-model.number="variantInfoDialog.item.costPrice"
          class="q-mb-sm"
        />
        <q-input
          dense
          outlined
          label="Quantity"
          v-model.number="variantInfoDialog.item.quantity"
        >
          <template v-slot:prepend>
            <q-btn flat padding="sm" icon="remove" @mousedown="() => variantInfoDialog.item.quantity--"/>
          </template>
          <template v-slot:append>
            <q-btn flat padding="sm" icon="add" @mousedown="() => variantInfoDialog.item.quantity++"/>
          </template>
        </q-input>
      </template>
    </VariantInfoDialog>
  </q-page>
</template>
<script>
import { Variant, Vendor } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import AddItemForm from 'src/components/marketplace/sales/AddItemForm.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import { backend } from 'src/marketplace/backend'
import { debounce, useQuasar } from 'quasar'
import { useRouter } from 'vue-router'

export default defineComponent({
  name: 'CreatePurchaseOrderPage',
  components: {
    AddItemForm,
    MarketplaceHeader,
    VariantInfoDialog,
  },

  setup() {
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    onMounted(() => {
      const params = {shop_id: marketplaceStore.activeShopId, limit: 2, offset: 4 }
      backend.get(`variants/`, { params })
        .then(response => {
          if (!response?.data?.results?.length) return
          response?.data?.results
            .slice(0, 2)
            .map(variant => Object({ variant, costPrice: variant?.price, quantity: 10 }))
            .forEach(addItem)
        })
      // backend.get('vendors/').then(response => {
      //   if (!response?.data?.results?.length) return
      //   formData.value.vendor = Vendor.parse(response.data.results[0])
      // })
      // formData.value.vendor = Vendor.parse({
      //   name: 'Fire Vendor',
      //   phone_number: '09192837465',
      //   location: {
      //     address1: "YVI Building",
      //     address2: "15th floor Building-Z",
      //     street: "115 Virgo st.",
      //     city: "Tacloban City",
      //     state: "Leyte",
      //     country: "Philippines",
      //     longitude: 125.0096320,
      //     latitude: 11.2104930
      //   },
      // })
      // tab.value = 'review'
      // setTimeout(() => {
      //   tab.value = 'vendor'
      // }, 1)
    })

    const tab = ref('items')
    const tabs = ref([
      { label: 'Items', name: 'items', disable: false, },
      { label: 'Supplier', name: 'vendor', disable: true, },
      { label: 'Review', name: 'review', disable: true, },
    ])
    watch(tab, () => {
      // tabs will be disabled by default, then be enabled when visited once
      tabs.value.forEach(tabOpt => {
        if (tabOpt.name === tab.value) tabOpt.disable = false
      })
    })

    function nextTab() {
      const _tabs = tabs.value
      const index = _tabs.findIndex(tabOpt => tabOpt.name === tab.value)
      const nextIndex = Math.min(index + 1, tabs.value.length-1)

      tab.value = _tabs.at(nextIndex).name
    }

    const loading = ref(false)    
    const displayAddItemForm = ref(false)
    const formData = ref({
      vendor: Vendor.parse(),
      items: [].map(() => {
        return {
          variant: Variant.parse(),
          costPrice: 0,
          quantity: 0,
        }
      }),
    })

    const formComputedData = computed(() => {
      const data = { subtotal: 0 }
      if (formData.value?.items?.length) {
        data.subtotal = formData.value?.items
          .reduce((subtotal, item) => {
            if (isNaN(item?.costPrice)) return subtotal
            if (isNaN(item?.quantity)) return subtotal
            return subtotal + (item?.costPrice * item?.quantity)
          }, 0)
      }
      return data
    })

    const vendorSearch = ref({
      show: false,
      loading: false,
      search: '',
      opts: [].map(Vendor.parse)
    })
    function resetVendor() {
      formData.value.vendor = Vendor.parse(null)
    }
    
    const filterVendorOpts = debounce(() => {
      const searchVal = vendorSearch.value.search || ''
      const params = {
        s: vendorSearch.value.search,
        shop_id: marketplaceStore.activeShopId,
        limit: Math.min(5 + 2**(searchVal?.length || 0), 100),
      }

      vendorSearch.value.loading = true
      backend.get('vendors/', { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          vendorSearch.value.opts = response.data?.results.map(Vendor.parse)
          return response
        })
        .finally(() => {
          vendorSearch.value.loading = false
        })
    }, 500, false)

    function addItem(item) {
      formData.value.items.push({
        variant: item?.variant,
        costPrice: item?.costPrice || null,
        quantity: item?.quantity,
      })
      displayAddItemForm.value = false
    }

    function removeItem(item) {
      formData.value.items = formData.value.items.filter(_item => _item !== item)
    }

    function createPurchaseOrder() {
      const data = {
        vendor_id: undefined,
        vendor: undefined,
        shop_id: marketplaceStore.activeShopId,
        items: formData.value.items.map(item => {
          return {
            variant_id: item.variant.id,
            cost_price: item.costPrice,
            quantity: item.quantity,
          }
        }),
      }

      if (formData.value?.vendor?.id) data.vendor_id = formData.value.vendor.id
      else {
        data.vendor = {
          name: formData.value.vendor?.name,
          phone_number: formData.value.vendor?.phoneNumber,
          location: {
            address1: formData.value.vendor?.location?.address1,
            address2: formData.value.vendor?.location?.address2,
            street: formData.value.vendor?.location?.street,
            city: formData.value.vendor?.location?.city,
            state: formData.value.vendor?.location?.state,
            country: formData.value.vendor?.location?.country,
            longitude: formData.value.vendor?.location?.longitude,
            latitude: formData.value.vendor?.location?.latitude,
          },
        }
      }

      loading.value = true
      backend.post('purchase-orders/', data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $q.dialog({
            title: 'Success',
            message: 'Purchase Order created',
          }).onDismiss(() => {
            $router.replace({
              name: 'marketplace-purchase-order',
              params: { purchaseOrderId: response?.data?.id },
            })
          })
          return response
        })
        .catch(error => {
          let errorMsg = error?.response?.data?.detail
          $q.notify({
            message: 'Failed to create purchase order',
            caption: errorMsg || 'Encountered error',
            type: 'negative',
          })
          return Promise.reject(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    const variantInfoDialog = ref({
      show: false,
      item: { variant: Variant.parse(), quantity: 0 },
    })
    function viewItemVariant(item={ variant: Variant.parse(), quantity: 0 }) {
      variantInfoDialog.value.item = item
      variantInfoDialog.value.show = true
    }

    function onVendorSearchMenuUpdate(ctx) {
      // for q-menu components with `fit` prop set
      // this will fix the width to be the same as the parent component
      const element = ctx?.component?.ctx?.contentEl
      if (!element) return
      const minWidth = element?.style?.minWidth
      if (!minWidth) return
      element.style.setProperty('max-width', minWidth)
    }

    return {
      marketplaceStore,
      tab,
      tabs,
      nextTab,

      displayAddItemForm,
      loading,
      formData,
      formComputedData,
      vendorSearch,
      resetVendor,
      filterVendorOpts,
      addItem,
      removeItem,
      createPurchaseOrder,
      variantInfoDialog,
      viewItemVariant,

      onVendorSearchMenuUpdate,
    }
  },
})
</script>
<style lang="scss" scoped>
table.items-table {
  border-spacing: (map-get($space-md, 'x'))/2;
}
</style>

