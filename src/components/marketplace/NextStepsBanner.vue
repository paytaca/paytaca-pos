<template>
  <q-banner
    v-if="currentTask"
    rounded
    dense
    class="q-mb-md bg-warning text-dark"
  >
    <template v-slot:avatar>
      <q-icon
        :name="currentTask.locked ? 'lock' : (currentTask.icon || 'check_circle_outline')"
        size="sm"
      />
    </template>

    <div class="row items-center no-wrap">
      <div class="q-space">
        <div class="text-body2">
          {{ currentTask.title }}
        </div>
        <div class="text-caption text-grey-8">
          {{ currentTask.locked ? currentTask.lockedHint : currentTask.hint }}
        </div>
      </div>

      <div v-if="tasks.length > 1" class="row items-center no-wrap q-ml-sm">
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="chevron_left"
          color="dark"
          :aria-label="$t('Previous')"
          @click="prev"
        />
        <div class="text-caption text-grey-8 q-px-xs">
          {{ modelValue + 1 }} / {{ tasks.length }}
        </div>
        <q-btn
          flat
          dense
          round
          size="sm"
          icon="chevron_right"
          color="dark"
          :aria-label="$t('Next')"
          @click="next"
        />
      </div>
    </div>

    <template v-slot:action>
      <q-btn
        v-if="currentTask.action && !currentTask.locked"
        flat
        no-caps
        dense
        color="dark"
        :label="currentTask.actionLabel || $t('SetUp', 'Set up')"
        @click="$emit('action', currentTask)"
      />

      <q-btn
        v-if="dismissible && currentTask.dismissible !== false"
        flat
        dense
        no-caps
        color="grey-7"
        @click="$emit('dismiss', currentTask)"
      >
        {{ $t('Dismiss', 'Dismiss') }}
      </q-btn>
    </template>
  </q-banner>
</template>

<script>
import { computed, defineComponent } from 'vue'

/**
 * Generic "next steps" nudge.
 *
 * Purely presentational: the host resolves the ordered task list (see
 * `useSetupTasks`) and decides what `action` and `dismiss` do. `locked` tasks
 * (blocked by an incomplete strict dependency) render disabled, with
 * `lockedHint` explaining what to finish first.
 */
export default defineComponent({
  name: 'NextStepsBanner',
  props: {
    tasks: {
      type: Array,
      default: () => [],
    },
    modelValue: {
      type: Number,
      default: 0,
    },
    dismissible: {
      type: Boolean,
      default: true,
    },
  },
  emits: ['update:modelValue', 'action', 'dismiss'],
  setup(props, { emit }) {
    const currentTask = computed(() => props.tasks[props.modelValue] || null)

    function prev() {
      if (props.tasks.length < 1) return
      emit('update:modelValue', (props.modelValue - 1 + props.tasks.length) % props.tasks.length)
    }
    function next() {
      if (props.tasks.length < 1) return
      emit('update:modelValue', (props.modelValue + 1) % props.tasks.length)
    }

    return { currentTask, prev, next }
  },
})
</script>
