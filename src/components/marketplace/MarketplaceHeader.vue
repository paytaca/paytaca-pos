<template>
  <div class="row q-mt-sm q-mb-md q-r-ml-lg">
    <slot name="title">
      <div class="q-space">
        <div class="text-h4">{{ title }}</div>
      </div>
    </slot>
    <div>
      <div class="user-icon" role="button" @click="() => openUserMenu = true">
        <q-img :src="userImage" style="width:100%;border-radius: 999px;" ratio="1"/>
      </div>
    </div>
    <q-dialog v-model="openUserMenu" position="bottom">
      <q-card>
        <q-card-section>
          <div class="row items-start">
            <img
              :src="userImage" style="width:50px"
              class="rounded-borders q-mr-sm self-center"
              @click="$router.push({ name: 'marketplace-user' })"
            />
            <div @click="$router.push({ name: 'marketplace-user' })">
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
              <q-item-label>{{ $t('ChangePassword') }}</q-item-label>
            </q-item-section>
          </q-item>
          <q-separator/>
          <q-item clickable v-ripple v-close-popup @click="() => logOut()">
            <q-item-section>
              <q-item-label>{{ $t('Logout') }}</q-item-label>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import { backend, setAuthToken } from 'src/marketplace/backend'
import { formatRole } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { i18n } from 'src/boot/i18n'
import { computed, defineComponent, ref } from 'vue'
import blankUserImg from 'src/assets/blank_user_image.webp'

const { t } = i18n.global

export default defineComponent({
  name: 'MarketplaceHeader',
  props: {
    title: { type: String, default: t('Marketplace') },
  },
  setup() {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()
    const openUserMenu = ref(false)

    const userImage = computed(() => {
      if (marketplaceStore.user.profilePictureUrl) return marketplaceStore.user.profilePictureUrl

      if (marketplaceStore.user.firstName || marketplaceStore.user.lastName) {
        const fullName = `${marketplaceStore.user.firstName} ${marketplaceStore.user.lastName}`
        return `https://api.dicebear.com/5.x/initials/svg?seed=${fullName}`
      }
      return blankUserImg
    })

    async function logOut() {
      try{
        $q.loading.show({ group: 'logout' })
        await backend.post(`users/revoke_token/`).catch(console.error)
          .then(() => $q.loading.hide('logout'))
        setAuthToken(undefined)
        marketplaceStore.setUser(null)
      } finally {
        $q.loading.hide('logout')
      }
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
  overflow:hidden;
}
</style>
