<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('Shop') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-card class="q-pt-sm q-mt-lg text-weight-medium" style="border-radius:16px;">
      <q-card-section class="q-py-xs">
        <div class="text-h6">
          <q-icon name="storefront" size="1.5em" class="q-mr-xs"/>
          {{ $t('Info') }}
        </div>
      </q-card-section>
      <q-separator/>
      <q-list separator>
        <q-item class="">
          <q-item-section class="text-grey" top>
            <q-item-label>{{ $t('Name') }}</q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>{{ marketplaceStore.shop?.name }}</q-item-label>
            <q-item-label v-if="marketplaceStore.merchant?.name" class="text-grey text-caption">
              {{ marketplaceStore.merchant?.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="marketplaceStore.shop?.location?.formatted" class="">
          <q-item-section class="text-grey" top>
            <q-item-label>{{ $t('Address') }}</q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              {{ marketplaceStore.shop?.location?.formatted }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="">
          <q-item-section class="text-grey" top>
            <q-item-label>{{ $t('Currency') }}</q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              {{ marketplaceStore?.merchant?.currency?.symbol }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card class="q-pt-sm q-mt-lg text-weight-medium" style="border-radius:16px;">
      <q-card-section>
        {{ $t('Settings') }}
      </q-card-section>
      <q-list>
        <q-item v-if="formattedMarkupSaleRate">
          <q-item-section class="text-grey" top>
            <q-item-label>
              {{ $t('MarkupPriceRate') }}
            </q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              {{ formattedMarkupSaleRate }}
              <q-icon name="info"/>
              <q-menu class="q-pa-sm">
                {{
                  $t(
                    'MarkupSaleRateValue',
                    { rate: formattedMarkupSaleRate },
                    `Items are sold with ${formattedMarkupSaleRate} change from their original price`
                  )
                }}
              </q-menu>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item
          :disable="defaultPOReviewerForm.loading"
          clickable
          @click="() => defaultPOReviewerForm.show = true"
        >
          <q-item-section class="text-grey" top>
            <q-item-label>
              {{ $t('DefaultReviewer') }}
              <q-spinner v-if="defaultPOReviewerForm.loading"/>
            </q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label class="row items-center">
              <span v-if="marketplaceStore?.shopSettings?.defaultPurchaseOrderReviewer?.id">
                {{ marketplaceStore?.shopSettings?.defaultPurchaseOrderReviewer?.fullName }}
              </span>
              <span v-else class="text-grey">
                {{ $t('Unset') }}
              </span>
              <q-icon name="edit" class="q-ml-xs" size="1.2em"/>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable @click="() => updateLastPurchaseOrderNumber()">
          <q-item-section class="text-grey" top>
            <q-item-label>
              {{ $t('LastPurchaseOrderNumber') }}
              <q-spinner v-if="updatingLastPurchaseOrderNumber"/>
            </q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              <span v-if="marketplaceStore?.shopSettings?.startingPurchaseOrderNumber || marketplaceStore?.shopSettings?.startingPurchaseOrderNumber === 0">
                {{ marketplaceStore?.shopSettings?.startingPurchaseOrderNumber }}
              </span>
              <span v-else class="text-grey">
                {{ $t('Unset') }}
              </span>
              <q-icon name="edit" class="q-ml-xs" size="1.2em"/>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable @click="() => updateLastSalesOrderNumber()">
          <q-item-section class="text-grey" top>
            <q-item-label>
              {{ $t('LastSalesOrderNumber') }}
              <q-spinner v-if="updatingLastSalesOrderNumber"/>
            </q-item-label>
          </q-item-section>
          <q-item-section top>
            <q-item-label>
              <span v-if="marketplaceStore?.shopSettings?.startingSalesOrderNumber || marketplaceStore?.shopSettings?.startingSalesOrderNumber === 0">
                {{ marketplaceStore?.shopSettings?.startingSalesOrderNumber }}
              </span>
              <span v-else class="text-grey">
                {{ $t('Unset') }}
              </span>
              <q-icon name="edit" class="q-ml-xs" size="1.2em"/>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
    <q-dialog
      v-model="defaultPOReviewerForm.show"
      position="bottom"
      :persistent="defaultPOReviewerForm.loading"
    >
      <q-card>
        <q-card-section>
          <div class="text-h6">{{ $t('SelectsDefaultReviewer') }}</div>
          <q-form @submit="() => assignDefaultReviewer()">
            <q-banner v-if="defaultPOReviewerForm.errors?.length" class="bg-red text-white rounded-borders q-mb-sm">
              <div v-if="defaultPOReviewerForm.errors?.length === 1">
                {{ defaultPOReviewerForm.errors[0] }}
              </div>
              <ul v-else class="q-pl-md">
                <li v-for="(err, index) in defaultPOReviewerForm.errors" :key="index">{{err}}</li>
              </ul>
            </q-banner>
            <div>{{ $t('User') }}</div>
            <q-select
              dense
              outlined
              use-input
              fill-input
              clearable
              :disable="defaultPOReviewerForm.loading"
              :placeholder="$t('POReviewerFormPlaceholder')"
              :options="defaultPOReviewerForm.userOpts"
              :option-label="obj => obj?.fullName || obj?.username || obj?.email"
              option-value="id"
              v-model="defaultPOReviewerForm.user"
              bottom-slots
              @filter="filterAssignDefaultReviewerOpts"
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
                :disable="defaultPOReviewerForm.loading"
                :loading="defaultPOReviewerForm.loading"
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
  </q-page>
</template>
<script>
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import { backend } from 'src/marketplace/backend'
import { User } from 'src/marketplace/objects'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, onMounted, ref } from 'vue'

export default defineComponent({
  name: 'MarketplaceSettings',
  components: {
    MarketplaceHeader
  },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

    onMounted(() => {
      marketplaceStore.updateActiveShopId({ silent: true, forceSync: true, forceSyncAge: 5 * 60 * 1000 })
      marketplaceStore.refetchShopSettings()
    })

    const formattedMarkupSaleRate = computed(() => {
      const rate = marketplaceStore.shopSettings.markupSaleRate - 1
      const ratePctg = Math.round(rate * 10 ** 4) / 10 ** 2
      if (!ratePctg) return ''
      return (ratePctg > 0 ? '+' : '') + ratePctg + '%'
    })

    const defaultPOReviewerForm = ref({
      show: false,
      loading: false,
      user: marketplaceStore.shopSettings.defaultPurchaseOrderReviewer,
      userOpts: [],
      errors: [],
    })
    function filterAssignDefaultReviewerOpts(val, update, abortUpdate) {
      const params = {
        roles: marketplaceStore.roles.inventory,
        s: val,
      }

      backend.get(`shops/${marketplaceStore.activeShopId}/staff/`, { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          update(() => {
            defaultPOReviewerForm.value.userOpts = response.data.results.map(User.parse)
          })
          return response
        })
        .catch(() => abortUpdate()) 
    }

    function assignDefaultReviewer() {
      const data = {
        default_purchase_order_reviewer_id: defaultPOReviewerForm.value.user?.id || null,
      }

      defaultPOReviewerForm.value.loading = true
      defaultPOReviewerForm.value.show = false
      return backend.patch(`shops/${marketplaceStore.activeShopId}/settings/`, data)
        .then(response => {
          const data = response?.data
          if (!data?.id) return Promise.reject({ response })
          marketplaceStore.setShopSettingsData(response?.data)
          defaultPOReviewerForm.value.show = false
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
            let fieldError = errorParser.firstElementOrValue(data?.default_purchase_order_reviewer_id)
            if (String(fieldError).indexOf('does not exist') >= 0) fieldError = t('UserNotFound')
            errorMsgs = [fieldError].filter(Boolean)
          }

          if (!errorMsgs?.length) errorMsgs = [t('UnableToAssignReviewer')]
          defaultPOReviewerForm.value.errors = errorMsgs
          return Promise.reject(error)
        })
        .finally(() => {
          defaultPOReviewerForm.value.loading = false
        })
    }

    /**
     * @param {import("../../../node_modules/quasar/dist/types/").QDialogOptions} dialogOpts 
     */
    async function promiseDialog(dialogOpts) {
      return new Promise((resolve, reject) => {
        $q.dialog(dialogOpts)
          .onOk(resolve)
          .onDismiss(reject)
      })
    }

    const updatingLastPurchaseOrderNumber = ref(false)
    async function updateLastPurchaseOrderNumber() {
      const newNumber = await promiseDialog({
        title: t('PurchaseOrderNumber'),
        message: t('UpdateLastPurchaseOrderNumber'),
        position: 'bottom',
        prompt: {
          type:'number',
          dense: true,
          outlined: true,
          model: marketplaceStore.shopSettings.startingPurchaseOrderNumber,
          color: 'brandblue',
        },
        ok: { color: 'brandblue' },
        cancel: { color: 'grey', flat: true },
      }).catch(() => undefined)

      if (isNaN(newNumber)) return

      updatingLastPurchaseOrderNumber.value = true
      const data = { starting_purchase_order_number: newNumber || null }
      return backend.patch(`shops/${marketplaceStore.activeShopId}/settings/`, data)
        .then(response => {
          marketplaceStore.setShopSettingsData(response?.data)
          return response
        })
        .finally(() => {
          updatingLastPurchaseOrderNumber.value = false
        })
    }


    const updatingLastSalesOrderNumber = ref(false)
    async function updateLastSalesOrderNumber() {
      const newNumber = await promiseDialog({
        title: t('SalesOrderNumber'),
        message: t('UpdateLastSalesOrderNumber'),
        position: 'bottom',
        prompt: {
          type:'number',
          dense: true,
          outlined: true,
          model: marketplaceStore.shopSettings.startingSalesOrderNumber,
          color: 'brandblue',
        },
        ok: { color: 'brandblue' },
        cancel: { color: 'grey', flat: true },
      }).catch(() => undefined)

      if (isNaN(newNumber)) return

      updatingLastSalesOrderNumber.value = true
      const data = { starting_sales_order_number: newNumber || null }
      return backend.patch(`shops/${marketplaceStore.activeShopId}/settings/`, data)
        .then(response => {
          marketplaceStore.setShopSettingsData(response?.data)
          return response
        })
        .finally(() => {
          updatingLastSalesOrderNumber.value = false
        })
    }
    return {
      marketplaceStore,

      formattedMarkupSaleRate,

      defaultPOReviewerForm,
      filterAssignDefaultReviewerOpts,
      assignDefaultReviewer,

      updatingLastPurchaseOrderNumber,
      updateLastPurchaseOrderNumber,

      updatingLastSalesOrderNumber,
      updateLastSalesOrderNumber,
    }
  },
})
</script>
