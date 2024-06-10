<template>
  <q-dialog ref="dialogRef" persistent @hide="onDialogHide" position="bottom" full-height>
    <q-card class="rounded-borders dialog-content-base" style="height:85vh !important;">
      <div class="row items-center no-wrap dialog-content-header">
        <div class="text-h6">{{ title }}</div>
        <q-space/>
        <q-btn
          flat
          icon="close"
          padding="sm"
          v-close-popup
        />
      </div>
      <q-card-section class="q-pt-none q-r-mt-md">
        <q-tab-panels
          animated
          keep-alive-include="list"
          :model-value="addonFormData ? 'addon' : 'list'"
        >
          <q-tab-panel name="list" class="q-pa-sm">
            <div class="row items-center">
              <q-btn
                v-if="clearable && formData?.length > 0"
                :outline="$q.dark.isActive"
                :flat="!$q.dark.isActive"
                no-caps
                :label="$t('Clear')"
                color="grey"
                padding="none md"
                @click="() => clearForm({ submit: true, prompt: promptClear })"
              />
              <q-space/>
              <q-btn
                flat
                icon="add"
                @click="() => addAddon({ setEdit: true })"
              />
            </div>
            <q-banner v-if="formError" class="bg-red text-white rounded-borders">
              {{ formError }}
            </q-banner>
      
            <div v-if="!formData.length" class="text-center text-grey text-subtitle1">
              {{ $t('NoAddons') }}
            </div>
            <q-list separator>
              <TransitionGroup name="slide">
                <q-item class="q-px-xs" v-for="(addon, index) in formData" :key="addon.__index">
                  <q-item-section side class="q-pr-xs">
                    <q-btn
                        flat
                        :disable="index <= 0"
                        icon="north"
                        padding="xs sm"
                        size="sm"
                        @click="() => moveAddonIndex({ addon, delta: -1 })"
                      />
                      <q-btn
                        flat
                        :disable="index >= formData.length-1"
                        icon="south"
                        padding="xs sm"
                        size="sm"
                        @click="() => moveAddonIndex({ addon, delta:  1 })"
                      />
                  </q-item-section>
                  <q-item-section>
                    <q-item-label caption class="text-grey">#{{ index+1 }}</q-item-label>
                    <q-item-label>
                      {{ addon?.label }}
                      <q-icon v-if="!addon.hasOptions && addon?.hasInputRequired" name="keyboard" size="1.2em">
                        <q-menu class="q-pa-sm">
                          {{ $t('AddonOptionsEnabled') }}
                        </q-menu>
                      </q-icon>
                    </q-item-label>
                    <q-item-label caption>
                      {{ $t('SelectionsRequired') }}:
                      {{ addon?.minOpts }}
                      <template v-if="addon?.minOpts !== addon?.maxOpts">
                        - {{ addon?.maxOpts }}
                      </template>
                    </q-item-label>
                    <q-item-label caption>
                      {{ addon?.priceRange?.minPrice }}
                      <template v-if="addon?.priceRange?.minPrice !== addon?.priceRange?.maxPrice">
                        - {{ addon?.priceRange?.maxPrice }}
                      </template>
                      {{  marketplaceStore?.currency }}
                    </q-item-label>
                    <q-item-label v-if="addon.hasOptions" caption>
                      {{ addon?.options?.map?.(opt => opt?.label)?.filter?.(Boolean)?.join(', ') }}
                      <q-icon v-if="addon?.hasInputRequired" name="keyboard" size="1.2em">
                        <q-menu class="q-pa-sm">
                          {{ $t('AddonOptionsEnabled') }}
                        </q-menu>
                      </q-icon>
                    </q-item-label>
                  </q-item-section>
                  <q-item-section avatar top>
                    <div class="row items-center">
                      <q-btn
                        flat
                        icon="edit"
                        padding="xs sm"
                        @click="() => toggleEditAddon(addon)"
                      />
                      <q-btn
                        flat
                        icon="delete"
                        padding="xs sm"
                        @click="() => removeAddonConfirm(addon)"
                      />
                    </div>
                  </q-item-section>
                </q-item>
              </TransitionGroup>
            </q-list>
            <div class="q-pt-md">
              <q-btn
                no-caps
                :label="$t('Save')"
                color="brandblue"
                class="full-width q-mt-sm"
                @click="() => submit()"
              />
            </div>
          </q-tab-panel>
          <q-tab-panel name="addon" class="q-pa-sm">
            <q-form @submit="() => onAddonFormSubmit()">
              <q-input
                dense
                :label="$t('Name')"
                v-model="addonFormData.label"
                counter
                maxlength="30"
                :rules="[
                  val => Boolean(val) || $t('Required'),
                ]"
              />
              <q-slide-transition>
                <div
                  v-if="addonFormData?.options?.length !== 1"
                  class="row items-center no-wrap q-r-mx-sm"
                >
                  <div class="q-pa-xs">
                    <q-input
                      dense
                      :label="$t('MinimumSelect')"
                      type="number"
                      v-model.number="addonFormData.minOpts"
                      reactive-rules
                      :rules="[
                        val => (val >= 0 && val <= addonFormData?.options?.length) || $t('Invalid'),
                        val => val <= addonFormData?.maxOpts || $t('MustBeLessThanMax'),
                      ]"
                    />
                  </div>
  
                  <div class="q-pa-xs">
                    <q-input
                      dense
                      :label="$t('MaximumSelect')"
                      type="number"
                      v-model.number="addonFormData.maxOpts"
                      reactive-rules
                      :rules="[
                        val => (val >= 0 && val <= addonFormData?.options?.length) || $t('Invalid'),
                      ]"
                    />
                  </div>
                </div>
              </q-slide-transition>
              <div class="row items-center justify-end q-mt-sm">
                <div v-if="addonFormData?.options?.length !== 1" class="text-subtitle1 q-space">
                  {{ $t('Choices') }}
                </div>
                <q-btn
                  flat
                  padding="xs"
                  icon-right="add"
                  no-caps
                  :label="addonFormData?.options?.length !== 1 ? '' : $t('AddChoices')"
                  @click="() => addOptionToAddon()"
                />
              </div>
              <TransitionGroup name="slide">
                <div
                  v-for="(option, index) in addonFormData?.options" :key="index"
                  :class="addonFormData?.options?.length !== 1 ? 'option-card--multiple q-r-mx-sm' : ''"
                  class="q-mb-sm q-pb-sm option-card"
                >
                  <div v-if="addonFormData?.options?.length !== 1" class="row items-center">
                    <div class="text-grey q-space">#{{ index + 1 }}</div>
                    <q-btn
                      flat icon="delete_outline"
                      padding="none xs"
                      color="red"
                      @click="() => addonFormData.options = addonFormData.options.filter(opt => opt !== option)"
                    />
                  </div>
                  <div class="row items-start q-r-mx-sm no-wrap">
                    <div v-if="addonFormData?.options?.length !== 1" class="col-8 q-pa-xs">
                      <q-input
                        dense
                        :label="$t('Label')"
                        v-model="option.label"
                        counter
                        maxlength="30"
                        reactive-rules
                        :rules="[
                          val => Boolean(val) || $t('Required'),
                          val => !addonFormData.options.find((opt, idx) => opt?.label === val && idx !== index) || $t('DuplicateValues')
                        ]"
                      />
                    </div>
                    <div class="q-space q-pa-xs">
                      <q-input
                        dense
                        :label="$t('Price')"
                        :suffix="marketplaceStore?.currency"
                        v-model.number="option.price"
                        :rules="[
                          val => val >= 0 || $t('Invalid'),
                        ]"
                      />
                    </div>
                  </div>
                  <div>
                    <q-checkbox flat dense v-model="option.requireInput">
                      {{ $t('IncludeTextbox') }}
                      <q-icon name="keyboard" color="grey"/>
                    </q-checkbox>
                    <q-icon name="help" size="1.25em" class="q-ml-sm">
                      <q-menu class="q-pa-sm">
                        {{ $t('IncludeTextboxDescription') }}
                      </q-menu>
                    </q-icon>
                  </div>
                </div>
              </TransitionGroup>
              <div class="q-mt-md q-gutter-x-sm">
                <q-btn
                  no-caps
                  :label="addonFormDataExists ? $t('Update') : $t('Add')"
                  color="brandblue"
                  class="full-width q-mt-md"
                  type="submit"
                />
                <q-btn
                  outline
                  no-caps:
                  :label="$t('Cancel')"
                  color="grey"
                  class="full-width q-mt-md"
                  @click="() => addonFormData = null"
                />
              </div>
            </q-form>
          </q-tab-panel>
        </q-tab-panels>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { parseProductAddon } from 'src/marketplace/product-addons.js'
import { useDialogPluginComponent, useQuasar } from 'quasar'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { computed, defineComponent, onMounted, ref, watch, watchEffect } from 'vue'
import { useI18n } from 'vue-i18n'

export default defineComponent({
  name: 'AddonsFormDialog',
  emits: [
    'update:modelValue',
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    title: { type: String, default: t('AddonsForm') },
    initialValue: Array,
    clearable: Boolean,
    promptClear: Boolean,
  },
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const { t } = useI18n()
    const { dialogRef, onDialogCancel, onDialogHide, onDialogOK } = useDialogPluginComponent()
    const innerVal = ref(props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)

    const marketplaceStore = useMarketplaceStore()

    onMounted(() => syncFormData())

    let addonFormDataCtr = 0
    function _createEmptyAddon(initialValue) {
      const data = parseProductAddon(initialValue)
      data.__index = ++addonFormDataCtr
      // data.label = `Group ${addonFormDataCtr}`
      // data.options.forEach((opt, index) => {
      //   opt.label = `Option ${addonFormDataCtr}${index+1}`
      // })
      return data
    }

    function syncFormData() {
      if (!Array.isArray(props.initialValue)) return
      formData.value = props.initialValue.map(_createEmptyAddon)
    }

    const formError = ref('')
    const formData = ref([].map(() => _createEmptyAddon()))
    watchEffect(() => {
      formData.value.forEach(addon => {
        const prices = addon.options.map(opt => opt?.price)
        const minPrice = Math.min(...prices)
        const maxPrice = Math.max(...prices)

        addon.hasOptions = addon.options.length > 1
        addon.hasInputRequired = Boolean(addon.options.find(opt => opt?.requireInput))
        addon.priceRange = { minPrice, maxPrice }
      })
    })
    function addAddon(opts = { setEdit: false }) {
      const addon = _createEmptyAddon()
      if (opts?.setEdit) toggleEditAddon(addon);
      else formData.value.push(addon)
    }
    function removeAddonConfirm(addon) {
      if (!formData.value?.includes?.(addon)) return 
      $q.dialog({
        title: t('RemoveAddon'),
        message: `Remove addon '${addon?.label}'. Are you sure?`, // TODO:
        color: 'brandblue',
        ok: true,
        cancel: true,
      }).onOk(() => removeAddon(addon))
    }

    function removeAddon(addon) {
      formData.value = formData.value.filter(_addon => addon !== _addon)
      addonFormData.value = null
    }
    function moveAddonIndex(opts={ addon, delta }) {
      const index = formData.value.indexOf(opts?.addon)
      if (index < 0) return

      let newIndex = index + opts?.delta
      if (Number.isNaN(newIndex)) return
      newIndex = Math.min(newIndex, formData.value?.length-1)
      newIndex = Math.max(newIndex, 0)
      if (newIndex == index) return

      formData.value.splice(index, 1)
      formData.value.splice(newIndex, 0, opts?.addon);
    }

    function clearForm(opts={ submit: false, prompt: false }) {
      if (opts?.prompt) return clearFormPrompt({ submit: opts?.submit })

      formData.value = []
      if (opts?.submit) submit()
    }

    function clearFormPrompt(opts={ submit: false }) {
      $q.dialog({
        title: t('ClearList'),
        message: t('AreYouSure'),
        color: 'brandblue',
        ok: true,
        cancel: true,
      }).onOk(() => clearForm({ submit: opts?.submit, prompt: false }))
    }

    const addonFormData = ref([].map(_createEmptyAddon)[0])
    watch(() => addonFormData.value?.options?.length, () => {
      const length = addonFormData.value?.options?.length 
      if (!Number.isSafeInteger(length)) return
      if (length !== 1) return

      addonFormData.value.minOpts = 0
      addonFormData.value.maxOpts = 1
    })
    const addonFormDataExists = computed(() => {
      return Boolean(
        formData.value.find(addon => addon?.__index === addonFormData?.value?.__index)
      )
    })
    function toggleEditAddon(addon) {
      if (addonFormData.value?.__index == addon?.__index) {
        addonFormData.value = null
        return
      }
      addonFormData.value = JSON.parse(JSON.stringify(addon))
      if (!Array.isArray(addonFormData.value.options) || addonFormData.value.options?.length < 1) {
        addonFormData.value.options = [
          { label: '', price: 0, requireInput: false },
        ]
      }
    }
    function addOptionToAddon() {
      if (!addonFormData.value) return
      if (!Array.isArray(addonFormData.value.options)) addonFormData.value.options = []
      addonFormData.value.options.push({ label: '', price: 0, requireInput: false })
    }

    function onAddonFormSubmit() {
      const index = formData.value.findIndex(addon => addonFormData.value.__index === addon.__index)
      if (index >= 0) formData.value[index] = addonFormData.value
      else formData.value.push(addonFormData.value)

      addonFormData.value = null
    }

    const formValidation = ref({
      duplicates: [],
    })
    watchEffect(() => {
      formValidation.value.duplicates = getDuplicateLabelIndices()
    })
    function getDuplicateLabelIndices() {
      const _map = {}
      const duplicates = []
      formData.value.forEach((addon, index) => {
        if (!Array.isArray(_map[addon.label])) _map[addon.label] = []
        _map[addon.label].push(index)
        if (_map[addon.label]?.length > 1) duplicates.push(_map[addon.label])
      })
      return duplicates
    }

    function submit() {
      const data = formData.value.map(parseProductAddon)
      if (formValidation.value.duplicates.length > 0) {
        formError.value = t('DuplicateNamesFound')
        return
      }
      onDialogOK(data)
    }

    return {
      dialogRef, onDialogCancel, onDialogHide, onDialogOK,
      innerVal,

      marketplaceStore,

      formError,
      formData,
      addAddon,
      removeAddonConfirm,
      removeAddon,
      moveAddonIndex,

      clearForm,
      clearFormPrompt,

      addonFormData,
      addonFormDataExists,
      toggleEditAddon,
      addOptionToAddon,
      onAddonFormSubmit,

      submit,
    }
  }
})
</script>
<style scoped>
/* 1. declare transition */
.slide-move,
.slide-enter-active,
.slide-leave-active {
  transition: all 0.5s cubic-bezier(0.55, 0, 0.1, 1);
}

/* 2. declare enter from and leave to state */
.slide-enter-from,
.slide-leave-to {
  opacity: 0;
  transform: translate(30px, 0);
}

/* 3. ensure leaving items are taken out of layout flow so that moving
      animations can be calculated correctly. */
/* .slide-leave-active {
  position: absolute;
} */

</style>
<style lang="scss" scoped>
.option-card {
  transition: padding 0.1s ease-out, margin 0.1 ease-out;
}
.option-card--multiple {
  border-radius: map-get($space-xs, 'y');
  padding: map-get($space-xs, 'y') map-get($space-sm, 'x') map-get($space-sm, 'y') map-get($space-sm, 'x');
  box-shadow: rgba(0, 0, 0, 0.24) 0px 3px 8px;
}

body.body--dark .option-card--multiple {
  box-shadow: unset;
  border: 1px solid white;
}

.dialog-content-base {
  overflow: auto;
  background-color: white;
}

.dialog-content-base .dialog-content-header {
  position: sticky;
  top: 0;
  width: 100%;
  z-index: 100;
  background-color: inherit;
  padding: map-get($space-md, 'y') map-get($space-md, 'x');
}

body.body--dark .dialog-content-base {
  background-color: $dark;
}

</style>
