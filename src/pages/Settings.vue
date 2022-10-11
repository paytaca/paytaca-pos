<template>
  <q-page class="settings-page">
    <MainHeader title="Settings"/>
    <q-card class="q-mx-md q-mt-lg text-weight-medium" style="border-radius:16px;">
      <q-list separator>
        <q-item clickable v-ripple @click="$q.dark.toggle()">
          <q-item-section :class="$q.dark.isActive ? 'text-white' : 'text-brandblue'">
            <q-item-label>Dark Mode</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-toggle
              :model-value="$q.dark.isActive"
              color="blue-9"
              keep-color
              @update:model-value="val => $q.dark.set(val)"
            />
          </q-item-section>
        </q-item>
        <q-item :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'">
          <q-item-section>
            <q-item-label>
              POS Device
            </q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-item-label class="text-subtitle1">
              {{ truncatedWalletHash }}
              <span>#{{ walletStore.posId }}</span>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </q-page>
</template>

<script>
import { computed, defineComponent } from 'vue'
import MainHeader from 'src/components/MainHeader.vue'
import { useWalletStore } from 'src/stores/wallet'

export default defineComponent({
    name: "SettingsPage",
    components: {
      MainHeader
    },
    setup() {
      const walletStore = useWalletStore()
      const truncatedWalletHash = computed(() => {
        const walletHash = walletStore.walletHash
        if (typeof walletHash !== 'string') return walletHash
        if (walletHash.length <= 13) return walletHash

        return walletHash.substring(0, 5) + '...' + walletHash.substring(walletHash.length-5)
      })

      return {
        walletStore,
        truncatedWalletHash,
      }
    }
})
</script>
