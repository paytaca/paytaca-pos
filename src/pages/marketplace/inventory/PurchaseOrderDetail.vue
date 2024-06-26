<template>
  <q-page class="q-pa-md">
    <q-pull-to-refresh @refresh="refreshPage">
      <MarketplaceHeader>
        <template v-slot:title>
          <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
          <div class="q-space">
            <div class="text-h5">{{ $t('PurchaseOrder') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
        </template>
      </MarketplaceHeader>
      <div class="row items-center justify-end no-wrap q-mb-sm">
        <q-btn
          flat
          no-caps
          :label="$t('Edits')"
          icon-right="history"
          padding="none sm"
          class="q-r-mr-sm"
          @click="() => openPurchaseOrderUpdatesDialog = true"
        />
      </div>
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="row items-center">
            <div v-if="purchaseOrder?.number" class="row items-center text-h5">
              <div>
                {{
                  $t(
                    'PoNumber',
                    { number: purchaseOrder?.number },
                    `PO#${purchaseOrder?.number}`
                  )
                }}
              </div>
            </div>
            <q-icon v-if="purchaseOrder?.reviewedAt" name="check_circle" color="green" size="1.5rem" class="q-mx-xs">
              <q-menu class="q-pa-sm">
                <template v-if="purchaseOrder?.reviewedBy?.fullName">
                  <span v-if="purchaseOrder?.reviewedBy?.id == marketplaceStore?.user?.id">
                    {{
                      $t(
                        'ReviewedByYou',
                        { name: purchaseOrder?.reviewedBy?.fullName, date: formatTimestampToText(purchaseOrder?.reviewedAt) },
                        `Reviewed by ${ purchaseOrder?.reviewedBy?.fullName } (you) at ${ formatTimestampToText(purchaseOrder?.reviewedAt) }`
                      )
                    }}
                  </span>
                  <template v-else>
                    {{
                      $t(
                        'ReviewedBy',
                        { name: purchaseOrder?.reviewedBy?.fullName, date: formatTimestampToText(purchaseOrder?.reviewedAt) },
                        `Reviewed by ${ purchaseOrder?.reviewedBy?.fullName } at ${ formatTimestampToText(purchaseOrder?.reviewedAt) }`
                      )
                    }}
                  </template>
                </template>
              </q-menu>
            </q-icon>
            <q-space/>
            <q-chip :color="purchaseOrder?.statusColor" class="q-mx-none q-mb-sm text-weight-medium text-white">
              {{ purchaseOrder?.formattedStatus }}
            </q-chip>
          </div>
          <div class="row items-center">
            <div v-if="purchaseOrder?.createdAt" class="text-caption bottom text-grey">
              {{ formatTimestampToText(purchaseOrder?.createdAt) }}
              <q-menu class="q-pa-sm">
                {{
                  $t(
                    'CreatedAt',
                    { date: formatTimestampToText(purchaseOrder?.createdAt) },
                    `Created at ${formatTimestampToText(purchaseOrder?.createdAt)}`
                  )
                }}
              </q-menu>
            </div>
            <q-space/>
            <div v-if="purchaseOrder?.createdBy?.id" class="text-caption bottom text-grey">
              {{ purchaseOrder?.createdBy?.fullName }}
              <q-menu class="q-pa-sm">
                {{
                  $t(
                    'CreatedBy',
                    { name: purchaseOrder?.createdBy?.fullName },
                    `Created by ${purchaseOrder?.createdBy?.fullName}`
                  )
                }}
              </q-menu>
            </div>
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="text-h6">{{ $t('Supplier') }}</div>
          <div class="text-subtitle1">{{ purchaseOrder.vendor.name }}</div>
          <div class="text-body2">{{ purchaseOrder.vendor.phoneNumber }}</div>
          <div v-if="purchaseOrder.vendor?.location?.formatted" class="text-caption">
            {{ purchaseOrder.vendor?.location?.formatted }}
          </div>
        </q-card-section>
      </q-card>
      <q-card v-if="!purchaseOrder?.reviewedAt" class="q-mb-md">
        <q-card-section>
          <div class="text-h6">{{ $t('Review') }}</div>
          <div class="q-pb-md" @click="() => assignReviewerFormDialog.show = true">
            <div class="text-body2 text-underline">
              <template v-if="purchaseOrder?.reviewedBy?.id">
                {{ purchaseOrder?.reviewedBy?.fullName }}
              </template>
              <span v-else class="text-grey">
                {{ $t('AssignReviewer') }}
              </span>
            </div>
            <div class="text-caption bottom">{{ $t('Reviewer') }}</div>
          </div>
          <div>
            <q-btn
              :disable="purchaseOrder.$state.loading || !allItemsReceived || !canReviewPurchaseOrder"
              :loading="purchaseOrder.$state.loading"
              no-caps
              :label="$t('MarkReviewed')"
              color="brandblue"
              class="full-width"
              @click="() => purchaseOrder.markReviewed()"
            />
            <q-menu v-if="!allItemsReceived" class="q-py-sm q-px-md">
              {{ $t('MarkReviewedMsg1') }}
            </q-menu>
            <q-menu v-else-if="!canReviewPurchaseOrder" class="q-py-sm q-px-md">
              {{ $t('MarkReviewedMsg2') }}
            </q-menu>
          </div>
        </q-card-section>
      </q-card>
      <q-card class="q-mb-md">
        <q-card-section>
          <div class="row items-center">
            <div class="text-h6 q-space">{{ $t('Items') }}</div>
            <q-btn
              v-if="editable"
              icon="add"
              padding="xs"
              color="brandblue"
              class="q-mr-sm"
              @click="() => addItemsForm.showAddItemFormDialog = true"
            />
          </div>
          <div v-if="addItemsForm.items?.length">
            <div class="row items-center">
              <div class="text-subtitle1">{{ $t('AddItems') }}</div>
              <q-spinner v-if="addItemsForm.loading" class="q-ml-sm"/>
            </div>
            <q-form @submit="submitAddItems">
              <div
                v-for="item in addItemsForm.items" :key="item?.id"
                class="row items-center no-wrap q-gutter-x-sm q-my-sm"
                :class="{ 'text-grey': addItemsForm.loading }"
              >    
                <div class="q-space row items-center no-wrap text-weight-medium" @click="() => viewVariant(item?.variant)">
                  <img
                    v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                    :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                    style="width:50px;"
                    class="rounded-borders q-mr-sm"
                  />
                  <div>
                    {{ item?.variant?.itemName }}
                  </div>
                </div>
  
                <div class="col-3 col-sm-2">
                  <template v-if="item.costPrice">
                    {{ item.costPrice }} {{ purchaseOrder?.currency?.symbol }}
                  </template>
                  <span v-else class="text-grey">
                    {{ $t('SetCostPrice') }}
                  </span>
  
                  <q-popup-edit
                    v-model="item.costPrice" v-slot="props"
                    :cover="false"
                  >
                    <q-input
                      flat
                      dense
                      :suffix="purchaseOrder?.currency?.symbol"
                      type="number"
                      v-model.number="props.value"
                      @keypress.enter="() => props.set()"
                    />
                  </q-popup-edit>
                </div>
  
                <div class="col-2 col-sm-1">
                  <div class="row no-wrap items-center">
                    <span>x{{ item.quantity }}</span>
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
                        @keypress.enter="() => props.set()"
                      />
                    </q-popup-edit>
                  </div>
                </div>
              </div>
              <div class="q-my-sm">
                <q-btn
                  :loading="addItemsForm.loading"
                  :disable="addItemsForm.loading"
                  no-caps
                  :label="$t('AddItems')"
                  color="brandblue"
                  type="submit"
                  class="full-width"
                />
              </div>
            </q-form>
            <q-separator/>
          </div>
          <div v-if="editable" class="row items-center q-my-sm q-gutter-sm">
            <div class="q-space">
              <q-checkbox
                :model-value="selectedItemIds.length === purchaseOrder?.items?.length"
                @update:model-value="val => {
                  selectedItemIds = val ? purchaseOrder?.items?.map(item => item?.id) : []
                }"
              />
            </div>
            <q-btn-group flat>
              <q-btn
                :outline="$q.dark.isActive"
                :disable="!selectedItemIds.length"
                no-caps
                :label="$t('MarkReceived')"
                padding="2px md"
                @click="() => showReceiveItemsDialog = true"
              />
              <q-btn
                :outline="$q.dark.isActive"
                :disable="!selectedItemIds.length"
                no-caps
                :label="$t('Remove')"
                padding="2px md"
                @click="confirmRemoveSelectedItems"
              />
            </q-btn-group>
          </div>
          <q-tabs v-model="itemsViewMode" dense>
            <q-tab name="default" icon="info"/>
            <q-tab name="delivery_status" icon="local_shipping"/>
            <q-tab name="inventory" icon="inventory"/>
          </q-tabs>
          <div
            v-for="item in purchaseOrder.items" :key="item?.id"
            class="row items-center no-wrap q-gutter-x-sm q-my-md"
          >
            <q-checkbox
              v-if="editable"
              dense
              v-model="selectedItemIds"
              :val="item.id"
              class="q-pa-xs"
            />
            <div class="q-space row items-center no-wrap text-weight-medium" @click="() => viewVariant(item?.variant)">
              <img
                v-if="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                :src="item?.variant?.imageUrl || item?.variant?.product?.imageUrl"
                style="width:50px;"
                class="rounded-borders q-mr-sm"
              />
              <div>
                {{ item?.variant?.itemName }}
              </div>
            </div>
            <template v-if="itemsViewMode === 'delivery_status'">
              <div class="col-5 col-sm-3">
                <div v-if="item?.deliveredAt">
                  {{
                    $t(
                      'DeliveredDate',
                      { relativeDate: formatDateRelative(item.deliveredAt) },
                      `Delivered ${formatDateRelative(item.deliveredAt)}`
                    )
                  }}
                  <q-menu class="q-py-sm q-px-md">
                    {{ formatTimestampToText(item.deliveredAt) }}
                  </q-menu>
                </div>
                <div v-else class="text-grey" @click="() => showReceiveItemsDialog = !allItemsReceived">
                  {{ $t('NotYetDelivered') }}
                </div>
              </div>
            </template>
            <div v-else-if="itemsViewMode === 'inventory'" class="col-5 text-right" >
              <div
                v-if="item?.stockId"
                class="text-weight-medium text-underline"
                @click="() => displayItemStock(item)" 
              >
                {{ $t('ViewStocks') }}
              </div>
              <div v-else-if="item?.deliveredAt">
                <span v-if="!item?.expiresAt" class="text-grey text-underline">
                  {{ $t('SetExpirationDate') }}
                </span>
                <div v-else>
                  <div>
                    {{ item?.expiresAt.toLocaleDateString() }}
                    <q-icon name="edit" size="1.1em"/>
                  </div>
                  <div class="text-caption bottom">{{ $t('ExpirationDate') }}</div>
                </div>
                <q-popup-edit
                  :model-value="item.expiresAt?.toISOString()"
                  :cover="false"
                  self="top middle"
                  @update:model-value="val => updateItemExpirationDate(item, val ? new Date(val).toISOString() : null)"
                  v-slot="scope"
                  class="q-pa-none"
                >
                  <q-date v-model="scope.value" flat mask="YYYY-MM-DD">
                    <div class="row items-center justify-end">
                      <q-btn v-close-popup no-caps :label="$t('Close')" flat/>
                      <q-btn v-close-popup no-caps :label="$t('Set')" color="brandblue" @click="() => scope.set()"/>
                    </div>
                  </q-date>
                </q-popup-edit>
              </div>
              <div v-else class="text-grey">
                {{ $t('NotYetDelivered') }}
              </div>
            </div>
            <template v-else>
              <div class="col-3 col-sm-2">
                <template v-if="item.costPrice">
                  {{ item.costPrice }} {{ purchaseOrder?.currency?.symbol }}
                </template>
                <span v-else class="text-grey">
                  {{ $t('NoCostPrice') }}
                </span>
              </div>
              <div class="col-2 col-sm-1">
                <div class="row no-wrap items-center text-right">
                  <span>x{{ item.quantity }}</span>
                </div>
              </div>
            </template>
          </div>
          <q-separator class="q-my-sm"/>
          <div class="row q-px-sm">
            <div class="q-space">{{ $t('Subtotal') }}</div>
            <div>{{ purchaseOrder?.calculatedSubtotal}} {{ purchaseOrder?.currency?.symbol }}</div>
          </div>
          </q-card-section>
      </q-card>

      <div v-if="purchaseOrder.status !== 'complete' && purchaseOrder.reviewedAt">
        <q-btn
          :disable="purchaseOrder.$state.loading"
          :loading="purchaseOrder.$state.loading"
          no-caps
          :label="$t('Complete')"
          color="brandblue"
          class="full-width"
          @click="() => completePurchaseOrder()"
        />
      </div>
    </q-pull-to-refresh>

    <ReceivePurchaseOrderItemsFormDialog
      v-model="showReceiveItemsDialog"
      :purchaseOrder="purchaseOrder"
      :initialSelectedIds="selectedItems.map(item => item?.id)"
      @ok="purchaseOrderData => purchaseOrder.raw = purchaseOrderData"
    />
    <VariantInfoDialog v-model="variantInfoDialog.show" :variant="variantInfoDialog.variant">
      <template v-slot:bottom="props">
        <q-btn
          :outline="$q.dark.isActive"
          no-caps
          :disable="Boolean(!props.variant?.product?.id || !props.variant?.id)"
          :label="$t('GoToInventory')"
          padding="none md"
          :to="{ name: 'marketplace-stocks', query: { productId: props.variant?.product?.id, variantId: props.variant?.id }}"
        />
      </template>
    </VariantInfoDialog>
    <q-dialog v-model="addItemsForm.showAddItemFormDialog" position="bottom">
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ $t('AddItem') }}</div>
          <AddItemForm
            :exludeVariantIds="addItemsForm?.items?.map(item => item?.variant?.id).filter(Boolean)"
            with-cost-price
            @submit="addItem"
            @cancel="() => addItemsForm.showAddItemFormDialog = false"
          />
        </q-card-section>
      </q-card>
    </q-dialog>

    <q-dialog v-model="assignReviewerFormDialog.show" position="bottom" :persistent="assignReviewerFormDialog.loading">
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ $t('AssignReviewer') }}</div>
          <q-form @submit="() => assignReviewer()">

            <q-banner v-if="assignReviewerFormDialog.errors?.length" class="bg-red text-white rounded-borders q-mb-sm">
              <div v-if="assignReviewerFormDialog.errors?.length === 1">
                {{ assignReviewerFormDialog.errors[0] }}
              </div>
              <ul v-else class="q-pl-md">
                <li v-for="(err, index) in assignReviewerFormDialog.errors" :key="index">{{err}}</li>
              </ul>
            </q-banner>
            <div>{{ $t('User') }}</div>
            <q-select
              dense
              outlined
              use-input
              fill-input
              clearable
              :disable="assignReviewerFormDialog.loading"
              :placeholder="$t('NameEmailUsername')"
              :options="assignReviewerFormDialog.userOpts"
              :option-label="obj => obj?.fullName || obj?.username || obj?.email"
              option-value="id"
              v-model="assignReviewerFormDialog.user"
              bottom-slots
              @filter="filterAssignReviewerOpts"
            >
              <template v-slot:selected-item>
                <!-- {{ opt?.fullName || opt?.username || opt?.email }} -->
              </template>
              <template v-slot:option="{ opt, toggleOption }">
                <q-item
                  clickable
                  @click="() => toggleOption(opt)"
                >
                  <q-item-section>
                    <q-item-label>{{ opt?.fullName }}</q-item-label>
                    <q-item-label class="text-caption">{{ opt?.email }}</q-item-label>
                    <q-item-label class="text-caption">{{ opt?.username }}</q-item-label>
                  </q-item-section>
                </q-item>
              </template>
            </q-select>
            <div class="q-mt-sm">
              <q-btn
                :disable="assignReviewerFormDialog.loading"
                :loading="assignReviewerFormDialog.loading"
                no-caps
                :label="$t('Assign')"
                type="submit"
                color="brandblue"
                class="full-width"
              />
            </div>
          </q-form>
        </q-card-section>
      </q-card>
    </q-dialog>

    <PurchaseOrderUpdatesDialog
      v-model="openPurchaseOrderUpdatesDialog"
      :purchase-order-id="purchaseOrderId"
    />
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { errorParser, formatDateRelative, formatPurchaseOrderStatus, formatTimestampToText } from 'src/marketplace/utils'
import { PurchaseOrder, PurchaseOrderItem, Stock, User, Variant } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, ref, watch } from 'vue'
import PurchaseOrderUpdatesDialog from 'src/components/marketplace/inventory/PurchaseOrderUpdatesDialog.vue'
import AddItemForm from 'src/components/marketplace/sales/AddItemForm.vue'
import StockDetailDialog from 'src/components/marketplace/inventory/StockDetailDialog.vue'
import ReceivePurchaseOrderItemsFormDialog from 'src/components/marketplace/inventory/ReceivePurchaseOrderItemsFormDialog.vue'
import VariantInfoDialog from 'src/components/marketplace/inventory/VariantInfoDialog.vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'

export default defineComponent({
  name: 'PurchaseOrderDetail',
  components: {
    PurchaseOrderUpdatesDialog,
    AddItemForm,
    ReceivePurchaseOrderItemsFormDialog,
    VariantInfoDialog,
    MarketplaceHeader,
  },
  props: {
    purchaseOrderId: [Number, String],
  },
  setup(props) {
    const marketplaceStore = useMarketplaceStore()
    const $q = useQuasar()

    const openPurchaseOrderUpdatesDialog = ref(false)
    const purchaseOrder = ref(PurchaseOrder.parse({ id: props.purchaseOrderId }))
    onMounted(() => purchaseOrder.value.refetch())
    const editable = computed(() => {
      return purchaseOrder.value.status !== 'complete' && !purchaseOrder.value.reviewedAt
    })

    const itemsViewMode = ref('default')
    const showReceiveItemsDialog = ref(false)
    const canReviewPurchaseOrder = computed(() => {
      if (!purchaseOrder.value.reviewedBy?.id) return true
      return marketplaceStore.user?.id === purchaseOrder.value.reviewedBy?.id 
    })
    const allItemsReceived = computed(() => {
      if (!Array.isArray(purchaseOrder.value.items)) return false
      return purchaseOrder.value.items.every(item => Boolean(item?.deliveredAt))
    })

    const variantInfoDialog = ref({
      show: false,
      variant: Variant.parse(),
    })
    function viewVariant(variant = Variant.parse()) {
      variantInfoDialog.value.variant = variant
      variantInfoDialog.value.show = true
    }

    function completePurchaseOrder() {
      const dialog = $q.dialog({
        title: 'Purchase order',
        message: 'Completing purchase order & updating stocks',
        progress: true,
        ok: false,
        persistent: true,
      })
      purchaseOrder.value.complete()
        .finally(() => {
          dialog.update({ progress: false, persistent: false })
        })
        .then(() => {
          dialog.update({ message: 'Purchase order completed!'})
        })
        .catch(error => {
          let message = error?.response?.data?.detail || error?.response?.data?.[0]
          dialog.update({
            title: 'Error',
            message: message || 'Unable to complete purchase order',
          })
        })
    }

    function displayItemStock(item=PurchaseOrderItem.parse()) {
      if (!item.stockId) return

      if (!item.stock) {
        item.stock = Stock.parse({ id: item.stockId })
        // item.stock.$state.updating = true
        item.stock.refetch()
      }

      $q.dialog({
        component: StockDetailDialog,
        componentProps: { stock: item.stock },
      })
    }

    const assignReviewerFormDialog = ref({
      show: false,
      loading: false,
      user: User.parse(),
      userOpts: [].map(User.parse),
      errors: [],
    })
    watch(() => [assignReviewerFormDialog.value.show], () => {
      if (!assignReviewerFormDialog.value.show) return
      assignReviewerFormDialog.value.user = purchaseOrder.value?.reviewedBy
      assignReviewerFormDialog.value.errors = []
    })

    function filterAssignReviewerOpts(val, update, abortUpdate) {
      const params = {
        roles: marketplaceStore.roles.inventory,
        s: val,
      }
      backend.get(`shops/${purchaseOrder.value.shop?.id}/staff/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          update(() => {
            assignReviewerFormDialog.value.userOpts = response.data.results.map(User.parse)
          })
          return response
        })
        .catch(() => abortUpdate()) 
    }

    function assignReviewer() {
      const data = {
        reviewed_by_id: assignReviewerFormDialog.value.user?.id || null,
      }

      assignReviewerFormDialog.value.loading = true
      return backend.patch(`purchase-orders/${purchaseOrder.value.id}/`, data)
        .then(response => {
          const data = response?.data
          if (!data?.id) return Promise.reject({ response })
          purchaseOrder.value.raw = data
          assignReviewerFormDialog.value.show = false
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMsgs = []
          errorMsgs = errorParser.toArray(data?.non_field_errors)
          if (!errorMsgs?.length) {
            if (Array.isArray(data)) errorMsgs = data
            if (data?.detail) errorMsgs = [data?.detail]
          }
          if (!errorMsgs?.length) {
            let fieldError = errorParser.firstElementOrValue(data?.reviewed_by_id)
            if (String(fieldError).indexOf('does not exist') >= 0) fieldError = 'User not found'
            errorMsgs = [fieldError].filter(Boolean)
          }

          if (!errorMsgs?.length) errorMsgs = ['Unable to assign reviewer']
          assignReviewerFormDialog.value.errors = errorMsgs
          return Promise.reject(error)
        })
        .finally(() => {
          assignReviewerFormDialog.value.loading = false
        })
    }

    const selectedItemIds = ref([].map(Number))
    const selectedItems = computed(() => {
      if (!Array.isArray(purchaseOrder.value.items)) return []
      return purchaseOrder.value.items.filter(item => selectedItemIds.value.indexOf(item.id) >= 0)
    })

    function confirmRemoveSelectedItems() {
      $q.dialog({
        title: 'Remove items',
        message: `Remove ${selectedItems.value.length} ${selectedItems.value.length === 1 ? 'item' : 'items'}. Are you sure?`,
        ok: { color: 'red', flat: true, noCaps: true, label: 'Remove' },
        cancel: { flat: true, color: 'grey', noCaps: true }
      }).onOk(() => removeSelectedItems())
    }

    function removeSelectedItems() {
      const data = {
        // used selected items to ensure they exist in purchase order items
        update_items: selectedItems.value.map(item => {
          return {
            purchase_order_item_id: item?.id,
            remove: true,
          }
        }),
      }

      const dialog = $q.dialog({
        title: 'Removing items',
        progress: true,
        persistent: true,
        ok: false,
      })

      purchaseOrder.value.$state.loading = true
      return backend.patch(`purchase-orders/${purchaseOrder.value.id}/items/`, data)
        .then(response => {
          purchaseOrder.value.raw = response?.data
          dialog.hide()
          selectedItemIds.value = []
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMsg = data?.detail || errorParser.firstElementOrValue(data?.non_field_errors)
          dialog.update({ title: 'Unable to remove items', message: errorMsg })
        })
        .finally(() => {
          purchaseOrder.value.$state.loading = false
          dialog.update({ progress: false, persistent: false, ok: { color: 'brandblue', flat: true }})
        })
    }

    function updateItemExpirationDate(item=PurchaseOrderItem.parse(), value) {
      const data = {
        update_items: [{
          purchase_order_item_id: item?.id,
          expires_at: value
        }]
      }

      purchaseOrder.value.$state.loading = true
      return backend.patch(`purchase-orders/${purchaseOrder.value.id}/items/`, data)
        .then(response => {
          purchaseOrder.value.raw = response?.data
          selectedItemIds.value = []
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMsg = data?.detail || errorParser.firstElementOrValue(data?.non_field_errors)
          $q.notify({
            type: 'negative',
            message: errorMsg || 'Failed to update expiration date',
          })
        })
        .finally(() => {
          purchaseOrder.value.$state.loading = false
        })
    }

    const addItemsForm = ref({
      loading: false,
      showAddItemFormDialog: false,
      items: [].map(() => {
        return { variant: Variant.parse(), quantity: 0, costPrice: 0 }
      }),
    })
    // onMounted(() => {
    //   backend.get(`variants`, { params: { limit: 2, shop_id: marketplaceStore.activeShopId }})
    //     .then(response => {
    //       if (!response?.data?.results?.length) return
    //       response?.data?.results
    //         .map(Variant.parse)
    //         .map(variant => Object({variant, quantity: 10, costPrice: variant?.price - 50 }))
    //         .forEach(addItem)
    //     })
    // })

    function addItem(item) {
      const index = addItemsForm.value.items.findIndex(_item => _item?.variant?.id === item?.variant?.id)
      const itemData = {
        variant: item?.variant,
        quantity: item?.quantity,
        costPrice: item?.costPrice,
      }
      if (index >= 0) addItemsForm.value.items[index] = itemData
      else  addItemsForm.value.items.push(itemData)
      addItemsForm.value.showAddItemFormDialog = false
    }

    function removeItem(item) {
      addItemsForm.value.items = addItemsForm.value.items.filter(_item => _item !== item)
    }

    function submitAddItems() {
      const data = {
        add_items: addItemsForm.value.items.map(item => {
          const data = {
            variant_id: item?.variant?.id,
            quantity: item?.quantity,
            cost_price: item?.costPrice,
          }
          return data
        })
      }

      addItemsForm.value.loading = true
      backend.patch(`purchase-orders/${purchaseOrder.value.id}/items/`, data)
        .then(response => {
          purchaseOrder.value.raw = response?.data
          addItemsForm.value.items = []
        })
        .catch(error => {
          console.error(error)
          let errorMsg
          if (Array.isArray(error?.response?.data)) errorMsg = errorParser.firstElementOrValue(error?.response?.data)
          if (!errorMsg) errorMsg = errorParser.firstElementOrValue(error?.response?.data?.non_field_errors)
          if (!errorMsg) errorMsg = error?.response?.data?.detail

          $q.notify({
            type: 'negative',
            message: 'Failed to add items',
            caption: errorMsg || '',
          })
        })
        .finally(() => {
          addItemsForm.value.loading = false
        })
    }

    async function refreshPage(done) {
      try {
        await purchaseOrder.value.refetch()
      } finally {
        done()
      }
    }

    return {
      marketplaceStore,

      openPurchaseOrderUpdatesDialog,
      purchaseOrder,
      editable,
      itemsViewMode,
      showReceiveItemsDialog,
      canReviewPurchaseOrder,
      allItemsReceived,
      completePurchaseOrder,

      variantInfoDialog,
      viewVariant,

      displayItemStock,

      assignReviewerFormDialog,
      filterAssignReviewerOpts,
      assignReviewer,

      selectedItemIds,
      selectedItems,
      confirmRemoveSelectedItems,
      updateItemExpirationDate,

      addItemsForm,
      addItem,
      removeItem,
      submitAddItems,

      refreshPage,

      // utils funcs
      formatTimestampToText,
      formatDateRelative,
      formatPurchaseOrderStatus,
    }
  },
})
</script>
