<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader back-button-mode="back" show-back-button>
      <template v-slot:title>
        <div class="q-space row items-center no-wrap">
          <div class="q-space">
            <div class="text-h5">{{ $t('SetUpTaxes', 'Set up taxes') }}</div>
            <div class="text-grey">{{ $t('Marketplace') }}</div>
          </div>
          <q-btn flat round dense icon="help_outline" color="grey-8" @click="openHelp">
            <q-tooltip>{{ $t('Help', 'Help') }}</q-tooltip>
          </q-btn>
        </div>
      </template>
    </MarketplaceHeader>

    <!-- Choose a setup -->
    <template v-if="view === 'choose'">
      <div v-if="fetchingRegimes" class="row justify-center q-pa-xl">
        <q-spinner color="brandblue" size="3em" />
      </div>

      <template v-else-if="regimes.length">
        <div class="text-subtitle2 q-mb-sm">
          {{ $t('ChooseTaxSetup', 'Choose a tax setup') }}
        </div>

        <q-list separator bordered class="rounded-borders" :class="$q.dark.isActive ? '' : 'bg-white'">
          <q-item
            v-for="regime in regimes"
            :key="regime.id"
            clickable
            v-ripple
            @click="selectRegime(regime)"
          >
            <q-item-section avatar>
              <q-radio v-model="selectedRegimeId" :val="regime.id" color="brandblue" />
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{ regime.name }}</q-item-label>
              <q-item-label caption class="text-grey">
                {{ regime.countryCode || $t('Universal', 'Universal') }}
              </q-item-label>
            </q-item-section>
            <q-item-section v-if="regime.isDefaultForCountry" side>
              <q-badge color="amber" text-color="dark">
                {{ $t('Recommended', 'Recommended') }}
              </q-badge>
            </q-item-section>
          </q-item>
        </q-list>
      </template>

      <q-card
        v-else-if="fetchError"
        class="q-pa-md text-center"
        style="border-radius:16px;"
      >
        <q-icon name="cloud_off" size="3em" class="text-grey-6 q-mb-sm" />
        <div class="text-subtitle1">{{ $t('FailedToLoadTaxSetups', "Couldn't load tax setups") }}</div>
        <div class="text-caption text-grey q-mt-xs">
          {{
            $t(
              'FailedToLoadTaxSetupsHint',
              'Something went wrong while loading tax setups. Please try again.',
            )
          }}
        </div>
        <q-btn
          class="q-mt-md"
          outline
          no-caps
          color="brandblue"
          :label="$t('Retry', 'Retry')"
          @click="fetchRegimes"
        />
      </q-card>

      <q-card
        v-else
        class="q-pa-md text-center"
        style="border-radius:16px;"
      >
        <q-icon name="info" size="3em" class="text-grey-6 q-mb-sm" />
        <div class="text-subtitle1">{{ $t('NoTaxSetupAvailable', 'No tax setup is available for your shop') }}</div>
        <div class="text-caption text-grey q-mt-xs">
          {{
            $t(
              'NoTaxSetupAvailableHint',
              "We couldn't find a tax setup for your shop's country. You can still add tax types manually.",
            )
          }}
        </div>
        <q-btn
          class="q-mt-md"
          outline
          no-caps
          color="brandblue"
          :label="$t('ManageTaxTypes', 'Manage tax types')"
          @click="$router.push({ name: 'marketplace-taxes' })"
        />
      </q-card>
    </template>

    <!-- Review the selected setup -->
    <template v-else-if="selectedRegime">
      <div class="row items-center no-wrap q-mb-sm">
        <div class="q-space">
          <div class="text-h6">{{ selectedRegime.name }}</div>
          <div class="text-caption text-grey">
            {{
              hasMultipleRegimes
                ? $t('TaxSetupReviewSubtitle', 'Review what this setup adds')
                : $t('TaxSetupSingleSubtitle', 'This is the only tax setup available for your shop')
            }}
          </div>
        </div>
        <q-btn
          v-if="hasMultipleRegimes"
          flat
          dense
          no-caps
          color="brandblue"
          icon="swap_horiz"
          :label="$t('Change', 'Change')"
          @click="view = 'choose'"
        />
      </div>

      <q-card style="border-radius:16px;">
        <q-list>
          <q-item
            v-if="selectedRegime.defaultTaxType"
            clickable
            v-ripple
            @click="openTaxTypeDetail(selectedRegime.defaultTaxType)"
          >
            <q-item-section>
              <q-item-label caption class="text-grey">
                {{ $t('DefaultTaxType', 'Default tax type') }}
              </q-item-label>
              <q-item-label class="text-weight-medium">
                {{ taxTypeLabel(selectedRegime.defaultTaxType) }}
              </q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="chevron_right" color="grey-6" />
            </q-item-section>
          </q-item>
          <q-item v-else>
            <q-item-section>
              <q-item-label caption class="text-grey">
                {{ $t('DefaultTaxType', 'Default tax type') }}
              </q-item-label>
              <q-item-label class="text-grey">—</q-item-label>
            </q-item-section>
          </q-item>

          <q-separator />

          <q-item-label header class="text-subtitle2 text-weight-medium" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-8'">
            {{ $t('TaxTypes', 'Tax types') }}
          </q-item-label>
          <q-item
            v-for="taxType in selectedRegime.taxTypes"
            :key="taxType.id"
            clickable
            v-ripple
            @click="openTaxTypeDetail(taxType)"
          >
            <q-item-section>
              <q-item-label>{{ taxType.name }}</q-item-label>
              <q-item-label caption class="text-grey">{{ getTaxCodeLabel(taxType.code) }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row items-center q-gutter-x-xs">
                <span v-if="taxRateLabel(taxType, { hideZeroValue: true })">{{ taxRateLabel(taxType, { hideZeroValue: true }) }}</span>
                <q-icon
                  v-if="isRegimeDefaultTaxType(taxType)"
                  name="star"
                  color="amber-7"
                  size="1.1em"
                >
                  <q-tooltip>{{ $t('DefaultTaxType', 'Default tax type') }}</q-tooltip>
                </q-icon>
              </div>
            </q-item-section>
          </q-item>

          <template v-if="selectedRegime.discountTypes.length">
            <q-separator />
            <q-item-label header class="text-subtitle2 text-weight-medium" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-8'">
              {{ $t('Discounts') }}
            </q-item-label>
            <q-item
              v-for="discount in selectedRegime.discountTypes"
              :key="discount.id"
              clickable
              v-ripple
              @click="openDiscountDetail(discount)"
            >
              <q-item-section>
                <q-item-label>{{ discount.name }}</q-item-label>
                <q-item-label caption class="text-grey">{{ getDiscountCodeLabel(discount.code) }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <div class="row items-center q-gutter-x-xs">
                  <span>{{ formatDiscountValue(discount) }}</span>
                  <q-icon name="chevron_right" color="grey-6" />
                </div>
              </q-item-section>
            </q-item>
          </template>

          <template v-if="selectedRegime.benefitPrograms.length">
            <q-separator />
            <q-item-label header class="text-subtitle2 text-weight-medium" :class="$q.dark.isActive ? 'text-grey-4' : 'text-grey-8'">
              {{ $t('BenefitPrograms', 'Benefit programs') }}
            </q-item-label>
            <q-item
              v-for="program in selectedRegime.benefitPrograms"
              :key="program.id"
              clickable
              v-ripple
              @click="openBenefitProgramDetail(program)"
            >
              <q-item-section>
                <q-item-label>{{ program.name }}</q-item-label>
              </q-item-section>
              <q-item-section side>
                <q-icon name="chevron_right" color="grey-6" />
              </q-item-section>
            </q-item>
          </template>
        </q-list>
      </q-card>

      <q-btn
        class="full-width q-mt-lg"
        color="brandblue"
        no-caps
        :label="$t('ApplyTaxSetup', 'Apply tax setup')"
        :loading="applying"
        @click="applyRegime"
      />
    </template>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { TaxRegime } from 'src/marketplace/objects'
import { useTaxTypeHelpers } from 'src/composables/marketplace/taxTypesForm'
import { useDiscountTypeHelpers } from 'src/composables/marketplace/discount'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, onMounted, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import TaxTypeDetailDialog from 'src/components/marketplace/taxes/TaxTypeDetailDialog.vue'
import TaxSetupHelpDialog from 'src/components/marketplace/taxes/TaxSetupHelpDialog.vue'
import DiscountTypeDetailDialog from 'src/components/marketplace/discounts/DiscountTypeDetailDialog.vue'
import BenefitProgramDetailDialog from 'src/components/marketplace/benefits/BenefitProgramDetailDialog.vue'

export default defineComponent({
  name: 'TaxRegimeSetupPage',
  components: {
    MarketplaceHeader,
  },
  setup() {
    const $q = useQuasar()
    const { t: $t } = useI18n()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    const { getTaxCodeLabel, taxRateLabel, taxTypeLabel } = useTaxTypeHelpers()
    const { getDiscountCodeLabel, formatDiscountValue } = useDiscountTypeHelpers()

    const view = ref('choose')
    const regimes = ref([].map(TaxRegime.parse))
    const selectedRegimeId = ref(null)
    const fetchingRegimes = ref(false)
    const fetchError = ref(false)
    const applying = ref(false)

    const selectedRegime = computed(() => {
      return regimes.value.find(regime => regime.id === selectedRegimeId.value) || null
    })

    const hasMultipleRegimes = computed(() => regimes.value.length > 1)

    function isRegimeDefaultTaxType(taxType) {
      return Boolean(
        selectedRegime.value?.defaultTaxType?.id
        && selectedRegime.value.defaultTaxType.id === taxType?.id,
      )
    }

    function selectRegime(regime) {
      selectedRegimeId.value = regime.id
      view.value = 'review'
    }

    function openTaxTypeDetail(taxType) {
      if (!taxType?.id) return
      $q.dialog({ component: TaxTypeDetailDialog, componentProps: { taxType } })
    }

    function openHelp() {
      $q.dialog({ component: TaxSetupHelpDialog })
    }

    function openDiscountDetail(discount) {
      if (!discount?.id) return
      $q.dialog({ component: DiscountTypeDetailDialog, componentProps: { discountType: discount } })
    }

    function openBenefitProgramDetail(program) {
      if (!program?.id) return
      $q.dialog({ component: BenefitProgramDetailDialog, componentProps: { benefitProgram: program } })
    }

    function fetchRegimes() {
      const shopId = marketplaceStore.shop?.id || marketplaceStore.activeShopId
      if (!shopId) {
        // Without a shop we can't tell whether any setups exist, so don't
        // claim that none are available.
        fetchError.value = true
        return Promise.resolve()
      }

      fetchingRegimes.value = true
      fetchError.value = false
      return backend.get('tax-regimes/', {
        params: { shop_ids: shopId, is_active: true, limit: 100 },
      })
        .then(response => {
          const data = response?.data
          const results = Array.isArray(data) ? data : data?.results
          regimes.value = Array.isArray(results) ? results.map(TaxRegime.parse) : []

          // Preselect the country's recommended blueprint. With only one option
          // there's nothing to choose, so skip straight to the review screen.
          const picked = regimes.value.find(regime => regime.isDefaultForCountry) || regimes.value[0]
          if (picked) {
            selectedRegimeId.value = picked.id
            if (regimes.value.length === 1) view.value = 'review'
          }
          return response
        })
        .catch(() => {
          fetchError.value = true
          regimes.value = []
        })
        .finally(() => {
          fetchingRegimes.value = false
        })
    }

    function goBack() {
      if (window.history.state?.back) $router.back()
      else $router.push({ name: 'marketplace' })
    }

    function applyRegime() {
      if (!selectedRegime.value) return
      const regime = selectedRegime.value

      applying.value = true
      return backend.post('tax-regimes/apply/', {
        shop_id: marketplaceStore.activeShopId,
        regime_id: regime.id,
      })
        .then(async () => {
          await marketplaceStore.refetchShopSettings().catch(() => {})
          $q.notify({
            type: 'positive',
            message: $t('TaxSetupApplied', { name: regime.name }, `Applied "${regime.name}"`),
          })
          goBack()
        })
        .catch(error => {
          const data = error?.response?.data
          const message = data?.non_field_errors?.[0]
            || data?.detail
            || (Array.isArray(data) ? data[0] : null)
            || $t('FailedToApplyTaxSetup', 'Failed to apply tax setup')
          $q.notify({ type: 'negative', message })
        })
        .finally(() => {
          applying.value = false
        })
    }

    onMounted(async () => {
      await marketplaceStore.appRefreshScopePromise?.catch?.(() => {})
      if (!marketplaceStore.shop?.id) await marketplaceStore.refetchShop().catch(() => {})
      fetchRegimes()
    })

    return {
      marketplaceStore,
      view,
      regimes,
      selectedRegimeId,
      selectedRegime,
      fetchingRegimes,
      fetchError,
      applying,
      hasMultipleRegimes,

      getTaxCodeLabel,
      getDiscountCodeLabel,
      taxRateLabel,
      taxTypeLabel,
      isRegimeDefaultTaxType,
      formatDiscountValue,

      selectRegime,
      openTaxTypeDetail,
      openDiscountDetail,
      openBenefitProgramDetail,
      openHelp,

      fetchRegimes,
      applyRegime,
    }
  },
})
</script>
