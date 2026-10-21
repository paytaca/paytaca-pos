<template>
  <q-card
    v-if="currentTask"
    flat
    class="next-steps q-mb-md"
    role="region"
    :aria-label="headingText"
  >
    <!-- Header row: badge + dismiss -->
    <div class="row items-center no-wrap">
      <div class="next-steps__heading row items-center no-wrap q-space">
        <q-icon :name="iconName" size="16px" class="q-mr-xs" />
        <span class="next-steps__heading-text">{{ headingText }}</span>
      </div>

      <q-btn
        v-if="showDismiss"
        flat
        round
        icon="close"
        class="next-steps__icon-btn"
        :color="controlColor"
        :aria-label="dismissLabel"
        @click="onDismiss"
      >
        <q-tooltip>{{ dismissLabel }}</q-tooltip>
      </q-btn>
    </div>

    <!-- Body: task title + description -->
    <div class="next-steps__body">
      <div class="next-steps__title">
        {{ currentTask.title }}
      </div>
      <div class="next-steps__hint">
        {{ hint }}
      </div>
    </div>

    <!-- Secondary controls row: stepper (left) + "do not show again" (right) -->
    <div
      v-if="tasks.length > 1 || showDismiss"
      class="next-steps__controls row items-center justify-between no-wrap"
    >
      <div v-if="tasks.length > 1" class="row items-center no-wrap">
        <q-btn
          dense
          flat
          round
          icon="chevron_left"
          class="next-steps__icon-btn"
          :color="controlColor"
          :disable="isFirstTask"
          :aria-label="$t('PreviousTask', 'Previous task')"
          @click="onPrev"
        />
        <div class="next-steps__count">
          {{ modelValue + 1 }} / {{ tasks.length }}
        </div>
        <q-btn
          dense
          flat
          round
          icon="chevron_right"
          class="next-steps__icon-btn"
          :color="controlColor"
          :disable="isLastTask"
          :aria-label="$t('NextTask', 'Next task')"
          @click="onNext"
        />
      </div>

      <q-checkbox
        v-if="showDismiss"
        dense
        :model-value="doNotShowAgain"
        class="next-steps__permanent q-ml-auto"
        :color="controlColor"
        :label="$t('DoNotShowAgain', 'Do not show again')"
        @update:model-value="onDoNotShowAgainChange"
      >
        <q-tooltip>
          {{ $t('DoNotShowAgainTooltip', 'Hide this step permanently, even after restarting the app.') }}
        </q-tooltip>
      </q-checkbox>
    </div>

    <!-- Action row: full-width primary CTA -->
    <q-btn
      v-if="showAction"
      padding="xs"
      unelevated
      no-caps
      color="warning"
      text-color="dark"
      class="full-width next-steps__cta"
      :label="currentTask.actionLabel || $t('SetUp', 'Set up')"
      @click="onPrimaryAction"
    />
  </q-card>
</template>

<script>
import { computed, defineComponent, ref, watch } from 'vue'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'

/**
 * Inline "next steps" task banner (mobile-first, stacked controls layout).
 *
 * Purely presentational: the host resolves the ordered task list (see
 * `useSetupTasks`) and decides what `action` and `dismiss` do. `locked` tasks
 * (blocked by an incomplete strict dependency) render without a CTA, with
 * `lockedHint` explaining what to finish first.
 *
 * Layout: header badge + dismiss, task title/description, then a controls row
 * (stepper left, "Do not show again" right) and a full-width CTA.
 *
 * Dismissing emits `dismiss` with the task and `{ permanent }`, where
 * `permanent` reflects the "Do not show again" checkbox — the host maps that
 * to the session-only or the persisted dismissal.
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
    /** Header badge text; hosts can re-label it for their context. */
    heading: {
      type: String,
      default: '',
    },
  },
  emits: ['update:modelValue', 'update:doNotShowAgain', 'action', 'dismiss'],
  setup(props, { emit }) {
    const $q = useQuasar()
    const { t: $t } = useI18n()
    const currentTask = computed(() => props.tasks[props.modelValue] || null)

    // "Do not show again" intent for the current task; consumed by `onDismiss`
    // so the host can pick the permanent dismissal instead of the session one.
    const doNotShowAgain = ref(false)

    const headingText = computed(() => props.heading || $t('NextSteps', 'Next steps'))

    const iconName = computed(() =>
      currentTask.value?.locked
        ? 'lock'
        : currentTask.value?.icon || 'check_circle_outline'
    )

    const hint = computed(() =>
      currentTask.value?.locked ? currentTask.value?.lockedHint : currentTask.value?.hint
    )

    const showAction = computed(() => Boolean(currentTask.value?.action) && !currentTask.value?.locked)

    const showDismiss = computed(
      () => props.dismissible && currentTask.value?.dismissible !== false
    )

    const isFirstTask = computed(() => props.modelValue <= 0)
    const isLastTask = computed(() => props.modelValue >= props.tasks.length - 1)

    const dismissLabel = computed(() =>
      doNotShowAgain.value
        ? $t('DismissBannerPermanent', 'Dismiss banner and do not show again')
        : $t('DismissBanner', 'Dismiss banner')
    )

    // Dark control color keeps the controls legible on the dark card variant.
    const controlColor = computed(() => ($q.dark.isActive ? 'grey-4' : 'dark'))

    // The checkbox is per-task, so it must not carry over to the next step.
    watch(() => currentTask.value?.key, () => {
      doNotShowAgain.value = false
    })

    function onDismiss() {
      emit('dismiss', currentTask.value, { permanent: doNotShowAgain.value })
    }
    function onDoNotShowAgainChange(isChecked) {
      doNotShowAgain.value = isChecked
      emit('update:doNotShowAgain', isChecked)
    }
    function onPrev() {
      if (isFirstTask.value) return
      emit('update:modelValue', props.modelValue - 1)
    }
    function onNext() {
      if (isLastTask.value) return
      emit('update:modelValue', props.modelValue + 1)
    }
    function onPrimaryAction() {
      emit('action', currentTask.value)
    }

    return {
      currentTask,
      headingText,
      iconName,
      hint,
      showAction,
      showDismiss,
      isFirstTask,
      isLastTask,
      dismissLabel,
      controlColor,
      doNotShowAgain,
      onDismiss,
      onDoNotShowAgainChange,
      onPrev,
      onNext,
      onPrimaryAction,
    }
  },
})
</script>

<style scoped lang="scss">
// Muted amber: enough tint + accent to stand out from the page background
// without the loud solid `bg-warning` fill.
$next-steps-bg: mix($warning, white, 18%);
$next-steps-border: mix($warning, white, 50%);
$next-steps-accent-fg: #7a5c00;

.next-steps {
  background: $next-steps-bg;
  border: 1px solid $next-steps-border;
  border-left: 3px solid $warning;
  border-radius: 10px;
  color: $dark;

  // Stacked layout: header, body, controls, CTA.
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.next-steps__heading-text {
  color: $next-steps-accent-fg;
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.02em;
  line-height: 1.2;
}

.next-steps__heading .q-icon {
  color: $next-steps-accent-fg;
}

.next-steps__body {
  display: flex;
  flex-direction: column;
  gap: 2px;
  // Lets long titles/descriptions wrap instead of widening the card.
  min-width: 0;
}

.next-steps__title {
  font-size: 16px;
  font-weight: 700;
  line-height: 1.2;
}

.next-steps__hint {
  color: rgba(0, 0, 0, 0.55);
  font-size: 13px;
  // Comfortable reading for the 1-3 line description.
  line-height: 1.4;
}

.next-steps__count {
  color: rgba(0, 0, 0, 0.6);
  font-size: 12px;
  font-variant-numeric: tabular-nums;
  padding: 0 2px;
}

// Dense 36px visual box; an invisible overlay keeps the touch target at the
// 44x44 minimum for the icon-only buttons (dismiss + stepper).
.next-steps__icon-btn {
  min-height: 36px;
  min-width: 36px;

  &::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 100%;
    height: 100%;
    min-height: 44px;
    min-width: 44px;
    transform: translate(-50%, -50%);
  }
}

// Keeps the "Do not show again" label at the control scale.
.next-steps__permanent :deep(.q-checkbox__label) {
  font-size: 12px;
  line-height: 1.2;
}

.next-steps__cta {
  min-height: 33px;
}

body.body--dark .next-steps {
  background: rgba($warning, 0.12);
  border-color: rgba($warning, 0.3);
  border-left-color: $warning;
  color: white;
}

body.body--dark .next-steps__heading-text,
body.body--dark .next-steps__heading .q-icon {
  color: $warning;
}

body.body--dark .next-steps__hint,
body.body--dark .next-steps__count {
  color: rgba(255, 255, 255, 0.65);
}
</style>
