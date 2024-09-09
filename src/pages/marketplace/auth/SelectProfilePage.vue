<template>
  <q-page class="q-pa-md">
    <div class="row items-center q-mt-lg q-mb-md">
      <div class="q-space">
        <div class="text-h4">{{ $t('Marketplace') }}</div>
      </div>
    </div>

    <div v-if="!selectedUser?.id">
      <div
        v-if="!users?.length && fetchedUsers"
        class="text-center q-pa-md q-mx-auto"
        style="margin-top:10vh;width: max(300px, 50vw);"
      >
        <img
          src="marketplace.png"
          height="75"
          width="75"
          :class="$q.dark.isActive ? undefined : 'brandblue-img-filter'"
        />
        <div class="q-mb-md">
          <div v-if="marketplaceStore?.shop?.name" class="text-subtitle1">{{ marketplaceStore?.shop?.name }}</div>
          <div v-else class="text-subtitle1">Welcome to Marketplace!</div>
          <div class="text-caption">Register a user for the shop to get started</div>
        </div>
        <q-btn
          no-caps
          label="Register administrator"
          color="brandblue"
          :to="{ name: 'marketplace-register', query: { mode: 'onboarding' }}"
        />
      </div>
      <div v-else-if="fetchingUsers" class="text-center">
        <q-spinner size="3rem"/>
      </div>
      <div v-else :style="{ marginTop: `max(0px, calc(10vh - ${users?.length*1.5}rem))` }">
        <div class="q-px-sm q-mb-sm">
          <div class="text-h6">{{ $t('SignIn') }}</div>
          <div class="text-caption bottom">{{ marketplaceStore?.shop?.name }}</div>
        </div>
        <div v-if="!users?.length" class="text-center text-grey text-subtitle q-pa-md">
          {{ fetchedUsers ? 'No users' : 'Unable to load profiles' }}
        </div>
        <div
          v-for="user in users" :key="user?.id"
          class="user-select-item shadow-2" v-ripple
          @click="() => {
            selectedUser = user
          }"
        >
          <object
            v-if="user?.profilePictureUrl" :data="user?.profilePictureUrl"
            height="35"
            style="border-radius:999px;"
          >
            <img
              :src="`https://api.dicebear.com/5.x/initials/svg?seed=${user?.fullName}`"
              height="35"
              style="border-radius:999px;"
            />
          </object>
          <div>
            <div class="text-body1">
              {{ user?.fullName }}
              <q-icon v-if="user?.hasPassword === false" name="key_off" size="0.9em"/>
            </div>
            <div v-if="user?.currentShopRole?.roles?.length" class="q-gutter-sm">
              <q-badge v-for="shopRole in user?.currentShopRole?.roles" :key="shopRole" color="brandblue">
                {{ formatRole(shopRole) }}
              </q-badge>
            </div>
          </div>
        </div>
        <div class="q-my-lg text-grey text-center" >
          {{ $t('or') }}
        </div>
        <q-btn
          :color="$q.dark.isActive ? 'brandblue' : 'brandblue'"
          no-caps label="Sign-in with username"
          class="full-width q-mb-md"
          :to="{ name: 'marketplace-login-password' }"
        />
        <q-btn
          no-caps
          :outline="$q.dark.isActive"
          :color="$q.dark.isActive ? 'brandblue' : undefined"
          :label="$t('Register')"
          class="full-width q-mb-md"
          :to="{ name: 'marketplace-register' }"
        />
      </div>
    </div>
    <div v-else>
      <q-btn
        :disable="loggingIn"
        flat
        color="brandblue"
        icon="arrow_back"
        padding="xs md"
        class="q-r-ml-md"
        @click="() => selectedUser = null"
      />
      <div class="text-center q-mb-md q-mx-auto max-width" style="margin-top:5vh;">
        <object
          :data="selectedUser?.profilePictureUrl"
          height="100"
          width="auto"
          style="border-radius:999px;"
        >
          <img
            :src="`https://api.dicebear.com/5.x/initials/svg?seed=${selectedUser?.fullName}`"
            height="75"
            width="75"
            style="border-radius:999px;"
          />
        </object>
        <div class="text-subtitle1">
          Sign in as <span class="text-weight-medium">{{ selectedUser?.fullName }}</span>
        </div>
      </div>
      <div v-if="loggingIn" class="text-center">
        <q-spinner size="3rem"/>
      </div>
      <q-form v-else @submit="() => loginSelectedUser()">
        <q-input
          v-if="selectedUser?.hasPassword || forceRequirePassword"
          dense
          outlined
          :label="$t('Password')"
          type="password"
          v-model="selectedUserPassword"
          lazy-rules
          :rules="[
            val => Boolean(val) || $t('Required'),
          ]"
        />

        <q-banner v-if="loginError" class="bg-red-2 text-red q-mb-md q-mt-sm rounded-borders">
          {{ loginError }}
        </q-banner>
        <q-btn
          no-caps :label="$t('SignIn')"
          color="brandblue"
          type="submit"
          class="full-width"
        />
      </q-form>
    </div>
  </q-page>
</template>
<script>
import { generateTOTP } from 'src/utils/otp'
import { backend, setAuthToken, TOTP_AUTH_BASE_SECRET_KEY } from 'src/marketplace/backend'
import { User } from 'src/marketplace/objects'
import { errorParser, formatRole } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useRouter } from 'vue-router'
import { defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'SelectProfilePage',
  props: {
    redirectTo: String,
    username: String,
  },
  setup(props) {
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()

    onMounted(() => fetchUsers().then(() => {
      const autoSelectUsername = (props.username ?? marketplaceStore.lastLoggedInUsername) || ''
      if (!autoSelectUsername) return
      selectedUser.value = users.value.find(user => user?.username === autoSelectUsername)
    }))
    const users = ref([].map(User.parse))
    const fetchingUsers = ref(false)
    const fetchedUsers = ref(false)
    function fetchUsers() {
      const params = {
        limit: 100,
        order_by: 'id',
      }

      fetchingUsers.value = true
      return backend.get(`shops/${marketplaceStore.activeShopId}/staff/`, { params })
        .then(response => {
          users.value = response.data.results.map(User.parse)
          users.value.forEach(user => {
            user.currentShopId = marketplaceStore.activeShopId
          })

          fetchedUsers.value = true
          return response
        })
        .finally(() => {
          fetchingUsers.value = false
        })
    }

    const selectedUser = ref(User.parse())
    const selectedUserPassword = ref('')
    const forceRequirePassword = ref(false)
    watch(() => selectedUser.value?.id, () => selectedUserPassword.value = '')
    const loggingIn = ref(false)
    const loginError = ref('')
    function loginSelectedUser() {
      if (!selectedUser.value?.id) return

      const data = {
        user_id: selectedUser.value.id,
        password: selectedUserPassword.value || undefined,
        shop_id: marketplaceStore.activeShopId,
      }

      if (!data.password) {
        data.totp_timestamp = parseInt(Date.now() / 1000)
        data.totp = generateTOTP(
          `${TOTP_AUTH_BASE_SECRET_KEY}:${selectedUser.value?.id}`,
          undefined, undefined, data.totp_timestamp,
        )
      }

      loggingIn.value = true
      return backend.post(`users/get_auth_token/`, data)
        .finally(() => {
          loginError.value = ''
        })
        .then(async (response) => {
          if (response?.data?.auth_token) {
            console.log('Set auth token:', await setAuthToken(response?.data?.auth_token))
          }
          if (response?.data?.user_id) {
            marketplaceStore.setUser({ id: response?.data?.user_id })
            marketplaceStore.refetchShop()
            marketplaceStore.refreshUser({ silent: false })
              .then(response => {
                marketplaceStore.lastLoggedInUsername = response?.data?.username || ''
                return response
              })
              .then(() => {
                if (props.redirectTo) $router.replace(props.redirectTo)
                else $router.replace({ name: 'marketplace' })
              })
          }
        })
        .catch(error => {
          const data = error?.response?.data
          loginError.value = errorParser.firstElementOrValue(data?.non_field_errors) ||
            errorParser.firstElementOrValue(data?.detail) ||
            errorParser.firstElementOrValue(data?.totp) ||
            errorParser.firstElementOrValue(data?.username) ||
            errorParser.firstElementOrValue(data?.password)

          return Promise.reject(error)
        })
        .finally(() => {
          loggingIn.value = false
        })
    }

    return {
      marketplaceStore,
      
      users,
      fetchingUsers,
      fetchedUsers,

      selectedUser,
      selectedUserPassword,
      forceRequirePassword,
      loggingIn,
      loginError,
      loginSelectedUser,

      formatRole,
    }
  },
})
</script>
<style lang="scss" scoped>
.user-select-item {
  border-radius: map-get($space-sm, 'x');
  padding: map-get($space-sm, 'y') map-get($space-md, 'x');
  margin-bottom: map-get($space-sm, 'y');
  // border: 1px solid currentColor;
  position: relative;
  background-color: white;
  display: flex;
  align-items: center;
}

.user-select-item > :not(:nth-child(1)) {
  margin-left: map-get($space-sm, 'x');
}

.user-select-item > * {
  min-height: 2rem;
}

body.body--dark .user-select-item {
  background-color: $dark;
}

.max-width {
  max-width:max(250px, 50vw);
}

// got from https://stackoverflow.com/a/50942954
// meddled with settings a bit to adjust
.brandblue-img-filter {
  filter: invert(45%) sepia(60%) saturate(4982%) hue-rotate(200deg) brightness(90%) contrast(80%);
}
</style>
