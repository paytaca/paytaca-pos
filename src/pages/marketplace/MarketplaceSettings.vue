<template>
  <q-page class="q-pt-md q-px-md q-pb-xl">
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
        <q-item>
          <q-item-section avatar>
            <q-avatar rounded color="blue-1" text-color="brandblue" icon="store"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ marketplaceStore.shop?.name }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('Name') }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="marketplaceStore.merchant?.name">
          <q-item-section avatar>
            <q-avatar rounded color="teal-1" text-color="teal-8" icon="business"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ marketplaceStore.merchant?.name }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('Merchant', 'Merchant') }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="marketplaceStore.shop?.location?.formatted">
          <q-item-section avatar>
            <q-avatar rounded color="deep-orange-1" text-color="deep-orange-8" icon="location_on"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ marketplaceStore.shop?.location?.formatted }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('Address') }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section avatar>
            <q-avatar rounded color="amber-1" text-color="amber-9" icon="payments"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ marketplaceStore?.merchant?.currency?.symbol }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('Currency') }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card class="q-pt-sm q-mt-lg text-weight-medium" style="border-radius:16px;">
      <q-card-section class="q-py-xs">
        <div class="text-h6">
          <q-icon name="settings" size="1.5em" class="q-mr-xs"/>
          {{ $t('Settings') }}
        </div>
      </q-card-section>
      <q-separator/>
      <q-list separator>
        <q-item v-if="formattedMarkupSaleRate">
          <q-item-section avatar>
            <q-avatar rounded color="amber-1" text-color="amber-9" icon="percent"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium row items-center">
              {{ formattedMarkupSaleRate }}
              <q-icon name="info" class="q-ml-xs" size="1.2em"/>
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
            <q-item-label caption class="text-grey">
              {{ $t('MarkupPriceRate') }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item
          :disable="defaultPOReviewerForm.loading"
          :clickable="isAdmin"
          @click="() => isAdmin && (defaultPOReviewerForm.show = true)"
        >
          <q-item-section avatar>
            <q-avatar rounded color="blue-1" text-color="brandblue" icon="person_outline"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              <span v-if="marketplaceStore?.shopSettings?.defaultPurchaseOrderReviewer?.id">
                {{ marketplaceStore?.shopSettings?.defaultPurchaseOrderReviewer?.fullName }}
              </span>
              <span v-else class="text-grey">—</span>
            </q-item-label>
            <q-item-label caption class="text-grey row items-center">
              {{ $t('DefaultReviewer') }}
              <q-spinner v-if="defaultPOReviewerForm.loading" class="q-ml-xs" size="1em"/>
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="isAdmin" side>
            <q-icon name="edit" color="grey-6"/>
          </q-item-section>
        </q-item>
        <q-item :clickable="isAdmin" @click="() => isAdmin && updateLastPurchaseOrderNumber()">
          <q-item-section avatar>
            <q-avatar rounded color="indigo-1" text-color="indigo-7" icon="shopping_cart"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              <span v-if="marketplaceStore?.shopSettings?.startingPurchaseOrderNumber || marketplaceStore?.shopSettings?.startingPurchaseOrderNumber === 0">
                {{ marketplaceStore?.shopSettings?.startingPurchaseOrderNumber }}
              </span>
              <span v-else class="text-grey">—</span>
            </q-item-label>
            <q-item-label caption class="text-grey row items-center">
              {{ $t('LastPurchaseOrderNumber') }}
              <q-spinner v-if="updatingLastPurchaseOrderNumber" class="q-ml-xs" size="1em"/>
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="isAdmin" side>
            <q-icon name="edit" color="grey-6"/>
          </q-item-section>
        </q-item>
        <q-item :clickable="isAdmin" @click="() => isAdmin && updateLastSalesOrderNumber()">
          <q-item-section avatar>
            <q-avatar rounded color="green-1" text-color="green-8" icon="point_of_sale"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              <span v-if="marketplaceStore?.shopSettings?.startingSalesOrderNumber || marketplaceStore?.shopSettings?.startingSalesOrderNumber === 0">
                {{ marketplaceStore?.shopSettings?.startingSalesOrderNumber }}
              </span>
              <span v-else class="text-grey">—</span>
            </q-item-label>
            <q-item-label caption class="text-grey row items-center">
              {{ $t('LastSalesOrderNumber') }}
              <q-spinner v-if="updatingLastSalesOrderNumber" class="q-ml-xs" size="1em"/>
            </q-item-label>
          </q-item-section>
          <q-item-section v-if="isAdmin" side>
            <q-icon name="edit" color="grey-6"/>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>

    <q-card
      v-if="isAdmin"
      class="q-pt-sm q-mt-lg text-weight-medium"
      style="border-radius:16px;"
    >
      <q-card-section class="q-py-xs">
        <div class="text-h6">
          <q-icon name="tune" size="1.5em" class="q-mr-xs"/>
          {{ $t('TaxesDiscountsBenefits', 'Taxes, Discounts & Benefits') }}
        </div>
      </q-card-section>
      <q-separator/>
      <q-list separator>
        <q-item clickable :to="{ name: 'marketplace-taxes' }">
          <q-item-section avatar>
            <q-avatar rounded color="blue-1" text-color="brandblue" icon="receipt_long"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ $t('Taxes') }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('TaxesDescription', 'Manage the tax types applied to products') }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey-6"/>
          </q-item-section>
        </q-item>
        <q-item clickable :to="{ name: 'marketplace-discounts' }">
          <q-item-section avatar>
            <q-avatar rounded color="purple-1" text-color="purple-7" icon="local_offer"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ $t('Discounts') }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('DiscountsDescription', 'Create and manage discounts for your shop') }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey-6"/>
          </q-item-section>
        </q-item>
        <q-item clickable :to="{ name: 'marketplace-benefits' }">
          <q-item-section avatar>
            <q-avatar rounded color="green-1" text-color="green-8" icon="card_giftcard"/>
          </q-item-section>
          <q-item-section>
            <q-item-label class="text-weight-medium">
              {{ $t('BenefitPrograms', 'Benefit Programs') }}
            </q-item-label>
            <q-item-label caption class="text-grey">
              {{ $t('BenefitProgramsDescription', 'Set up benefit programs for your customers') }}
            </q-item-label>
          </q-item-section>
          <q-item-section side>
            <q-icon name="chevron_right" color="grey-6"/>
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

    const isAdmin = computed(() => marketplaceStore.userPermissions.admin)

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

      isAdmin,
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
