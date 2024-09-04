<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom" :persistent="loading" full-width>
    <q-card>
      <q-card-section>
        <div class="q-mb-md">
          <q-btn flat padding="sm" icon="close" class="float-right" v-close-popup/>
          <div class="text-h6">
            {{ $t('AddStaff', {}, 'Add Staff') }}
          </div>
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
              no-caps :label="$t('RegisterNewuser', {}, 'Register new user')"
              icon-right="arrow_forward"
              @click="() => formData.newUser = true"
            />
            <q-btn
              v-else
              flat
              no-caps :label="$t('AddExistingUser', {}, 'Add existing user')"
              icon="arrow_back"
              @click="() => formData.newUser = false"
            />
          </div>
          <template v-if="!formData.newUser">
            <div>{{ $t('User') }}*</div>
            <q-select
              dense
              outlined
              use-input
              fill-input
              :disable="loading"
              :placeholder="`${$t('Name')} / ${$t('Email')} / ${$t('Username')}`"
              :options="userOpts"
              :option-label="obj => obj?.fullName || obj?.username || obj?.email"
              option-value="id"
              v-model="formData.user"
              bottom-slots
              @filter="filterUserOpts"

              :error="Boolean(formErrors?.user)"
              :error-message="formErrors?.user"
              :rules="[
                val => Boolean(val?.id) || $t('Required'),
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
              <template v-slot:no-option>
                <div class="q-pa-md text-center text-grey">
                  {{ $t('UserNotFound', {}, 'User not found')}}
                </div>
              </template>
            </q-select>
          </template>
          <template v-else>
            <div>{{ $t('FirstName', {}, 'First name') }}</div>
            <q-input
              dense
              outlined
              :disable="loading"
              :label="$t('FirstName', {}, 'First name')"
              v-model="formData.firstName"
              :error="Boolean(formErrors?.firstName)"
              :error-message="formErrors?.firstName"
            />
            <div>{{ $t('LastName', {}, 'Last name') }}</div>
            <q-input
              dense
              outlined
              :disable="loading"
              :label="$t('LastName', {}, 'Last name')"
              v-model="formData.lastName"
              :error="Boolean(formErrors?.lastName)"
              :error-message="formErrors?.lastName"
            />
          </template>
          <div>{{ $t('Roles') }}</div>
          <div class="q-mb-md">
            <q-field
              v-model="formData.roles"
              borderless
              :error="Boolean(formErrors?.roles)"
              :error-message="formErrors?.roles"
              :rules="[
                val => val?.length || $t('Required'),
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
              :label="$t('AddUser', {}, 'Add User')"
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
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { useI18n } from 'vue-i18n'
import { computed, defineComponent, ref, watch } from 'vue'
import { backend } from 'src/marketplace/backend'

export default defineComponent({
  name: 'AddStaffFormDialog',
  emits: [
    ...useDialogPluginComponent.emits,
    'update:modelValue',
  ],
  props: {
    modelValue: Boolean,
  },
  setup(props, { emit: $emit }) {
    const { t: $t } = useI18n()
    const marketplaceStore = useMarketplaceStore()

    const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => props.modelValue, () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const roleOpts = computed(() => {
      const roles = marketplaceStore.roles
      const opts = [
        { value: roles.inventory, label: $t('InventoryManager') },
        { value: roles.cashier, label: $t('Cashier') },
        { value: roles.storefront, label: $t('Storefront') },
      ]

      if (!formData.value.newUser) {
        opts.unshift({ value: roles.admin, label: $t('Admin') })
      }

      return opts
    })
    
    const loading = ref(false)
    const formData = ref({
      newUser: true,
      user: User.parse(),

      roles: [],

      firstName: '',
      lastName: '',
    })


    const formErrors = ref({
      detail: [],
      user: '',

      firstName: '',
      lastName: '',

      roles: '',
    })

    const userOpts = ref([].map(User.parse))
    function filterUserOpts(val, update, abortUpdate) {
      const params = {
        exclude_shop_id: marketplaceStore.activeShopId,
        has_password: true,
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

            if (formErrors.value.user?.match?.(/.*does not exist.*/)) formErrors.value.user = $t('UserNotFound')
            if (formErrors.value.roles?.match?.(/.*does not exist.*/)) formErrors.value.roles = $t('RoleSNotFound')

            if (Array.isArray(data)) formErrors.value.detail = data
            if (data?.detail) formErrors.value.detail = [data?.detail]
          }

          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = [$t('AddingUserErrorMsg')]
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
        first_name: formData.value.firstName,
        last_name: formData.value.lastName,
        roles: formData.value.roles,
      }

      loading.value = true
      backend.post('users/register_staff/', data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          onDialogOK(User.parse(response?.data))
          return response
        })
        .catch(error => {
          if (error?.response?.data) {
            const data = error?.response?.data
            formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
            formErrors.value.roles = errorParser.firstElementOrValue(data?.roles)
            // formErrors.value.username = errorParser.firstElementOrValue(data?.username)
            // formErrors.value.password = errorParser.firstElementOrValue(data?.password)
            // formErrors.value.email = errorParser.firstElementOrValue(data?.email)
            formErrors.value.firstName = errorParser.firstElementOrValue(data?.first_name)
            formErrors.value.lastName = errorParser.firstElementOrValue(data?.last_name)

            if (Array.isArray(data)) formErrors.value.detail = data
            if (data?.detail) formErrors.value.detail = [data?.detail]
            if (!formErrors.value.detail?.length) {
              formErrors.value.detail = [$t('RegisteringUserErrorMsg')]
            }
          }
          return Promise.reject(error)
        })
        .finally(() => {
          loading.value = false
        })
    }

    return {
      dialogRef, onDialogCancel, onDialogHide, onDialogOK,
      innerVal,

      roleOpts,
      loading,
      formData,

      formErrors,

      userOpts,
      filterUserOpts,

      addUser,
    }
  },
})
</script>
