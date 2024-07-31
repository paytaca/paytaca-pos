<template>
  <div class="row">
    <slot v-bind="{ value: innerValue, pickFile, toggleOptionsDialog, uploading }">
      <div v-if="innerValue" @click="toggleOptionsDialog" style="position: relative;">
        <q-inner-loading :showing="loading">
          <q-spinner size="2.5em"/>
        </q-inner-loading>
        <img
          :src="innerValue"
          class="rounded-borders"
          style="max-width: min(200px, 25vw);"
        />
        <q-inner-loading :showing="uploading"/>
      </div>
      <q-btn
        v-else
        flat
        no-caps
        :disable="uploading || disable"
        :loading="uploading || loading"
        padding="xs sm"
        :label="$t('SelectImage', {}, 'Select Image')"
        @click="pickFile"
      />
    </slot>

    <q-uploader
      ref="productImageUploader"
      v-show="false"
      auto-upload
      :url="uploadUrl"
      accept="image/*"
      field-name="image"
      class="full-width"
      @start="() => uploading = true"
      @finish="() => uploading = false"
      @uploaded="productImageUploaded"
      :headers="getUploadCredentials"
    />
    <q-dialog v-model="displayOptionsDialog" position="bottom">
      <q-card>
        <q-item clickable @click="pickFile" v-close-popup>
          <q-item-section>
            <q-item-label>{{ $t('SelectAnotherImage') }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable @click="() => innerValue = null" v-close-popup>
          <q-item-section>
            <q-item-label>{{ $t('RemoveImage') }}</q-item-label>
          </q-item-section>
        </q-item>
      </q-card>
    </q-dialog>
  </div>
</template>
<script>
import { backend, getAuthToken } from 'src/marketplace/backend'
import { defineComponent, onMounted, ref, watch } from 'vue'

export default defineComponent({
  emits: [
    'update:modelValue',
  ],
  props: {
    modelValue: String,
    disable: Boolean,
    loading: Boolean,
  },
  setup(props, { emit: $emit }) {
    const uploading = ref(false)
    const innerValue = ref(props.modelValue)
    watch(innerValue, () => $emit('update:modelValue', innerValue.value))
    watch(() => props.modelValue, () => innerValue.value = props.modelValue)

    const uploadUrl = ref('')
    onMounted(() => updateUploadUrl())
    function updateUploadUrl() {
      const url = new URL(backend.defaults.baseURL)
      url.pathname = 'api/images/upload/'
      uploadUrl.value = String(url)
    }

    const displayOptionsDialog = ref(false)
    function toggleOptionsDialog() {
      if (props.disable) return displayOptionsDialog.value = false
      displayOptionsDialog.value = !displayOptionsDialog.value
    }

    const productImageUploader = ref(null)
    function pickFile(evt) {
      productImageUploader.value.reset()
      productImageUploader.value.pickFiles(evt)
    }

    function productImageUploaded({ xhr }) {
      const responseData = JSON.parse(xhr.responseText)
      innerValue.value = responseData.url
    }

    const authToken = ref(null)
    onMounted(() => updateAuthToken())
    async function updateAuthToken() {
      const { value: token } = await getAuthToken()
      authToken.value = token
    }

    function getUploadCredentials() {
      if (!authToken.value) return []
      return [{ name: 'Authorization', value: `Bearer ${authToken.value}` }]
    }

    return {
      uploading,
      innerValue,
      uploadUrl,
      displayOptionsDialog,
      toggleOptionsDialog,
      productImageUploader,
      pickFile,
      productImageUploaded,
      getUploadCredentials,
    }
  },
})
</script>
