<template>
  <q-banner
    v-if="visible"
    rounded
    dense
    class="q-mb-md bg-warning text-dark"
  >
    <template v-slot:avatar>
      <q-icon name="warning" size="sm" />
    </template>
    <div class="text-body2">
      {{ $t('SetUpTaxesOrSkip', 'Set up taxes (or skip)') }}
      <div class="text-caption text-grey-8">
        {{ $t('NoDefaultTaxTypeHint', 'New products will use a default tax type when set.') }}
      </div>
    </div>
    <template v-slot:action>
      <q-btn
        v-if="showAction"
        flat
        no-caps
        dense
        color="dark"
        :label="actionLabel || $t('SetUpTaxes', 'Set up taxes')"
        @click="$emit('action')"
      />

      <q-btn
        v-if="dismissible"
        flat
        dense
        no-caps
        color="grey-7"
        @click="$emit('dismiss')"
      >
        {{ $t('Dismiss', 'Dismiss') }}
      </q-btn>
    </template>
  </q-banner>
</template>
<script>
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent } from 'vue'

/**
 * Nudge for shops that have no tax setup yet.
 *
 * Only rendered for shop admins, and only while the shop has neither an applied
 * tax regime nor a default tax type. Once either is set the shop is considered
 * set up and the banner disappears.
 *
 * Purely presentational: the host decides what `action` does (and whether the
 * banner is dismissible).
 */
export default defineComponent({
  name: 'TaxSetupStatusBanner',
  props: {
    dismissible: Boolean,
    showAction: {
      type: Boolean,
      default: true,
    },
    /** Overrides the default action label ("Set up taxes"). */
    actionLabel: {
      type: String,
      default: undefined,
    },
  },
  emits: ['action', 'dismiss'],
  setup() {
    const marketplaceStore = useMarketplaceStore()

    const isAdmin = computed(() => marketplaceStore.userPermissions.admin)
    const hasAppliedRegime = computed(() => Boolean(marketplaceStore.shopSettings?.appliedTaxRegime?.id))
    const hasDefaultTaxType = computed(() => Boolean(marketplaceStore.shopSettings?.defaultTaxType?.id))
    const visible = computed(() => isAdmin.value && !hasAppliedRegime.value && !hasDefaultTaxType.value)

    return {
      visible,
    }
  },
})
</script>
