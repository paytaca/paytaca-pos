<template>
  <div class="settings-page">
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

    <div class="settings-content q-px-md q-pt-lg q-pb-xl">
      <div v-if="walletStore?.merchantInfo?.id" class="profile-section q-mb-lg">
        <q-card class="profile-card" :class="{ 'bg-dark': $q.dark.isActive }">
          <q-card-section class="q-pa-lg">
            <div class="row items-center q-gutter-md">
              <q-avatar
                size="64px"
                color="brandblue"
                text-color="white"
                class="profile-avatar"
              >
                <q-icon name="store" size="32px" />
              </q-avatar>
              <div class="col">
                <div class="text-h5 text-weight-medium ellipsis">
                  {{ walletStore.merchantInfo.name }}
                </div>
                <div
                  v-if="walletStore.branchInfo.name"
                  class="text-subtitle2 text-grey-7 q-mt-xs"
                >
                  <q-icon name="location_on" size="16px" class="q-mr-xs" />
                  {{ walletStore.branchInfo.name }}
                </div>
              </div>
            </div>
            <q-separator class="q-my-md" :dark="$q.dark.isActive" />
            <q-btn
              v-if="walletStore?.branchInfo?.id"
              outline
              no-caps
              :label="$t('GoToMarketPlace')"
              icon="storefront"
              :to="{ name: 'marketplace' }"
              color="brandblue"
              class="full-width marketplace-btn q-mb-md"
            />
            <div class="row q-gutter-y-sm">
              <div
                v-if="walletStore.merchantInfo.primaryContactNumber"
                class="col-12"
              >
                <div class="text-caption text-grey">
                  {{ $t("PhoneNumber") }}
                </div>
                <div class="text-body2">
                  {{ walletStore.merchantInfo.primaryContactNumber }}
                </div>
              </div>
              <div v-if="walletStore.formattedMerchantAddress" class="col-12">
                <div class="text-caption text-grey">{{ $t("Address") }}</div>
                <div class="text-body2">
                  {{ walletStore.formattedMerchantAddress }}
                </div>
              </div>
              <div v-if="walletStore.formattedBranchAddress" class="col-12">
                <div class="text-caption text-grey">
                  {{ $t("BranchAddress") }}
                </div>
                <div class="text-body2">
                  {{ walletStore.formattedBranchAddress }}
                </div>
              </div>
            </div>
          </q-card-section>
        </q-card>
      </div>

      <div class="section-title text-overline text-uppercase q-mb-sm q-pl-sm">
        {{ $t("Preferences") }}
      </div>
      <q-card
        class="settings-card q-mb-lg"
        :class="{ 'bg-dark': $q.dark.isActive }"
      >
        <q-list class="rounded-borders">
          <q-item clickable v-ripple @click="$q.dark.toggle()" class="q-py-md">
            <q-item-section avatar>
              <q-avatar
                :color="$q.dark.isActive ? 'yellow' : 'grey-7'"
                text-color="white"
                size="40px"
              >
                <q-icon :name="$q.dark.isActive ? 'dark_mode' : 'light_mode'" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{
                $t("DarkMode")
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-toggle
                :model-value="$q.dark.isActive"
                color="brandblue"
                keep-color
                @update:model-value="(val) => $q.dark.set(val)"
              />
            </q-item-section>
          </q-item>

          <q-separator :dark="$q.dark.isActive" inset="item" />

          <q-item class="q-py-md">
            <q-item-section avatar>
              <q-avatar color="blue-9" text-color="white" size="40px">
                <q-icon name="language" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{
                $t("Language")
              }}</q-item-label>
            </q-item-section>
            <q-item-section side class="language-selector">
              <LanguageSelector />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <div
        v-if="walletStore.walletHash"
        class="section-title text-overline text-uppercase q-mb-sm q-pl-sm"
      >
        {{ $t("Device") }}
      </div>
      <q-card
        v-if="walletStore.walletHash"
        class="settings-card q-mb-lg"
        :class="{ 'bg-dark': $q.dark.isActive }"
      >
        <q-list class="rounded-borders">
          <q-item class="q-py-md">
            <q-item-section avatar>
              <q-avatar color="accent" text-color="white" size="40px">
                <q-icon name="devices" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{
                $t("POSDevice")
              }}</q-item-label>
              <q-item-label caption class="q-mt-xs">
                <span class="text-weight-medium">{{
                  truncatedWalletHash
                }}</span>
                <span class="q-ml-xs">#{{ padPosId(walletStore.posId) }}</span>
              </q-item-label>
              <q-item-label v-if="walletStore.deviceInfo.name" caption>
                {{ walletStore.deviceInfo.name }}
              </q-item-label>
            </q-item-section>
          </q-item>

          <q-separator
            v-if="
              walletStore.walletHash && walletStore.preferences.selectedCurrency
            "
            :dark="$q.dark.isActive"
            inset="item"
          />

          <q-item
            v-if="
              walletStore.walletHash && walletStore.preferences.selectedCurrency
            "
            class="q-py-md"
          >
            <q-item-section avatar>
              <q-avatar color="green-7" text-color="white" size="40px">
                <q-icon name="paid" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{
                $t("Currency")
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <div class="row items-center q-gutter-xs">
                <span class="text-subtitle2">{{
                  walletStore.preferences.selectedCurrency
                }}</span>
                <q-icon
                  name="info"
                  size="18px"
                  color="grey"
                  class="cursor-pointer"
                >
                  <q-popup-proxy :breakpoint="0">
                    <q-card class="q-pa-md" style="max-width: 280px">
                      <div class="text-caption">
                        {{ $t("CurrencySettingNote") }}
                      </div>
                    </q-card>
                  </q-popup-proxy>
                </q-icon>
              </div>
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>

      <div class="section-title text-overline text-uppercase q-mb-sm q-pl-sm">
        {{ $t("About") }}
      </div>
      <q-card
        class="settings-card q-mb-lg"
        :class="{ 'bg-dark': $q.dark.isActive }"
      >
        <q-list class="rounded-borders">
          <q-item class="q-py-md">
            <q-item-section avatar>
              <q-avatar color="primary" text-color="white" size="40px">
                <q-icon name="info" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{
                $t("AppVersion")
              }}</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-badge
                color="brandblue"
                :label="`v${appVersion}`"
                class="text-subtitle2"
              />
            </q-item-section>
          </q-item>

          <q-separator :dark="$q.dark.isActive" inset="item" />

          <q-item
            clickable
            v-ripple
            tag="a"
            :href="repoUrl"
            target="_blank"
            class="q-py-md"
          >
            <q-item-section avatar>
              <q-avatar color="grey-8" text-color="white" size="40px">
                <q-icon name="code" />
              </q-avatar>
            </q-item-section>
            <q-item-section>
              <q-item-label class="text-weight-medium">{{
                $t("Repository")
              }}</q-item-label>
              <q-item-label caption>Paytaca POS @ Github</q-item-label>
            </q-item-section>
            <q-item-section side>
              <q-icon name="open_in_new" color="grey" />
            </q-item-section>
          </q-item>
        </q-list>
      </q-card>
    </div>
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

    const debugIconVisible = ref(false);
    const longPressTimer = ref(null);
    const LONG_PRESS_DURATION = 500;

    onMounted(() => {
      const stored = localStorage.getItem("debugIconVisible");
      debugIconVisible.value = stored === "true";
      if (debugIconVisible.value) {
        startInterception();
      } else {
        stopInterception();
      }
    });

    function toggleDebugIcon() {
      debugIconVisible.value = !debugIconVisible.value;
      localStorage.setItem("debugIconVisible", String(debugIconVisible.value));

      if (debugIconVisible.value) {
        startInterception();
      } else {
        stopInterception();
      }
    }

    function showDebugConfirmation() {
      if (debugIconVisible.value) {
        toggleDebugIcon();
        return;
      }

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

<style lang="scss" scoped>
.settings-page {
  min-height: 100vh;
}

.settings-content {
  max-width: 600px;
  margin: 0 auto;
}

.section-title {
  letter-spacing: 1px;
  font-weight: 500;
  color: var(--q-primary);
}

.settings-card {
  border-radius: 16px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.3s ease;

  &:hover {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
  }
}

.profile-card {
  border-radius: 20px;
  overflow: hidden;
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
}

.profile-avatar {
  background: linear-gradient(135deg, $brandblue 0%, $primary 100%);
}

.language-selector {
  min-width: 150px;
}

.marketplace-btn {
  border-radius: 12px;
  font-weight: 500;
  transition: all 0.2s ease;

  &:hover {
    transform: translateY(-1px);
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  }
}

.cursor-pointer {
  cursor: pointer;
}

.body--dark {
  .settings-card,
  .profile-card {
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.3);
  }
}
</style>
