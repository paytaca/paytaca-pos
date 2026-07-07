<template>
  <q-card class="q-mb-md">
    <q-card-section>
      <div class="text-weight-medium q-mb-sm">{{ program?.name }}</div>
      <div v-if="program?.description" class="text-caption text-grey q-mb-md">
        {{ program?.description }}
      </div>

      <div class="q-gutter-y-md" :class="{ 'readonly-form': readonly }">
        <div>
          <div class="q-mb-xs">{{ $t("IdPhoto", {}, "ID Photo") }}</div>
          <PhotoSelector v-model="innerVal.idPhoto">
            <template v-slot="{ innerVal: photo, selectPhoto }">
              <div class="column q-gutter-y-sm">
                <div
                  v-if="photo"
                  class="relative-position rounded-borders overflow-hidden shadow-2 photo-container"
                  style="width: fit-content"
                >
                  <img
                    :src="photo.objectUrl || photo"
                    style="max-width: 280px; max-height: 200px; display: block"
                    class="rounded-borders"
                  />
                  <template v-if="!readonly">
                    <q-btn
                      round
                      color="red"
                      icon="close"
                      size="md"
                      class="absolute-top-right q-ma-sm"
                      @click="innerVal.idPhoto = null"
                    />
                    <q-btn
                      round
                      color="brandblue"
                      icon="sync"
                      size="md"
                      class="absolute-bottom-right q-ma-sm"
                      @click="selectPhoto"
                    />
                  </template>
                </div>
                <div
                  v-else-if="!readonly"
                  v-ripple
                  class="column items-center justify-center rounded-borders q-pa-lg cursor-pointer photo-container"
                  style="
                    border: 2px dashed #ccc;
                    width: 280px;
                    height: 160px;
                    position: relative;
                  "
                  @click="selectPhoto"
                >
                  <q-icon name="photo_camera" size="3em" color="grey-5" />
                  <div class="text-grey-6 text-caption q-mt-sm">
                    {{ $t("NoPhotoSelected", {}, "No photo selected") }}
                  </div>
                </div>
                <div
                  v-else
                  class="column items-center justify-center rounded-borders q-pa-lg photo-container"
                  style="border: 2px dashed #ccc; width: 280px; height: 160px"
                >
                  <q-icon name="photo_camera" size="3em" color="grey-5" />
                  <div class="text-grey-6 text-caption q-mt-sm">
                    {{ $t("NoPhotoSelected", {}, "No photo selected") }}
                  </div>
                </div>
              </div>
            </template>
          </PhotoSelector>
        </div>

        <q-input
          dense
          outlined
          :label="$t('IdNumber', {}, 'ID Number')"
          v-model="innerVal.idNumber"
          :disable="loading || readonly"
          :readonly="readonly"
        />

        <q-input
          dense
          outlined
          :label="$t('NameOnId', {}, 'Name on ID')"
          v-model="innerVal.nameOnId"
          :disable="loading || readonly"
          :readonly="readonly"
        />
      </div>
    </q-card-section>
    <q-card-actions align="right" class="q-px-md q-pb-md">
      <q-btn
        flat
        no-caps
        :disable="loading"
        :label="
          readonly ? $t('Close', {}, 'Close') : $t('Cancel', {}, 'Cancel')
        "
        color="grey"
        v-close-popup
        @click="$emit('cancel')"
      />
      <q-btn
        v-if="!readonly"
        outline
        no-caps
        :disable="loading || !isValid"
        :loading="loading"
        :label="$t('Apply', {}, 'Apply')"
        color="brandblue"
        @click="submit"
      />
    </q-card-actions>
  </q-card>
</template>

<script>
import { computed, defineComponent, ref, watch } from "vue";
import PhotoSelector from "src/components/marketplace/PhotoSelector.vue";

export default defineComponent({
  name: "BenefitProgramApplicationForm",
  components: {
    PhotoSelector,
  },
  emits: ["update:modelValue", "submit", "cancel"],
  props: {
    program: Object,
    modelValue: {
      type: Object,
      default: () => ({
        idPhoto: null,
        idNumber: "",
        nameOnId: "",
      }),
    },
    loading: Boolean,
    readonly: Boolean,
  },
  setup(props, { emit }) {
    const innerVal = ref({
      idPhoto: null,
      idNumber: "",
      nameOnId: "",
    });

    watch(
      () => props.modelValue,
      () => {
        innerVal.value = { ...props.modelValue };
      },
      { immediate: true, deep: true }
    );

    watch(
      innerVal,
      () => {
        emit("update:modelValue", { ...innerVal.value });
      },
      { deep: true }
    );

    const isValid = computed(() => {
      if (props.readonly) return false;
      return (
        innerVal.value.idPhoto &&
        innerVal.value.idNumber?.trim() &&
        innerVal.value.nameOnId?.trim()
      );
    });

    function submit() {
      if (props.readonly || !isValid.value) return;
      emit("submit", { ...innerVal.value });
    }

    return {
      innerVal,
      isValid,
      submit,
    };
  },
});
</script>

<style scoped>
.readonly-form {
  pointer-events: none;
  opacity: 0.85;
}

.photo-container {
  align-self: flex-start;
}

@media (max-width: 500px) {
  .photo-container {
    align-self: center;
  }
}
</style>
