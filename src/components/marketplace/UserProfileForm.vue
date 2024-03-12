<template>
  <q-form ref="form" @submit="onSubmit">
    <div v-if="formData?.profilePicture" class="row items-center justify-center q-mb-sm">
      <img
        :src="formData.profilePicture?.objectUrl || formData?.profilePicture"
        style="max-height:200px;max-width:100%;object-fit: contain;"
      />
      <q-menu touch-position>
        <q-item clickable v-close-popup @click="() => formData.profilePicture = ''">
          <q-item-section>
            <q-item-label>Remove image</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable v-close-popup @click="selectProfilePicture">
          <q-item-section>
            <q-item-label>Replace image</q-item-label>
          </q-item-section>
        </q-item>
      </q-menu>
    </div>
    <q-btn
      v-else
      flat
      no-caps label="Select image"
      class="q-mb-sm"
      @click="selectProfilePicture"
    />
    <q-file
      v-if="(typeof formData.profilePicture !== 'string')"
      v-show="false"
      ref="fileAttachmentField"
      borderless
      v-model="formData.profilePicture"
      :filter="files => files.filter(file => file.type?.match(/image\/.*/))"
      @update="() => resizeProfilePicture()"
    />
    <q-input
      dense
      outlined
      :loading="loading"
      label="First name*"
      v-model="formData.firstName"
      bottom-slots
      :error="Boolean(formErrors?.firstName)"
      :error-message="formErrors?.firstName"
    />
    <q-input
      dense
      outlined
      :loading="loading"
      label="Last name*"
      v-model="formData.lastName"
      bottom-slots
      :error="Boolean(formErrors?.lastName)"
      :error-message="formErrors?.lastName"
      
    />
    <q-input
      dense
      outlined
      :loading="loading"
      label="Email*"
      v-model="formData.email"
      bottom-slots
      :error="Boolean(formErrors?.email)"
      :error-message="formErrors?.email"
    />
    <q-input
      dense
      outlined
      :loading="loading"
      label="Phone number"
      v-model="formData.phoneNumber"
      bottom-slots
      :error="Boolean(formErrors?.phoneNumber)"
      :error-message="formErrors?.phoneNumber"
    />

    <q-separator spaced/>
    <q-btn
      color="brandblue"
      no-caps label="Update"
      class="full-width"
      type="submit"
    />
  </q-form>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { base64ImageToFile, dataUrlToFile, resizeImage } from 'src/marketplace/chat/attachment'
import { errorParser } from 'src/marketplace/utils'
import { Camera } from '@capacitor/camera'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  name: 'UserProfileForm',
  emits: [
    'submit',
    'updated',
  ],
  props: {
    emitSubmit: Boolean,
    user: {
      default: () => {
        return [].map(() => useMarketplaceStore().user)[0]
      }
    }
  },
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore()

    onMounted(() => resetFormData())
    const loading = ref(false)
    const form = ref()

    const formData = ref({
      profilePicture: [].map(el => el ? String() : new File())[0],
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
    })
    watch(() => formData.value.profilePicture, (newVal, oldVal) => {
      if (oldVal instanceof File) URL.revokeObjectURL(oldVal)
      if (newVal instanceof File) newVal.objectUrl = URL.createObjectURL(newVal)
    })

    function resetFormData() {
      const user = props?.user
      formData.value = {
        profilePicture: user?.profilePictureUrl || '',
        firstName: user?.firstName || '',
        lastName: user?.lastName || '',
        email: user?.email || '',
        phoneNumber: user?.phoneNumber || '',
      }
      setTimeout(() => {
        form.value?.resetValidation?.()
      }, 100)
    }

    const emptyFormErrors = () => ({
      detail: [],
      profilePicture: '',
      firstName: '',
      lastName: '',
      email: '',
      phoneNumber: '',
    })

    const formErrors = ref(emptyFormErrors())
    function clearFormErrors() {
      formErrors.value = emptyFormErrors()
    }

    const fileAttachmentField = ref()
    function openFileAttachementField(evt) {
      fileAttachmentField.value?.pickFiles?.(evt)
    }

    async function resizeProfilePicture() {
      const isFile = formData.value.profilePicture instanceof File
      if (!isFile) return
      formData.value.profilePicture = await resizeImage({
        file: formData.value.profilePicture,
        maxWidthHeight: 640, // based on recommended dimensions for mobile
      })
    }

    async function checkOrRequestCameraPermissions() {
      let permission = await Camera.checkPermissions()
      const promptStatuses = ['prompt','prompt-with-rationale', 'limited']
      const request = promptStatuses.includes(permission.photos) || promptStatuses.includes(permission.camera)
      if (request) permission = await Camera.requestPermissions()
      return {
        camera: permission.camera === 'granted',
        photos: permission.photos === 'photos',
      }
    }

    async function getPhotoFromCamera() {
      const granted = await checkOrRequestCameraPermissions()
      if (!granted.camera && !granted.photos) {
        $q.dialog({
          title: 'Select photo', message: 'Permission denied',
          color: 'brandblue',
          class: `br-15 pt-card text-bow ${getDarkModeClass(darkMode.value)}`
        })
        return Promise.reject(new Error('Permission Denied'))
      }
      return Camera.getPhoto({
        presentationStyle: 'popover',
        resultType: 'dataUrl',
      })
        .then(async (photo) => {
          let file
          if (photo?.base64String) file = base64ImageToFile(photo?.base64String)
          else if (photo?.dataUrl) file = dataUrlToFile(photo?.dataUrl)
          if (!file) return photo
          const resized = await resizeImage({ file, maxWidthHeight: 640 })
          formData.value.profilePicture = resized
          return photo
        })
    }

    function selectProfilePicture() {
      return getPhotoFromCamera()
        .catch(error => {
          console.error(error)
          let errorMsg = error?.message
          if (typeof errorMsg !== 'string') return Promise.reject(error)
          if (errorMsg?.includes('cancel')) return Promise.resolve()
          if (errorMsg.match(/user.*denied.*access/i)) {
            openFileAttachementField(evt)
            return Promise.resolve()
          }
          if (errorMsg?.length < 250) return Promise.reject(error)
          $q.dialog({
            title: 'Select photo', message: errorMsg || 'Unknown error occurred',
            color: 'brandblue',
            class: `br-15 pt-card text-bow ${getDarkModeClass(darkMode.value)}`
          })
        })
    }

    async function defaultOnSubmit() {
      let data
      if (formData.value.profilePicture instanceof File) {
        data = new FormData()
        data.set('profile_picture', formData.value.profilePicture)
        data.set('first_name', formData.value.firstName)
        data.set('last_name', formData.value.lastName)
        data.set('email', formData.value.email)
        data.set('phone_number', formData.value.phoneNumber)
      } else {
        data = {
          profile_picture_url: (typeof formData.value.profilePicture === 'string')
            ? formData.value.profilePicture
            : undefined,
          first_name: formData.value.firstName,
          last_name: formData.value.lastName,
          email: formData.value.email,
          phone_number: formData.value.phoneNumber,
        }
        if (data.profile_picture_url === props?.user?.profilePictureUrl) {
          data.profile_picture_url = undefined
        }
        if (typeof data.profile_picture_url === 'string' && data?.profile_picture_url?.length <= 0) {
          data.profile_picture_url = undefined
          data.profile_picture = null
        }
      }

      loading.value = true
      return backend.patch(`users/${props?.user?.id}/`, data)
        .finally(() => clearFormErrors())
        .then(response => {
          if (marketplaceStore?.user?.id && response?.data?.id == marketplaceStore?.user?.id) {
            marketplaceStore.setUser(response?.data)
          }
          $emit('updated', response?.data)
          return response
        })
        .catch(error => {
          const data = error?.response?.data
          formErrors.value.detail = errorParser.toArray(data?.non_field_errors)
          formErrors.value.profilePicture = errorParser.firstElementOrValue(data?.profile_picture) || 
                                    errorParser.firstElementOrValue(data?.profile_picture_url)
          formErrors.value.firstName = errorParser.firstElementOrValue(data?.first_name)
          formErrors.value.lastName = errorParser.firstElementOrValue(data?.last_name)
          formErrors.value.email = errorParser.firstElementOrValue(data?.email)
          formErrors.value.phoneNumber = errorParser.firstElementOrValue(data?.phone_number)
        })
        .finally(() => {
          loading.value = false
        })
    }

    function onSubmit() {
      if (props.emitSubmit) return $emit('submit', Object.assign({}, formData.value))
      return defaultOnSubmit()
    }

    return {
      loading,
      form,
      formData,
      resetFormData,
      formErrors,
      resizeProfilePicture,
      selectProfilePicture,
      onSubmit,
    }
  },
})
</script>
