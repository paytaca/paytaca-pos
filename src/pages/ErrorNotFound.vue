<template>
  <div
    class="fullscreen bg-blue text-white text-center q-pa-md flex flex-center"
    style="
      padding-top: constant(safe-area-inset-top);
      padding-top: env(safe-area-inset-top);
    "
  >
    <div>
      <div style="font-size: 30vh">404</div>

      <div class="text-h2" style="opacity: 0.4">
        {{ $t("PageNotFoundMsg") }}
      </div>

      <q-btn
        class="q-mt-xl"
        color="white"
        text-color="blue"
        unelevated
        to="/"
        :label="$t('GoHome')"
        no-caps
      />
    </div>
  </div>
</template>

<script>
import { defineComponent } from "vue";

export default defineComponent({
  name: "ErrorNotFound",
});
</script>
