<template>
  <q-page class="q-pa-md">
    <MarketplaceHeader>
      <template v-slot:title>
        <q-btn flat icon="arrow_back" @click="$router.go(-1)"/>
        <div class="q-space">
          <div class="text-h5">{{ $t('User') }}</div>
          <div class="text-grey">{{ $t('Marketplace') }}</div>
        </div>
      </template>
    </MarketplaceHeader>
    <q-card class="q-mb-md">
      <q-card-section class="q-pb-none row items-center">
        <div class="text-h6">{{ $t('Profile') }}</div>
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
            no-caps
            :label="$t('Cancel')"
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
            <div class="text-caption bottom">{{ $t('FirstName') }}</div>
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.lastName }}</div>
            <div class="text-caption bottom">{{ $t('LastName') }}</div>
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.email }}</div>
            <div class="text-caption bottom">{{ $t('Email') }}</div>
          </div>
  
          <div class="col-6 q-py-xs q-px-sm">
            <div>{{ marketplaceStore?.user?.username }}</div>
            <div class="text-caption bottom">{{ $t('Username') }}</div>
          </div>
          <div class="col-6 q-py-xs q-px-sm">
            <div v-if="marketplaceStore?.user?.phoneNumber">{{ marketplaceStore?.user?.phoneNumber }}</div>
            <i v-else class="text-grey">{{ $t('None') }}</i>
            <div class="text-caption bottom">{{ $t('PhoneNumber') }}</div>
          </div>
        </q-card-section>
      </q-slide-transition>
    </q-card>
    <q-card class="q-mb-md">
      <q-card-section>
        <div class="text-subtitle1">{{ $t('ChangePassword') }}</div>
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
            :label="$t('CurrentPassword')"
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
            :label="$t('NewPassword')"
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
            :label="$t('ConfirmNewPassword')"
            type="password"
            v-model="formData.newConfirm"
            autocomplete="on"
            reactive-rules
            :rules="[
              val => val === formData.new || $t('PasswordDoesntMatch'),
            ]"
          />
          <div class="q-mt-sm">
            <q-btn
              :disable="formData.loading"
              :loading="formData.loading"
              color="brandblue"
              no-caps
              :label="$t('UpdatePassword')"
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
import { useI18n } from 'vue-i18n'
import { useRouter } from 'vue-router'
import { defineComponent, ref, watch } from 'vue'
import MarketplaceHeader from 'src/components/marketplace/MarketplaceHeader.vue'
import UserProfileForm from 'src/components/marketplace/UserProfileForm.vue'

export default defineComponent({
  name: 'UserPage',
  components: {
    MarketplaceHeader,
    UserProfileForm,
  },
  props: {
    edit: String,
  },
  setup(props) {
    const { t } = useI18n()
    const $router = useRouter()
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()

    const profileEditMode = ref(false)
    watch(profileEditMode, () => {
      const query = {
        edit: profileEditMode.value ? 'true' : undefined,
      }
      $router.replace({ query })
    })
    watch(() => props?.edit, () => {
      profileEditMode.value = props.edit?.toLowerCase()?.trim?.() === 'true'
    })

    const form = ref()
    const formData = ref({
      loading: false,
      current: '',
      new: '',
      newConfirm: '',
    })

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
        title: t('PasswordUpdate'),
        message: t('Updating password'),
        progress: true,
        persistent: true,
        ok: false,
      })

      clearFormErrors()
      formData.value.loading = true
      backend.post(`users/update_password/`, data)
        .then(() => {
          dialog.update({ message: t('PasswordUpdateSuccessfully') })
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
            formErrors.value.detail = [t('FormErrorPasswordMsg')]
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
