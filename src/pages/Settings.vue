<template>
  <div class="q-pb-md">
    <MainHeader :title="$t('Settings')">
      <template #title>
        <q-toolbar-title
          class="text-h4"
          style="
            position: absolute;
            left: 50%;
            transform: translateX(-50%);
            user-select: none;
            cursor: pointer;
          "
          @touchstart="handleTitleTouchStart"
          @touchend="handleTitleTouchEnd"
          @touchcancel="handleTitleTouchCancel"
          @mousedown="handleTitleMouseDown"
          @mouseup="handleTitleMouseUp"
          @mouseleave="handleTitleMouseUp"
        >
          {{ $t("Settings") }}
        </q-toolbar-title>
      </template>
      <template #right-actions>
        <q-btn
          v-if="debugIconVisible"
          flat
          round
          icon="bug_report"
          size="md"
          @click="goToDebug"
          class="q-mr-sm"
        >
          <q-tooltip>Debug</q-tooltip>
        </q-btn>
      </template>
    </MainHeader>
    <q-card
      class="q-mx-md q-mt-lg text-weight-medium"
      style="border-radius: 16px"
    >
      <q-list separator>
        <q-item
          v-if="walletStore?.branchInfo?.id"
          clickable
          v-ripple
          :to="{ name: 'marketplace' }"
        >
          <q-item-section
            :class="$q.dark.isActive ? 'text-white' : 'text-brandblue'"
          >
            <q-item-label>{{ $t("Marketplace") }}</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-item-label class="text-caption text-underline">{{
              $t("GoToMarketPlace")
            }}</q-item-label>
          </q-item-section>
        </q-item>
        <q-item clickable v-ripple @click="$q.dark.toggle()">
          <q-item-section
            :class="$q.dark.isActive ? 'text-white' : 'text-brandblue'"
          >
            <q-item-label>{{ $t("DarkMode") }}</q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-toggle
              :model-value="$q.dark.isActive"
              color="blue-9"
              keep-color
              @update:model-value="(val) => $q.dark.set(val)"
            />
          </q-item-section>
        </q-item>
        <q-item
          v-if="walletStore.walletHash"
          :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'"
        >
          <q-item-section>
            <q-item-label>
              {{ $t("POSDevice") }}
            </q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-item-label class="text-subtitle1">
              {{ truncatedWalletHash }}
              <span>#{{ padPosId(walletStore.posId) }}</span>
            </q-item-label>
            <q-item-label v-if="walletStore.deviceInfo.name">
              {{ walletStore.deviceInfo.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item
          v-if="
            walletStore.walletHash && walletStore.preferences.selectedCurrency
          "
          :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'"
        >
          <q-item-section>
            <q-item-label>
              {{ $t("Currency") }}
            </q-item-label>
          </q-item-section>
          <q-item-section avatar>
            <q-item-label>
              {{ walletStore.preferences.selectedCurrency }}
              <q-icon name="info" class="" size="1.5em">
                <q-popup-proxy :breakpoint="0">
                  <div class="q-pa-md">
                    {{ $t("CurrencySettingNote") }}
                  </div>
                </q-popup-proxy>
              </q-icon>
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item :class="$q.dark.isActive ? 'text-grey' : 'text-grey-8'">
          <q-item-section>
            <q-item-label>
              {{ $t("Language") }}
            </q-item-label>
          </q-item-section>
          <q-item-section>
            <LanguageSelector />
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
    <q-card
      v-if="walletStore?.merchantInfo?.id"
      class="q-mx-md q-mt-lg text-weight-medium"
      style="border-radius: 16px"
    >
      <q-card-section class="q-pb-xs">
        <div class="text-h6">
          <q-icon name="storefront" size="1.5em" class="q-mr-xs" />
          {{ $t("MerchantDetails") }}
        </div>
      </q-card-section>
      <q-separator />
      <q-list separator dense class="q-pb-md">
        <q-item class="">
          <q-item-section class="text-grey">
            <q-item-label>{{ $t("Name") }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ walletStore.merchantInfo.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item
          v-if="walletStore.branchInfo.id && walletStore.branchInfo.name"
          class=""
        >
          <q-item-section class="text-grey">
            <q-item-label>{{ $t("Branch") }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ walletStore.branchInfo.name }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="">
          <q-item-section class="text-grey">
            <q-item-label>{{ $t("PhoneNumber") }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ walletStore.merchantInfo.primaryContactNumber }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item class="">
          <q-item-section class="text-grey">
            <q-item-label>{{ $t("Address") }}</q-item-label>
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ walletStore.formattedMerchantAddress }}
            </q-item-label>
          </q-item-section>
        </q-item>
        <q-item v-if="walletStore.formattedBranchAddress" class="">
          <q-item-section class="text-grey">
            {{ $t("BranchAddress") }}
          </q-item-section>
          <q-item-section>
            <q-item-label>
              {{ walletStore.formattedBranchAddress }}
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
    <q-card
      class="q-mx-md q-mt-lg text-weight-medium"
      style="border-radius: 16px"
    >
      <q-list>
        <q-item>
          <q-item-section class="text-grey">
            {{ $t("AppVersion") }}
          </q-item-section>
          <q-item-section>
            <q-item-label> v{{ appVersion }} </q-item-label>
          </q-item-section>
        </q-item>
        <q-item>
          <q-item-section class="text-grey">
            {{ $t("Repository") }}
          </q-item-section>
          <q-item-section>
            <q-item-label>
              <a
                :href="repoUrl"
                style="text-decoration: none"
                :style="{ color: $q.dark.isActive ? 'white' : 'black' }"
                target="_blank"
              >
                Paytaca POS Repo @ Github
              </a>
            </q-item-label>
          </q-item-section>
        </q-item>
      </q-list>
    </q-card>
  </div>
</template>

<script>
import { computed, defineComponent, ref, onMounted } from "vue";
import { useRouter } from "vue-router";
import { useQuasar } from "quasar";
import { useI18n } from "vue-i18n";
import MainHeader from "src/components/MainHeader.vue";
import { useWalletStore } from "src/stores/wallet";
import { padPosId } from "src/wallet/utils";
import packageInfo from "../../package.json";
import LanguageSelector from "src/components/LanguageSelector.vue";
import { useDebugLogger } from "src/composables/useDebugLogger";

export default defineComponent({
  name: "SettingsPage",
  components: {
    MainHeader,
    LanguageSelector,
  },
  setup() {
    const router = useRouter();
    const $q = useQuasar();
    const { t } = useI18n();
    const walletStore = useWalletStore();
    const appVersion = packageInfo.version;
    const repoUrl = "https://github.com/paytaca/paytaca-pos";
    const { startInterception, stopInterception } = useDebugLogger();

    // Debug icon visibility state
    const debugIconVisible = ref(false);
    const longPressTimer = ref(null);
    const LONG_PRESS_DURATION = 500; // 500ms

    // Initialize debug visibility from localStorage
    onMounted(() => {
      const stored = localStorage.getItem("debugIconVisible");
      debugIconVisible.value = stored === "true";
      // Start/stop interception based on initial state
      if (debugIconVisible.value) {
        startInterception();
      } else {
        stopInterception();
      }
    });

    function toggleDebugIcon() {
      debugIconVisible.value = !debugIconVisible.value;
      localStorage.setItem("debugIconVisible", String(debugIconVisible.value));

      // Start or stop console interception based on visibility
      if (debugIconVisible.value) {
        startInterception();
      } else {
        stopInterception();
      }
    }

    function showDebugConfirmation() {
      // Only show confirmation if debug icon is currently hidden
      if (debugIconVisible.value) {
        // If already visible, just toggle it off without confirmation
        toggleDebugIcon();
        return;
      }

      // Show confirmation dialog before showing debug icon
      $q.dialog({
        title: t("Show Debug Tools"),
        message: t(
          "Do you want to show the debug icon? This will enable console log capture."
        ),
        cancel: true,
        persistent: false,
      }).onOk(() => {
        toggleDebugIcon();
      });
    }

    function goToDebug() {
      router.push({ name: "debug" });
    }

    function handleTitleTouchStart() {
      longPressTimer.value = setTimeout(() => {
        showDebugConfirmation();
        longPressTimer.value = null;
      }, LONG_PRESS_DURATION);
    }

    function handleTitleTouchEnd() {
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value);
        longPressTimer.value = null;
      }
    }

    function handleTitleTouchCancel() {
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value);
        longPressTimer.value = null;
      }
    }

    function handleTitleMouseDown() {
      longPressTimer.value = setTimeout(() => {
        showDebugConfirmation();
        longPressTimer.value = null;
      }, LONG_PRESS_DURATION);
    }

    function handleTitleMouseUp() {
      if (longPressTimer.value) {
        clearTimeout(longPressTimer.value);
        longPressTimer.value = null;
      }
    }

    const truncatedWalletHash = computed(() => {
      const walletHash = walletStore.walletHash;
      if (typeof walletHash !== "string") return walletHash;
      if (walletHash.length <= 13) return walletHash;

      return (
        walletHash.substring(0, 5) +
        "..." +
        walletHash.substring(walletHash.length - 5)
      );
    });

    return {
      padPosId,
      walletStore,
      appVersion,
      repoUrl,
      truncatedWalletHash,
      debugIconVisible,
      goToDebug,
      handleTitleTouchStart,
      handleTitleTouchEnd,
      handleTitleTouchCancel,
      handleTitleMouseDown,
      handleTitleMouseUp,
    };
  },
});
</script>
