<template>
  <div class="row q-mt-sm q-mb-md q-r-ml-lg">
    <slot name="title">
      <div class="q-space">
        <div class="text-h4">{{ title }}</div>
      </div>
    </slot>
    <div>
      <div class="user-icon" role="button" @click="() => openUserMenu = true">
        <img :src="userImage" style="width:100%"/>
      </div>
    </div>
    <q-dialog v-model="openUserMenu" position="bottom">
      <q-card>
        <q-card-section>
          <div class="row items-center">
            <img
              :src="userImage" style="width:50px"
              class="rounded-borders q-mr-sm"
            />
            <div>
              <div>
                {{ marketplaceStore.user.firstName }}
                {{ marketplaceStore.user.lastName }}
                <span class="text-grey">#{{ marketplaceStore.user.id }}</span>
              </div>
              <div class="text-grey">
                {{ marketplaceStore.user.username }}
              </div>
            </div>
          </div>
          <div v-if="marketplaceStore?.userRoles?.length" class="q-mt-xs q-gutter-sm">
            <q-badge v-for="(role, index) in marketplaceStore?.userRoles" :key="index">
              {{ formatRole(role) }}
            </q-badge>
          </div>
        </q-card-section>
        <q-list>
          <q-item clickable v-ripple v-close-popup :to="{ name: 'marketplace-user' }">
            <q-item-section>
              <q-item-label>Change Password</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator/>
          <q-item clickable v-ripple v-close-popup @click="() => logOut()">
            <q-item-section>
              <q-item-label>Logout</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import { setAuthToken } from 'src/marketplace/backend'
import { formatRole } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, ref } from 'vue'
import blankUserImg from 'src/assets/blank_user_image.webp'

export default defineComponent({
  name: 'MarketplaceHeader',
  props: {
    title: { type: String, default: 'Marketplace'},
  },
  setup() {
    const marketplaceStore = useMarketplaceStore()
    const openUserMenu = ref(false)

    const userImage = computed(() => {
      if (marketplaceStore.user.imageUrl) return marketplaceStore.user.imageUrl

      if (marketplaceStore.user.firstName || marketplaceStore.user.lastName) {
        const fullName = `${marketplaceStore.user.firstName} ${marketplaceStore.user.lastName}`
        return `https://api.dicebear.com/5.x/initials/svg?seed=${fullName}`
      }
      return blankUserImg
    })

    function logOut() {
      setAuthToken(undefined)
      marketplaceStore.setUser(null)
    }

    return {
      marketplaceStore,
      openUserMenu,
      userImage,
      logOut,

      // utils funcs
      formatRole,
    }
  },
})
</script>
<style scoped lang="scss">
.user-icon {
  height: 45px;
  width: 45px;
  border-radius: 999px;
  overflow:hidden;
}
</style>
