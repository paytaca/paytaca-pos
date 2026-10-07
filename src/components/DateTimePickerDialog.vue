<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide">
    <q-card class="rounded-borders" style="width: 100%; max-width: 360px;">
      <div class="row items-center no-wrap q-px-md q-py-sm">
        <div class="text-h6 q-space">{{ dialogTitle }}</div>
        <q-btn flat round icon="close" padding="sm" v-close-popup />
      </div>
      <q-separator />
      <q-card-section>
        <div class="row no-wrap items-center">
          <div class="wheel-col">
            <WheelColumn v-model="day" :items="dayItems" />
          </div>
          <div class="wheel-sep">-</div>
          <div class="wheel-col">
            <WheelColumn v-model="month" :items="monthItems" />
          </div>
          <div class="wheel-sep">-</div>
          <div class="wheel-col">
            <WheelColumn v-model="year" :items="yearItems" />
          </div>
        </div>
        <div class="row no-wrap items-center q-mt-sm">
          <div class="wheel-col">
            <WheelColumn v-model="hour" :items="hourItems" />
          </div>
          <div class="wheel-sep">:</div>
          <div class="wheel-col">
            <WheelColumn v-model="minute" :items="minuteItems" />
          </div>
          <div class="wheel-col">
            <WheelColumn v-model="ampm" :items="ampmItems" />
          </div>
        </div>
        <div class="row justify-end q-mt-sm q-gutter-x-sm">
          <q-btn
            flat
            no-caps
            padding="sm md"
            color="brandblue"
            :label="$t('Today', 'Today')"
            @click="jumpToToday"
          />
          <q-btn
            flat
            no-caps
            padding="sm md"
            color="brandblue"
            :label="$t('Now', 'Now')"
            @click="jumpToNow"
          />
        </div>
      </q-card-section>
      <q-separator />
      <q-card-actions align="right" class="q-px-md q-py-sm">
        <q-btn
          flat
          no-caps
          color="grey-7"
          :label="$t('Cancel', 'Cancel')"
          v-close-popup
        />
        <q-btn
          no-caps
          color="brandblue"
          :label="$t('OK', 'OK')"
          @click="confirm"
        />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>

<script>
import { useDialogPluginComponent } from "quasar";
import { useI18n } from "vue-i18n";
import { defineComponent, ref, computed, watch } from "vue";
import WheelColumn from "./WheelColumn.vue";

export default defineComponent({
  name: "DateTimePickerDialog",
  components: {
    WheelColumn,
  },
  props: {
    modelValue: {
      type: String,
      default: "",
    },
    title: {
      type: String,
      default: "",
    },
    minYear: {
      type: Number,
      default: () => new Date().getFullYear() - 100,
    },
    maxYear: {
      type: Number,
      default: () => new Date().getFullYear() + 100,
    },
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { t: $t } = useI18n();
    const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();

    const locale = navigator.language || "en-US";

    function parseISO(iso) {
      const d = iso ? new Date(iso) : new Date();
      if (isNaN(d.getTime())) return parseISO("");
      return {
        day: d.getDate(),
        month: d.getMonth(),
        year: d.getFullYear(),
        hour12: d.getHours() % 12 || 12,
        minute: d.getMinutes(),
        ampm: d.getHours() < 12 ? "AM" : "PM",
      };
    }

    const initial = parseISO(props.modelValue);
    const day = ref(initial.day);
    const month = ref(initial.month);
    const year = ref(initial.year);
    const hour = ref(initial.hour12);
    const minute = ref(initial.minute);
    const ampm = ref(initial.ampm);

    const dialogTitle = computed(
      () => props.title || $t("SelectDateTime", "Select date & time")
    );

    // Locale-aware month names (short form, e.g. "Jan", "Feb")
    const monthNames = Array.from({ length: 12 }, (_, i) => {
      const d = new Date(2000, i, 1);
      return new Intl.DateTimeFormat(locale, { month: "short" }).format(d);
    });

    // Locale-aware AM/PM labels
    function getDayPeriodLabel(hour24) {
      const parts = new Intl.DateTimeFormat(locale, {
        hour: "numeric",
        hour12: true,
      }).formatToParts(new Date(2000, 0, 1, hour24));
      return parts.find((part) => part.type === "dayPeriod")?.value || "";
    }
    const amLabel = getDayPeriodLabel(1);
    const pmLabel = getDayPeriodLabel(13);

    const daysInMonth = computed(() =>
      new Date(year.value, month.value + 1, 0).getDate()
    );

    const dayItems = computed(() =>
      Array.from({ length: daysInMonth.value }, (_, i) => ({
        label: String(i + 1).padStart(2, "0"),
        value: i + 1,
      }))
    );
    const monthItems = monthNames.map((name, i) => ({
      label: name,
      value: i,
    }));
    const yearItems = computed(() => {
      const items = [];
      for (let y = props.minYear; y <= props.maxYear; y++) {
        items.push({ label: String(y), value: y });
      }
      return items;
    });
    const hourItems = Array.from({ length: 12 }, (_, i) => ({
      label: String(i + 1).padStart(2, "0"),
      value: i + 1,
    }));
    const minuteItems = Array.from({ length: 60 }, (_, i) => ({
      label: String(i).padStart(2, "0"),
      value: i,
    }));
    const ampmItems = [
      { label: amLabel, value: "AM" },
      { label: pmLabel, value: "PM" },
    ];

    // Clamp the day when the selected month/year changes
    watch(daysInMonth, (max) => {
      if (day.value > max) day.value = max;
    });

    function jumpToToday() {
      const now = new Date();
      day.value = now.getDate();
      month.value = now.getMonth();
      year.value = now.getFullYear();
    }

    function jumpToNow() {
      const now = new Date();
      hour.value = now.getHours() % 12 || 12;
      minute.value = now.getMinutes();
      ampm.value = now.getHours() < 12 ? "AM" : "PM";
    }

    function confirm() {
      const hour24 =
        ampm.value === "AM"
          ? hour.value === 12
            ? 0
            : hour.value
          : hour.value === 12
          ? 12
          : hour.value + 12;
      const date = new Date(
        year.value,
        month.value,
        day.value,
        hour24,
        minute.value,
        0,
        0
      );
      onDialogOK(date.toISOString());
    }

    return {
      dialogRef,
      onDialogHide,

      dialogTitle,
      day,
      month,
      year,
      hour,
      minute,
      ampm,
      dayItems,
      monthItems,
      yearItems,
      hourItems,
      minuteItems,
      ampmItems,
      jumpToToday,
      jumpToNow,
      confirm,
    };
  },
});
</script>

<style scoped>
.wheel-col {
  flex: 1;
  min-width: 0;
}
.wheel-sep {
  width: 16px;
  text-align: center;
  color: #9e9e9e;
  flex-shrink: 0;
}
body.body--dark .wheel-sep {
  color: rgba(255, 255, 255, 0.5);
}
</style>
