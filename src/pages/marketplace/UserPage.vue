<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">User</div>
          <div class="text-grey">Marketplace</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-card class="q-mb-md">
      <q-card-section class="q-pb-none row items-center">
        <div class="text-h6">Profile</div>
        <q-space/>
        <q-btn
          v-if="!profileEditMode"
          flat
          icon="edit"
          padding="xs"
          @click="() => profileEditMode = true"
        />
      </q-card-section>
      <q-slide-transition>
        <q-card-section v-if="profileEditMode" class="q-pt-none">
          <UserProfileForm :user="marketplaceStore.user" @updated="() => profileEditMode = false"/>
          <q-btn
            outline
            no-caps label="Cancel"
            color="grey"
            class="full-width q-mt-sm"
            @click="() => profileEditMode = false"
          />
        </q-card-section>  
      </q-slide-transition>
      <q-slide-transition>
        <q-card-section v-if="!profileEditMode" class="row q-r-mx-md q-pt-none">
          <div
            v-if="marketplaceStore?.user?.profilePictureUrl"
            class="col-12 q-px-sm row items-center justify-center"
          >
            <img
              :src="marketplaceStore?.user?.profilePictureUrl"
              style="max-height:200px;max-width:100%;object-fit: contain;"
              class="rounded-borders"
            />
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.firstName }}</div>
            <div class="text-caption bottom">First name</div>
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.lastName }}</div>
            <div class="text-caption bottom">Last name</div>
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.email }}</div>
            <div class="text-caption bottom">Email</div>
          </div>
  
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.username }}</div>
            <div class="text-caption bottom">Username</div>
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div v-if="marketplaceStore?.user?.phoneNumber">{{ marketplaceStore?.user?.phoneNumber }}</div>
            <i v-else class="text-grey">None</i>
            <div class="text-caption bottom">Phone number</div>
          </div>
        </q-card-section>
      </q-slide-transition>
    </q-card>
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">Change Password</div>
        <q-form ref="form" @submit="() => changePassword()">
          <q-banner v-if="formErrors?.detail?.length" class="bg-red text-white rounded-borders q-mb-md">
            <div v-if="formErrors?.detail?.length === 1">
              {{ formErrors.detail[0] }}
            </div>
            <ul v-else class="q-pl-md">
              <li v-for="(err, index) in formErrors?.detail" :key="index">{{err}}</li>
            </ul>
          </q-banner>
          <q-input
            dense
            outlined
            :disable="formData.loading"
            clearable
            label="Current Password"
            type="password"
            v-model="formData.current"
            autocomplete="on"
            :error="Boolean(formErrors?.current)"
            :error-message="formErrors?.current"
          />
          <q-input
            dense
            outlined
            :disable="formData.loading"
            label="New Password"
            type="password"
            v-model="formData.new"
            autocomplete="on"
            :error="Boolean(formErrors?.new)"
            :error-message="formErrors?.new"
          />
          <q-input
            dense
            outlined
            :disable="formData.loading"
            label="Confirm New Password"
            type="password"
            v-model="formData.newConfirm"
            autocomplete="on"
            reactive-rules
            :rules="[
              val => val === formData.new || 'Password does not match',
            ]"
          />
          <div class="q-mt-sm">
            <q-btn
              :disable="formData.loading"
              :loading="formData.loading"
              color="brandblue"
              no-caps
              label="Update password"
              type="submit"
              class="full-width"
            />
          </div>
        </q-form>
      </q-card-section>
    </q-card>
  </q-page>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { errorParser } from 'src/marketplace/utils'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useQuasar } from 'quasar'
import { defineComponent, ref } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import UserProfileForm from 'src/components/marketplace/UserProfileForm.vue'

export default defineComponent({
  name: 'UserPage',
  components: {
    MarketplaceHeader,
    UserProfileForm,
  },
  setup() {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const profileEditMode = ref(false)

    const formData = ref({
      loading: false,
      current: '',
      new: '',
      newConfirm: '',
    })

    const form = ref()
    function clearFormData() {
      formData.value.current = ''
      formData.value.new = ''
      formData.value.newConfirm = ''
      setTimeout(() => {
        form.value?.resetValidation?.()
      }, 100)
    }

    const formErrors = ref({
      detail: [],
      current: '',
      new: '',
    })

    function clearFormErrors() {
      formErrors.value.detail = []
      formErrors.value.current = ''
      formErrors.value.new = ''
    }

    function changePassword() {
      const data = {
        current_password: formData.value.current,
        new_password: formData.value.new,
      }
      const dialog = $q.dialog({
        title: 'Password update',
        message: 'Updating password',
        progress: true,
        persistent: true,
        ok: false,
      })

      clearFormErrors()
      formData.value.loading = true
      backend.post(`users/update_password/`, data)
        .then(() => {
          dialog.update({ message: 'Password updated successfully!' })
          clearFormData()
        })
        .catch(error => {
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.current = errorParser.firstElementOrValue(data?.current_password)
          formErrors.value.new = errorParser.firstElementOrValue(data?.new_password)

          if (Array.isArray(data)) formErrors.value.detail = data
          if (data?.detail) formErrors.value.detail = [data?.detail]
          if (!formErrors.value.detail?.length) {
            formErrors.value.detail = ['Encountered error in updating password']
          }
          dialog.hide()
        })
        .finally(() => {
          dialog.update({ persistent: false, progress: false, ok: true })
          formData.value.loading = false
        })
    }

    return {
      marketplaceStore,
      profileEditMode,
      formData,
      form,
      formErrors,
      changePassword,
    }
  },
})
</script>
