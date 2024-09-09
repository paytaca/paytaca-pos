<template>
  <q-page class="q-pa-md" :style="$q.platform.is.ios ? 'padding-top: 35px;' : ''">
    <div class="row items-center q-mt-lg q-mb-md">
      <div class="q-space">
        <div class="text-h4">{{ $t('Marketplace') }}</div>
      </div>
    </div>
    <q-card>
      <q-card-section>
        <div class="text-h5">{{ $t('SignIn') }}</div>
        <div class="q-pb-md q-pt-sm">
          <q-separator/>
        </div>
        <div v-if="errors.detail?.length > 0" class="q-py-sm">
          <div class="bg-red q-px-sm q-py-md rounded-borders">
            <div v-for="(error, index) in errors?.detail" :key="index" style="word-break:break-word;">
              {{ capitalize(error) }}
            </div>
          </div>
        </div>  
        <q-form @submit="() => login()" class="q-gutter-y-md">
          <q-input
            dense
            outlined
            :disable="loading"
            :label="$t('UsernameOrEmail')"
            v-model="formData.username"
            :error="Boolean(errors?.username)"
            :error-message="errors?.username"
          />
          <q-input
            dense
            outlined
            :disable="loading"
            type="password"
            :label="$t('Password')"
            v-model="formData.password"
            autocomplete="on"
            :error="Boolean(errors?.password)"
            :error-message="errors?.password"
          />
          <div>
            <q-btn
              :disable="loading"
              :loading="loading"
              type="submit"
              no-caps
              color="brandblue"
              :label="$t('SignIn')"
              class="full-width"
            />
          </div>
        </q-form>
        <div class="q-mt-md">
          <q-btn
            :disable="loading"
            :loading="loading"
            no-caps
            outline
            color="brandblue"
            :label="$t('Register')"
            class="full-width"
            :to="{ name: 'marketplace-register' }"
          />
        </div>
      </q-card-section>
    </q-card>
  </q-page>
</template>
<script>
import { useQuasar } from 'quasar'
import { backend, setAuthToken } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { capitalize, defineComponent, ref } from 'vue'
import { useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'LoginPage',
  props: {
    redirectTo: String,
    username: String,
  },
  setup(props) {
    const { t } = useI18n()
    const $q = useQuasar()
    const $router = useRouter()
    const marketplaceStore = useMarketplaceStore()
    const loading = ref(false)
    const formData = ref({
      username: (props.username ?? marketplaceStore.lastLoggedInUsername) || '',
      password: '',
    })
    const errors = ref({
      detail: [],
      username: '',
      password: '',
    })
    function clearErrors() {
      errors.value.detail = []
      errors.value.username = ''
      errors.value.password = ''
    }

    function login() {
      const data = {
        username: formData.value.username,
        password: formData.value.password,
      }

      clearErrors()
      loading.value = true
      backend.post('users/get_auth_token/', data)
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
              .catch(error => {
                $q.notify({
                  message: t('FailedToFetchUserData'),
                  type: 'negative',
                })
                return Promise.reject(error)
              })
              .then(() => {
                if (props.redirectTo) $router.replace(props.redirectTo)
                else $router.replace({ name: 'marketplace' })
              })
          }
          return response
        })
        .catch(error => {
          console.error(error)
          const username = error?.response?.data?.username
          const password = error?.response?.data?.password
          const detail = error?.response?.data?.non_field_errors || error?.response?.data?.detail
          if (username) errors.value.username = Array.isArray(username) ? username.join(', ') : username
          if (password) errors.value.password = Array.isArray(password) ? password.join(', ') : password
          if (detail) errors.value.detail = Array.isArray(detail) ? detail : [detail]

          console.log(error?.response)
          const isThrottled = error?.response?.status === 429
          const retryAfter = error?.response?.headers?.['Retry-After']
          if (isThrottled && !errors.value.detail?.length) {
            let msg = t('FrequentActionErrMsg1')
            if (retryAfter) msg += t(
              'FrequentActionErrMsg2',
              { seconds: retryAfter },
              `. Try again after ${retryAfter} seconds`
            )
            else msg += t('FrequentActionErrMsg3')

            errors.value.detail = [msg]
          }
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      loading,
      formData,
      errors,
      login,

      // utils funcs
      capitalize,
    }
  },
})
</script>
