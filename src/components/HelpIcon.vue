<template>
  <span class="inline-block">
    <q-icon
      name="help"
      size="1.25em"
      color="grey"
      class="cursor-pointer"
      @click="useDialog && (dialogVisible = true)"
    >
      <q-menu v-if="!useDialog" class="q-pa-md" style="max-width: 260px">
        <slot />
      </q-menu>
    </q-icon>
    <q-dialog v-if="useDialog" v-model="dialogVisible">
      <q-card class="rounded-borders" style="width: 100%; max-width: 480px;">
        <div class="row items-center no-wrap q-px-md q-py-sm">
          <div class="text-h6 q-space">{{ title }}</div>
          <q-btn flat round icon="close" padding="sm" v-close-popup />
        </div>
        <q-separator />
        <q-card-section>
          <slot />
        </q-card-section>
      </q-card>
    </q-dialog>
  </span>
</template>

<script>
import { useQuasar } from "quasar";
import { defineComponent, ref, computed } from "vue";

export default defineComponent({
  name: "HelpIcon",
  props: {
    title: {
      type: String,
      default: "",
    },
  },
  setup() {
    const $q = useQuasar();
    // xs screens (< 600px) get a bottom-sheet dialog, larger screens a menu
    const useDialog = computed(() => $q.screen.lt.sm);
    const dialogVisible = ref(false);

    return { useDialog, dialogVisible };
  },
});
</script>
