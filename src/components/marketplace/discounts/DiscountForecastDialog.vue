<template>
  <q-dialog ref="dialogRef" @hide="onDialogHide" position="bottom">
    <q-card
      class="rounded-borders column no-wrap"
      style="width: 100%; max-width: 640px; max-height: 88vh;"
    >
      <div class="q-pa-md row items-start no-wrap">
        <div class="q-space">
          <div class="text-h6">
            {{ $t("DiscountForecast", {}, "Discount forecast") }}
          </div>
          <div class="text-caption text-grey">
            {{
              $t(
                "DiscountForecastSubtitle",
                {},
                "A preview of how this discount would have affected recent sales. Nothing is saved until you create it."
              )
            }}
          </div>
        </div>
        <q-btn flat round icon="close" padding="sm" v-close-popup />
      </div>

      <q-separator />

      <div class="col overflow-auto q-pa-md q-gutter-y-md">
        <div v-if="loading" class="text-center q-py-xl">
          <q-spinner color="brandblue" size="2.5rem" />
          <div class="text-subtitle1 q-mt-sm">
            {{ $t("GeneratingForecast", {}, "Generating forecast") }}
          </div>
          <div class="text-caption text-grey">
            {{
              $t(
                "GeneratingForecastHint",
                {},
                "Checking recent sales against this discount."
              )
            }}
          </div>
        </div>

        <div v-else-if="errorMessage" class="text-center q-py-lg">
          <q-icon name="warning_amber" color="amber-8" size="2.5rem" />
          <div class="text-subtitle1 q-mt-sm">
            {{ $t("ForecastUnavailable", {}, "Forecast unavailable") }}
          </div>
          <div class="text-body2 text-grey q-mt-xs">{{ errorMessage }}</div>
          <q-btn
            outline
            no-caps
            color="brandblue"
            class="q-mt-md"
            :label="$t('Retry', {}, 'Retry')"
            @click="fetchForecast"
          />
        </div>

        <DiscountReport v-else-if="forecast" :report="forecast" />
      </div>

      <q-separator />

      <div class="q-pa-md row items-center justify-end q-gutter-x-sm">
        <q-btn flat no-caps color="grey-7" :label="$t('Cancel')" v-close-popup />
        <q-btn
          v-if="errorMessage"
          no-caps
          color="brandblue"
          :label="$t('CreateWithoutForecast', {}, 'Create without forecast')"
          @click="onDialogOK"
        />
        <q-btn
          v-else
          no-caps
          color="brandblue"
          :label="$t('CreateDiscount', {}, 'Create discount')"
          :loading="loading"
          :disable="loading"
          @click="onDialogOK"
        />
      </div>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from "src/marketplace/backend";
import DiscountReport from "src/components/marketplace/discounts/DiscountReport.vue";
import { useDiscountReportHelpers } from "src/composables/marketplace/discountReport";
import { useDialogPluginComponent } from "quasar";
import { defineComponent, onMounted, ref } from "vue";

export default defineComponent({
  name: "DiscountForecastDialog",
  components: {
    DiscountReport,
  },
  props: {
    forecastRequest: {
      type: Object,
      required: true,
    },
  },
  emits: [
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props) {
    const { dialogRef, onDialogHide, onDialogOK } = useDialogPluginComponent();
    const { parseReportError } = useDiscountReportHelpers();

    const loading = ref(false);
    const errorMessage = ref("");
    const forecast = ref(null);

    function fetchForecast() {
      loading.value = true;
      errorMessage.value = "";
      return backend
        .post("reports/discount-types/forecast/", props.forecastRequest)
        .then((response) => {
          const data = response?.data;
          if (!data || !Array.isArray(data.summaries)) {
            return Promise.reject({ response });
          }
          forecast.value = data;
          return response;
        })
        .catch((error) => {
          forecast.value = null;
          errorMessage.value = parseReportError(error, {
            mode: props.forecastRequest?.mode || "basket",
          });
        })
        .finally(() => {
          loading.value = false;
        });
    }

    onMounted(fetchForecast);

    return {
      dialogRef,
      onDialogHide,
      onDialogOK,

      loading,
      errorMessage,
      forecast,
      fetchForecast,
    };
  },
});
</script>
