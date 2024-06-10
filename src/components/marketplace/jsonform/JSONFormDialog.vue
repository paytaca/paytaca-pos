<template>
  <q-dialog 
    ref="dialogRef"
    position="bottom"
    full-width
    v-model="innerVal"
    @hide="onDialogHide"
  >
    <q-card class="q-pa-md">
      <div class="row items-center">
        <div class="text-h5">{{ title }}</div>
        <q-space/>
        <q-btn
          flat
          icon="close"
          padding="sm"
          v-close-popup
        />
      </div>
      <q-tabs v-model="tabs.active">
        <q-tab v-for="tab in tabs.opts" :key="tab" v-bind="tab" no-caps/>
      </q-tabs>
      <q-tab-panels v-model="tabs.active" keep-alive animated>
        <q-tab-panel name="conf" class="q-pa-none">
          <div v-if="!formSchemaData?.length" class="text-grey text-center text-subtitle1 q-py-lg">
            {{ $t('NoFields') }}
          </div>
          <TransitionGroup name="slide">
            <div v-for="(fieldData, index) in formSchemaData" :key="fieldData?._index">
              <div class="row items-center q-my-sm">
                <!--TODO:-->
                <div class="text-subtitle1">Field {{ index+1 }}</div>
                <div v-if="fieldTypeLabelMap[fieldData?.options?.type]" class="text-grey q-ml-xs">
                  ({{ fieldTypeLabelMap[fieldData?.options?.type] }})
                </div>
                <q-space/>
                <q-btn-group flat>
                  <q-btn icon="north" padding="sm md" flat @click="() => moveFieldDataIndex({ fieldData, delta: -1 })"/>
                  <q-btn icon="south" padding="sm md" flat @click="() => moveFieldDataIndex({ fieldData, delta:  1 })"/>
                  <q-btn
                    icon="delete" padding="sm" color="red" flat
                    @click="() => {
                      formSchemaData = formSchemaData.filter(_ => _ !== fieldData)
                    }"
                  />
                </q-btn-group>
              </div>
              <div>
                <div class="q-mb-xs">{{ $t('Name') }}</div>
                <q-input
                  dense outlined
                  class="q-space"
                  v-model="fieldData.name"
                  :rules="[
                    val => Boolean(val) || $t('Required'),
                  ]"
                  bottom-slots
                >
                  <template v-slot:append>
                    <q-btn
                      flat
                      padding="sm"
                      icon="settings"
                      @click="() => {
                        fieldOptsForm.data = fieldData
                        fieldOptsForm.show = true
                      }"
                    />
                  </template>
                </q-input>
                <div class="row items-center q-mb-xs">
                  <div>{{ $t('Options') }}</div>
                  <q-space/>
                  <q-toggle
                    dense
                    size="md"
                    :model-value="Array.isArray(fieldData?.options?.enum)"
                    @update:model-value="val => {
                      fieldData.options.enum = val ? [] : undefined
                    }"
                  />
                </div>
                <OptionsField
                  v-model="fieldData.options.enum"
                  :fieldProps="{
                    dense: true,
                    outlined: true,
                    bottomSlots: true,
                    readonly: !Array.isArray(fieldData.options.enum),
                  }"
                />
              </div>
              <q-separator/>
            </div>
          </TransitionGroup>
          <q-btn
            no-caps
            color="brandblue"
            :label="$t('AddField')"
            class="full-width"
            @click="() => addField({ options: { type: 'string' }})"
          />
        </q-tab-panel>
        <q-tab-panel name="form" class="q-px-none q-py-sm">
          <JSONFormPreview :schemaData="formSchemaData"/>
        </q-tab-panel>
      </q-tab-panels>
      <slot name="bottom" v-bind="{ tabs, formSchemaData }">
        <div class="row items-center justify-end q-my-md">
          <q-btn
            :label="$t('OK')"
            color="brandblue"
            class="full-width"
            @click="() => onDialogOK(formSchemaData)"
          />
        </div>
      </slot>
    </q-card>
    <q-dialog v-model="fieldOptsForm.show" position="bottom">
      <q-card>
        <q-card-section>
          <div class="row items-center q-mb-md">
            <div class="text-h6">{{ $t('FieldSettings') }}</div>
            <q-space/>
            <q-btn flat padding="sm" icon="close" class="q-r-mr-sm" v-close-popup/>
          </div>
          <div v-if="fieldOptsForm?.data" class="row items-center">
            <div class="col-4 q-space">{{ $t('Required') }}</div>
            <q-toggle v-model="fieldOptsForm.data.required"/>
          </div>
          <div v-if="fieldOptsForm?.data?.options" class="row items-center">
            <div class="col-4 q-space">{{ $t('FieldType') }}</div>
            <q-select
              dense
              borderless
              v-model="fieldOptsForm.data.options.type"
              map-options
              emit-value
              :options="[
                { label: $t('Text'), value: 'string' },
                { label: $t('Number'), value: 'number' },
                { label: $t('Checkbox'), value: 'boolean' },
              ]"
              @update:model-value="() => cleanSchemaFieldOpts(fieldOptsForm.data.options)"
            />
          </div>
        </q-card-section>
      </q-card>
    </q-dialog>
  </q-dialog>
</template>
<script>
import '@jsonforms/vue-vanilla/vanilla.css';
import { createUnserializedSchemaField, schemaToUISchema, serializeSchemaFields } from 'src/marketplace/formschema.js'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, ref, watch } from 'vue'
import JSONFormPreview from './JSONFormPreview.vue';
import OptionsField from './OptionsField.vue';
import { useI18n } from 'vue-i18n'
import { defaultStyles, mergeStyles, vanillaRenderers } from '@jsonforms/vue-vanilla'

const { t } = useI18n()

export default defineComponent({
  name: 'JSONFormDialog',
  components: {
    JSONFormPreview,
    OptionsField,
  },
  emits: [
    'update:modelValue',
    'update:schemaData',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    title: { type: String, required: false, default: t('JSONForm') },
    schemaData: {
      type: Array,
      required: false,
      default: () => {
        return [
          { name: t('Property1'), options: { type: 'string', enum: ['Option1', 'Option2', 'Option3'] } },
          { name: t('Property2'), options: { type: 'string' } },
        ]
      }
    },
  },
  setup(props, { emit: $emit }) {
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props?.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const tabs = ref({
      active: 'conf',
      opts: [
        { label: t('Fields'), name: 'conf' },
        { label: t('FormPreview2'), name: 'form' },
      ],
    })

    const fieldTypeLabelMap = {
      string: t('Text'),
      number: t('Number'),
      boolean: t('Checkbox'),
    }

    const formSchemaData = ref((Array.isArray(props.schemaData) ? props.schemaData : []).map(createUnserializedSchemaField))
    watch(formSchemaData, () => $emit('update:schemaData', formSchemaData.value), { deep: true })

    function addField(fieldData) {
      if (!fieldData) fieldData = {}
      if (!fieldData?.name) fieldData.name = `Field #${formSchemaData.value?.length+1}`
      formSchemaData.value.push(
        createUnserializedSchemaField(fieldData)
      )
    }
  
    function moveFieldDataIndex(opts={ fieldData, delta }) {
      const index = formSchemaData.value.indexOf(opts?.fieldData)
      if (index < 0) return

      let newIndex = index + opts?.delta
      if (Number.isNaN(newIndex)) return
      newIndex = Math.min(newIndex, formSchemaData.value?.length-1)
      newIndex = Math.max(newIndex, 0)
      if (newIndex == index) return

      formSchemaData.value.splice(index, 1)
      formSchemaData.value.splice(newIndex, 0, opts?.fieldData);
    }

    function cleanSchemaFieldOpts(fieldOpts) {
      if (!fieldOpts) return fieldOpts
      if (fieldOpts?.type === 'object') {
        delete fieldOpts.enum
        fieldOpts.properties = []
      } else {
        delete fieldOpts.properties
      }
      return fieldOpts
    }

    const fieldOptsForm = ref({ show: false, data: createUnserializedSchemaField() })

    /**
     * @param {String} val
     * @param {String[]} list
     */
    function onInputValue(val, list) {
      if (!val.includes(',')) return

      const tokenized = val.split(',')
        .filter(Boolean)
        .filter((element, index, array) => array.indexOf(element) === index)

      tokenized.forEach(token => {
        if (list.includes(token)) return
        list.push(token)
      })
      val = ''
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      tabs,

      fieldTypeLabelMap,
      formSchemaData,
      addField,
      moveFieldDataIndex,
      cleanSchemaFieldOpts,

      fieldOptsForm,
      onInputValue,
    }
  },
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
