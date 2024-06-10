<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom" :persistent="loading" full-width>
    <q-card>
      <q-card-section>
        <div class="text-h6">
          Add Staff
        </div>
        <q-form @submit="() => addUser()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <div class="row items-center justify-end">
            <q-btn
              v-if="!formData.newUser"
              flat
              no-caps label="Register new user"
              icon-right="arrow_forward"
              @click="() => formData.newUser = true"
            />
            <q-btn
              v-else
              flat
              no-caps label="Add existing user"
              icon="arrow_back"
              @click="() => formData.newUser = false"
            />
          </div>
          <template v-if="!formData.newUser">
            <div>User*</div>
            <q-select
              dense
              outlined
              use-input
              fill-input
              :disable="loading"
              placeholder="name / email / username"
              :options="userOpts"
              :option-label="obj => obj?.fullName || obj?.username || obj?.email"
              option-value="id"
              v-model="formData.user"
              bottom-slots
              @filter="filterUserOpts"

              :error="Boolean(formErrors?.user)"
              :error-message="formErrors?.user"
              :rules="[
                val => Boolean(val?.id) || 'Required',
              ]"
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
              <template v-slot:no-option="props">
                <div class="q-pa-md text-center text-grey">
                    User
                    <template v-if="props.inputValue">'{{ props.inputValue }}'</template>
                    not found.
                    Check again if user is already registered and not in the staff list
                </div>
              </template>
            </q-select>
          </template>
          <template v-else>
            <div>Username</div>
            <q-input
              dense
              outlined
              :loading="usernameSearch.loading"
              :disable="loading"
              v-model="formData.username"
              :error="Boolean(formErrors?.username)"
              :error-message="formErrors?.username"
              debounce="500"
              @update:model-value="updateUsernameSearch"
              @focus="() => usernameSearch.show = Boolean(usernameSearch.user?.id)"
            >
              <q-menu
                v-model="usernameSearch.show"
                no-parent-event
                no-focus
                fit class="q-px-md q-py-sm"
              >
                <div v-if="usernameSearch.loading" class="text-grey text-center">
                  Searching for existing user
                  <q-spinner class="q-ml-xs"/>
                </div>
                <div
                  v-else-if="usernameSearch.user?.id"
                  @click="() => setSelectedUser(usernameSearch.user)"
                  v-close-popup
                >
                  <div class="text-weight-medium">
                    <div>{{ usernameSearch.user?.fullName || usernameSearch.user.username || usernameSearch.user.email }}</div>
                    <div class="text-caption bottom text-grey">User#{{ usernameSearch.user?.id }}</div>
                  </div>
                </div>
              </q-menu>
            </q-input>
            <div>Password</div>
            <q-input
              dense
              outlined
              :disable="loading"
              type="password"
              v-model="formData.password"
              autocomplete="on"
              :error="Boolean(formErrors?.password)"
              :error-message="formErrors?.password"
            />
            <div>Confirm password</div>
            <q-input
              dense
              outlined
              :disable="loading"
              type="password"
              v-model="formData.confirmPassword"
              autocomplete="on"
              reactive-rules
              :rules="[
                val => val === formData.password || 'Password does not match',
              ]"
            />
            <div>Email</div>
            <q-input
              dense
              outlined
              :disable="loading"
              v-model="formData.email"
              :error="Boolean(formErrors?.email)"
              :error-message="formErrors?.email"
              debounce="500"
              @update:model-value="updateEmailSearch"
              @focus="() => emailSearch.show = Boolean(emailSearch.user?.id)"
            >
              <q-menu
                v-model="emailSearch.show"
                no-parent-event
                no-focus
                fit class="q-px-md q-py-sm"
              >
                <div v-if="emailSearch.loading" class="text-grey text-center">
                  Searching for existing user
                  <q-spinner class="q-ml-xs"/>
                </div>
                <div
                  v-else-if="emailSearch.user?.id"
                  @click="() => setSelectedUser(emailSearch.user)"
                  v-close-popup
                >
                  <div class="text-weight-medium">
                    <div>{{ emailSearch.user?.fullName || emailSearch.user.username || emailSearch.user.email }}</div>
                    <div class="text-caption bottom text-grey">User#{{ emailSearch.user?.id }}</div>
                  </div>
                </div>
              </q-menu>
            </q-input>
            <div>First name</div>
            <q-input
              dense
              outlined
              :disable="loading"
              label="First name"
              v-model="formData.firstName"
              :error="Boolean(formErrors?.firstName)"
              :error-message="formErrors?.firstName"
            />
            <div>Last name</div>
            <q-input
              dense
              outlined
              :disable="loading"
              label="Last name"
              v-model="formData.lastName"
              :error="Boolean(formErrors?.lastName)"
              :error-message="formErrors?.lastName"
            />
          </template>
          <div>Roles</div>
          <div class="q-mb-md">
            <q-field
              v-model="formData.roles"
              borderless
              :error="Boolean(formErrors?.roles)"
              :error-message="formErrors?.roles"
              :rules="[
                val => val?.length || 'Required',
              ]"
            >
              <q-option-group
                v-model="formData.roles"
                :options="roleOpts"
                type="checkbox"
                :class="$q.dark.isActive ? 'text-white' : 'text-black'"
              />
            </q-field>
          </div>
          <div>
            <q-btn
              type="submit"
              :loading="loading"
              :disable="loading"
              color="brandblue"
              no-caps
              label="Add User"
              class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { User } from 'src/marketplace/objects'
import { backend } from 'src/marketplace/backend'
import { useDialogPluginComponent } from 'quasar'
import { computed, ref, defineComponent } from 'vue'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { errorParser } from 'src/marketplace/utils'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'AddShopUserRoleFormDialog',
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits
  ],
  setup() {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const marketplaceStore = useMarketplaceStore()
    const { t } = useI18n()

    const roleOpts = computed(() => {
      const roles = marketplaceStore.roles
      return [
        { value: roles.admin, label: t('Admin') },
        { value: roles.inventory, label: t('InventoryManager') },
        { value: roles.cashier, label: t('Cashier') },
      ]
    })
    
    const loading = ref(false)
    const formData = ref({
      newUser: false,
      user: User.parse(),
      
      username: '',
      email: '',
      firstName: '',
      lastName: '',
      password: '',
      confirmPassword: '',
      
      roles: [],
    })

    const formErrors = ref({
      detail: [],
      user: '',

      username: '',
      password: '',
      email: '',
      firstName: '',
      lastName: '',

      roles: '',
    })

    const usernameSearch = ref({ user: User.parse(), loading: false, show: false, })
    function updateUsernameSearch() {
      if (!formData.value.username) return usernameSearch.value.user = null
      const params = { username: formData.value.username, limit: 1 }
      usernameSearch.value.loading = true
      usernameSearch.value.show = true
      backend.get('users/search/', { params })
        .finally(() => {
          usernameSearch.value.user = null
        })
        .then(response => {
          const userData = response?.data?.results?.[0]
          usernameSearch.value.user = User.parse(userData)
          usernameSearch.value.show = Boolean(usernameSearch.value.user?.id)
        })
        .finally(() => {
          usernameSearch.value.loading = false
        })
    }

    const emailSearch = ref({ user: User.parse(), loading: false, show: false, })
    function updateEmailSearch() {
      if (!formData.value.email) return emailSearch.value.user = null
      const params = { email: formData.value.email, limit: 1 }

      emailSearch.value.loading = true
      emailSearch.value.show = true
      backend.get('users/search/', { params })
        .finally(() => {
          emailSearch.value.user = null
        })
        .then(response => {
          const userData = response?.data?.results?.[0]
          emailSearch.value.user = User.parse(userData)
          emailSearch.value.show = Boolean(emailSearch.value.user?.id)
        })
        .finally(() => {
          emailSearch.value.loading = false
        })
    }

    const userOpts = ref([].map(User.parse))
    function filterUserOpts(val, update, abortUpdate) {
      const params = {
        exclude_shop_id: marketplaceStore.activeShopId,
        s: val,
      }
      backend.get('users/search/', { params })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })
          update(() => {
            userOpts.value = response.data.results.map(User.parse)
          })
          return response
        })
        .catch(() => abortUpdate())
    }

    function setSelectedUser(user=User.parse()) {
      formData.value.user = user
      formData.value.newUser = false
    }

    function addUser() {
      if (formData.value.newUser) return registerUser()
      else return addShopUserRole()
    }

    function addShopUserRole() {
      const data = {
        user_id: formData.value.user?.id,
        shop_id: marketplaceStore.activeShopId,
        roles: formData.value.roles,
      }
 
      loading.value = true
      backend.post(`users/shop_roles/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          onDialogOK(User.parse(response?.data))
          return response
        })
        .catch(error => {
          if (error?.response?.data) {
            const data = error?.response?.data
            formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
            formErrors.value.user = errorParser.firstElementOrValue(data?.user_id)
            formErrors.value.roles = errorParser.firstElementOrValue(data?.roles)

            if (formErrors.value.user?.match?.(/.*does not exist.*/)) formErrors.value.user = t('UserNotFound')
            if (formErrors.value.roles?.match?.(/.*does not exist.*/)) formErrors.value.roles = t('RoleSNotFound')

            if (Array.isArray(data)) formErrors.value.detail = data
            if (data?.detail) formErrors.value.detail = [data?.detail]
          }

          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = [t('AddingUserErrorMsg')]
          }
          return Promise.reject(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function registerUser() {
      const data = {
        shop_id: marketplaceStore.activeShopId,
        username: formData.value.username,
        password: formData.value.password,
        email: formData.value.email,
        first_name: formData.value.firstName,
        last_name: formData.value.lastName,
        roles: formData.value.roles,
      }

      loading.value = true
      backend.post('users/register/', data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          $q.dialog({
            title: t('Registered'),
            message: t('RegistrationSuccessful'),
            ok: true,
          })
            .onDismiss(() => {
              $router.push({ name: 'marketplace-login' })
            })
          return response
        })
        .catch(error => {
          if (error?.response?.data) {
            const data = error?.response?.data
            formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
            // formErrors.value.role = errorParser.firstElementOrValue(data?.roles)
            formErrors.value.username = errorParser.firstElementOrValue(data?.username)
            formErrors.value.password = errorParser.firstElementOrValue(data?.password)
            formErrors.value.email = errorParser.firstElementOrValue(data?.email)
            formErrors.value.firstName = errorParser.firstElementOrValue(data?.first_name)
            formErrors.value.lastName = errorParser.firstElementOrValue(data?.last_name)

            if (Array.isArray(data)) formErrors.value.detail = data
            if (data?.detail) formErrors.value.detail = [data?.detail]
            if (!formErrors.value.detail?.length) {
              formErrors.value.detail = [t('RegisteringUserErrorMsg')]
            }
          }
          return Promise.reject(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,

      roleOpts,
      loading,
      formData,
      formErrors,
      usernameSearch,
      updateUsernameSearch,
      emailSearch,
      updateEmailSearch,
      userOpts,
      filterUserOpts,
      setSelectedUser,
      
      addUser,
    }
  },
})
</script>
