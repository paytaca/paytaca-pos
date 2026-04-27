<template>
  <q-page
    class="transaction-detail-page"
    :class="isDarkMode ? 'bg-dark-page' : 'bg-brandwhite'"
  >
    <!-- Header -->
    <div class="transaction-header" :style="headerPaddingStyle">
      <q-btn flat icon="arrow_back" class="back-btn" @click="goBack" />
      <div class="text-h6 text-brandblue text-center header-title">
        {{ $t("Transaction") }}
      </div>
    </div>

    <div v-if="loadError && !isLoading" class="error-container">
      <div class="error-text">{{ loadError }}</div>
      <q-btn outline color="white" no-caps @click="goBack">{{
        $t("Back")
      }}</q-btn>
    </div>

    <div v-else-if="isLoading" class="transaction-content">
      <!-- Skeleton Loaders -->
      <div class="text-h5 text-center q-mb-lg">
        <q-skeleton type="text" width="120px" class="q-mx-auto" />
      </div>

      <div class="direction-icon-wrapper">
        <q-skeleton type="circle" size="56px" class="q-mx-auto" />
      </div>

      <div class="amount-section">
        <div class="amount-row">
          <q-skeleton type="circle" size="40px" class="q-mr-sm" />
          <q-skeleton type="text" width="150px" />
        </div>
        <q-skeleton type="text" width="100px" class="q-mt-xs q-mx-auto" />
      </div>

      <div class="reference-id-section">
        <q-skeleton type="text" width="80px" class="q-mb-xs q-mx-auto" />
        <q-skeleton type="text" width="120px" class="q-mx-auto" />
      </div>

      <div class="transaction-id-section">
        <q-separator class="q-mb-md" />
        <q-skeleton type="text" width="100px" class="q-mb-xs q-mx-auto" />
        <q-skeleton
          type="rect"
          width="200px"
          height="40px"
          class="q-mx-auto q-mt-sm"
        />
        <q-skeleton type="text" width="140px" class="q-mt-md q-mx-auto" />
      </div>

      <div class="date-section">
        <q-skeleton type="text" width="90px" class="q-mb-xs q-mx-auto" />
        <q-skeleton type="text" width="180px" class="q-mx-auto" />
      </div>
    </div>

    <div v-else-if="transaction" class="transaction-content">
      <!-- Transaction Type -->
      <div class="text-h5 text-center q-mb-lg">{{ $t("RECEIVED") }}</div>

      <!-- Direction Icon -->
      <div class="direction-icon-wrapper">
        <q-icon name="arrow_downward" class="direction-icon" />
      </div>

      <!-- Amount Section -->
      <div class="amount-section">
        <div class="amount-row">
          <q-avatar v-if="displayLogo" size="40px" class="amount-avatar">
            <img
              v-if="displayLogo && displayLogo !== 'bch-logo.png'"
              :src="displayLogo"
              @error="onImgErrorIpfsSrc"
            />
            <img
              v-else-if="displayLogo === 'bch-logo.png'"
              src="/bch-logo.png"
            />
          </q-avatar>
          <div class="text-h5 text-weight-medium">
            {{ formatNumberAutoDecimals(displayAmount) }}
            {{ displayTokenCurrency }}
          </div>
        </div>
        <div
          v-if="
            displayFiatAmount !== null &&
            displayFiatAmount !== undefined &&
            displayFiatCurrency
          "
          class="text-h6 text-grey q-mt-xs"
        >
          {{
            typeof displayFiatAmount === "number"
              ? formatNumberWithDecimals(displayFiatAmount, 2)
              : displayFiatAmount
          }}
          {{ displayFiatCurrency }}
        </div>
      </div>

      <!-- Reference ID Section -->
      <div class="reference-id-section">
        <div class="text-caption text-grey text-center q-mb-xs">
          {{ $t("ReferenceID") }}
        </div>
        <div class="text-h5 text-weight-bold text-center">
          {{ hexToRef(displayTxid.substring(0, 6)) }}
        </div>
      </div>

      <!-- Transaction ID Section -->
      <div class="transaction-id-section">
        <q-separator class="q-mb-md" />
        <div class="text-caption text-grey text-center q-mb-xs">
          {{ $t("TransactionID") }}
        </div>
        <div class="txid-container" @click="copyText(displayTxid)">
          <span class="text-body2"
            >{{ displayTxid.slice(0, 8) }}...{{ displayTxid.slice(-8) }}</span
          >
          <q-icon name="content_copy" size="18px" class="copy-icon" />
        </div>
        <a
          :href="explorerLink"
          target="_blank"
          class="explorer-link text-body2"
        >
          <q-icon name="open_in_new" size="16px" class="q-mr-xs" />
          {{ $t("ViewInExplorer") }}
        </a>
      </div>

      <!-- Date & Time Section -->
      <div class="date-section">
        <div class="text-caption text-grey text-center q-mb-xs">
          {{ $t("DateAndTime", {}, "Date & Time") }}
        </div>
        <div class="text-body1 text-center">{{ displayDate }}</div>
      </div>
    </div>
  </q-page>
</template>
<script>
import { convertIpfsUrl, onImgErrorIpfsSrc } from "src/utils/ipfs";
import { hexToRef } from "src/utils/reference-id-utils";
import { useI18n } from "vue-i18n";
import {
  defineComponent,
  ref,
  onMounted,
  onUnmounted,
  onUpdated,
  computed,
  watch,
  inject,
  nextTick,
} from "vue";
import { useQuasar } from "quasar";
import { useRouter, useRoute } from "vue-router";
import { useTransactionHelpers } from "src/composables/transaction";
import { useCashtokenStore } from "src/stores/cashtoken";
import { useWalletStore } from "src/stores/wallet";
import confetti from "canvas-confetti";
import { Capacitor } from "@capacitor/core";
import { NativeAudio } from "@capacitor-community/native-audio";
import AudioMode from "src/utils/audio-mode";
import {
  formatNumberAutoDecimals,
  formatNumberWithDecimals,
} from "src/utils/number-format";

export default defineComponent({
  name: "TransactionDetail",
  props: {
    txid: String,
  },
  setup(props) {
    const $q = useQuasar();
    const { t } = useI18n();
    const router = useRouter();
    const route = useRoute();
    const walletStore = useWalletStore();
    const cashtokenStore = useCashtokenStore();
    const { getTxAmount, getTxDisplayFiat } = useTransactionHelpers();

    const $copyText = inject("$copyText", null);

    const transaction = ref(null);
    const loadError = ref(null);
    const isLoading = ref(false);

    // Audio state for native platforms
    const audioPreloaded = ref(false);
    const successfulAudioPath = ref(null);

    // Check if this is a new transaction from query params
    const isNewTransaction = computed(() => {
      const query = route.query || {};
      return (
        query.new === "true" ||
        (typeof query.category === "string" &&
          query.category.includes("?new=true")) ||
        (window.location.search && window.location.search.includes("new=true"))
      );
    });

    // Check if transaction was preloaded in history state
    const preloadedTransaction = computed(() => {
      const routeStateTx = route?.state?.tx;
      if (routeStateTx) return routeStateTx;

      return (
        (window &&
          window.history &&
          window.history.state &&
          window.history.state.tx) ||
        null
      );
    });

    // Computed values for display
    const displayTxid = computed(() => transaction.value?.txid);

    const displayAmount = computed(() => {
      if (!transaction.value) return null;
      const txAmount = getTxAmount(transaction.value);
      return txAmount?.value || transaction.value?.amount;
    });

    const displayTokenCurrency = computed(() => {
      if (!transaction.value) return "BCH";
      const txAmount = getTxAmount(transaction.value);
      return txAmount?.symbol || "BCH";
    });

    const displayFiatAmount = computed(() => {
      if (!transaction.value) return null;
      const fiat = getTxDisplayFiat(transaction.value);
      return fiat?.value;
    });

    const displayFiatCurrency = computed(() => {
      if (!transaction.value) return null;
      const fiat = getTxDisplayFiat(transaction.value);
      return fiat?.currency;
    });

    // Watch store changes to ensure reactivity
    const tokenMetadataRef = ref(null);

    // Watch the store's fungibleCashtokens array for changes
    watch(
      () => cashtokenStore.fungibleCashtokens,
      () => {
        if (!transaction.value) return;
        const tokenCategory =
          transaction.value?.ft_category || transaction.value?.nft_category;
        if (tokenCategory) {
          tokenMetadataRef.value =
            cashtokenStore.getTokenMetadata(tokenCategory);
        }
      },
      { deep: true, immediate: true }
    );

    // Also watch transaction changes to update metadata ref
    watch(
      () => transaction.value?.ft_category || transaction.value?.nft_category,
      (tokenCategory) => {
        if (tokenCategory) {
          tokenMetadataRef.value =
            cashtokenStore.getTokenMetadata(tokenCategory);
        } else {
          tokenMetadataRef.value = null;
        }
      },
      { immediate: true }
    );

    const displayLogo = computed(() => {
      if (!transaction.value) return "bch-logo.png";

      // First, check if logo is directly available in transaction (from websocket)
      if (
        transaction.value?.logo &&
        transaction.value.logo !== "bch-logo.png"
      ) {
        // It's a token logo URL (from websocket image_url), convert IPFS if needed
        return convertIpfsUrl(transaction.value.logo);
      }

      // Check if it's BCH (either explicitly set or no token category)
      const tokenCategory =
        transaction.value?.ft_category || transaction.value?.nft_category;
      if (!tokenCategory) {
        return "bch-logo.png";
      }

      // Try to get from metadata store (use both the ref and direct call for reactivity)
      const metadata =
        tokenMetadataRef.value ||
        cashtokenStore.getTokenMetadata(tokenCategory);
      if (metadata?.imageUrl) {
        return convertIpfsUrl(metadata.imageUrl);
      }

      // If metadata doesn't have imageUrl yet, but we have token category,
      // it means metadata is still loading - return BCH as fallback for now
      // The logo will update once metadata is loaded (computed is reactive)
      return "bch-logo.png";
    });

    const displayDate = computed(() => {
      if (!transaction.value) return "";
      const date =
        transaction.value?.tx_timestamp || transaction.value?.date_created;
      if (date) {
        return new Intl.DateTimeFormat("en-US", {
          year: "numeric",
          month: "short",
          day: "numeric",
          hour: "numeric",
          minute: "2-digit",
          second: "2-digit",
          hour12: true,
          timeZoneName: "short",
        }).format(new Date(date));
      }
      return "";
    });

    const displayMerchantName = computed(() => {
      // Only show for new transactions (payment success)
      if (!isNewTransaction.value) return null;
      return walletStore.merchantInfo?.name;
    });

    const displayPosName = computed(() => {
      // Only show for new transactions (payment success)
      if (!isNewTransaction.value) return null;
      return walletStore.deviceInfo?.name || `POS ${walletStore.posId}`;
    });

    const displaySenders = computed(() => {
      if (!transaction.value) return [];
      return transaction.value?.senders || [];
    });

    const explorerLink = computed(() => {
      if (!displayTxid.value) return "";
      return `https://bchexplorer.info/tx/${displayTxid.value}`;
    });

    // Fetch token metadata when transaction is loaded
    watch(
      () => transaction.value,
      (tx) => {
        if (!tx) return;
        const tokenCategory = tx?.ft_category || tx?.nft_category;
        if (!tokenCategory) return;

        // Check if we already have metadata cached with imageUrl
        const existingMetadata = cashtokenStore.getTokenMetadata(tokenCategory);
        if (existingMetadata?.imageUrl) return;

        // If transaction has websocket metadata (from payment received), use it
        if (
          tx?.tokenSymbol ||
          tx?.tokenName ||
          tx?.tokenDecimals !== undefined
        ) {
          const metadata = {
            category: tokenCategory,
            name: tx?.tokenName || "",
            symbol: tx?.tokenSymbol || "",
            decimals: tx?.tokenDecimals ?? 0,
            imageUrl: tx?.logo && tx.logo !== "bch-logo.png" ? tx.logo : null, // Use logo from websocket if available
          };
          cashtokenStore.saveTokenMetadata(metadata);

          // Always try to fetch from API for image URL if we don't have it yet
          if (!metadata.imageUrl) {
            cashtokenStore.fetchTokenMetadata(tokenCategory).catch(() => {
              // Silently fail - we already have the essential metadata from websocket
            });
          }
        } else {
          // No websocket metadata, try to fetch from API
          cashtokenStore.fetchTokenMetadata(tokenCategory);
        }
      },
      { immediate: true }
    );

    function concatenate(array) {
      if (!Array.isArray(array)) return "";
      let addresses = array
        .map((item) => item?.[0])
        .filter(Boolean)
        .filter((e, i, s) => s.indexOf(e) === i);

      return addresses.join(", ");
    }

    function copyText(value, message = "") {
      if (!$copyText) {
        // Fallback if inject is not available
        navigator.clipboard
          ?.writeText(value)
          .then(() => {
            $q.notify({
              message: message || t("Copied to clipboard"),
              timeout: 800,
              icon: "mdi-clipboard-check",
              color: "blue-9",
            });
          })
          .catch(() => {});
        return;
      }
      $copyText(value)
        .then(() => {
          $q.notify({
            message: message || t("Copied to clipboard"),
            timeout: 800,
            icon: "mdi-clipboard-check",
            color: "blue-9",
          });
        })
        .catch(() => {});
    }

    async function preloadAudio() {
      console.log("[NativeAudio] preloadAudio started");
      // Configure NativeAudio to not take audio focus, allowing other apps
      // (e.g. Spotify) to continue playing in the background
      try {
        console.log("[NativeAudio] calling configure...");
        await NativeAudio.configure({ focus: false, fade: false });
        console.log("[NativeAudio] configure success");
      } catch (e) {
        console.warn("[NativeAudio] configure error:", e);
      }

      // Try different path formats for iOS
      let paths = ["send-success.mp3"];
      if ($q.platform.is.ios) {
        // Try multiple iOS path formats - iOS Native Audio looks for files in the bundle
        // The file is at public/assets/sounds/send-success.mp3 which becomes www/assets/sounds/send-success.mp3
        paths = [
          "assets/sounds/send-success.mp3", // Relative to www
          "send-success.mp3", // Just filename (if in root)
          "/assets/sounds/send-success.mp3", // Absolute from www root
          Capacitor.convertFileSrc("assets/sounds/send-success.mp3"), // Capacitor URL conversion
          Capacitor.convertFileSrc("/assets/sounds/send-success.mp3"), // Capacitor URL with leading slash
        ];
      }

      for (const path of paths) {
        try {
          console.log("[NativeAudio] trying preload path:", path);
          await NativeAudio.preload({
            assetId: "send-success",
            assetPath: path,
            audioChannelNum: 1,
            volume: 1.0,
            isUrl:
              $q.platform.is.ios &&
              (path.startsWith("http") || path.startsWith("capacitor")),
          });
          // Store the successful path for later use
          successfulAudioPath.value = path;
          console.log("[NativeAudio] preload success with path:", path);
          return; // Success, exit
        } catch (error) {
          console.warn("[NativeAudio] preload failed for path:", path, error);
        }
      }
      throw new Error("All audio preload attempts failed");
    }

    async function playSound(success) {
      console.log("[NativeAudio] playSound called, success:", success);
      if (!success) return;

      // Only allow audio for new-transaction views.
      // Prevents preloading/playing from interrupting background audio on iOS
      // when viewing older transactions.
      if (!wasNewTransaction.value) return;

      // Respect DND/silent mode on native platforms
      if (Capacitor.isNativePlatform()) {
        try {
          const { isSilentOrDnd } = await AudioMode.isSilentOrDnd();
          if (isSilentOrDnd) {
            console.log(
              "[NativeAudio] skipping sound - device is in silent/DND mode"
            );
            return;
          }
        } catch (e) {
          console.warn("[NativeAudio] could not check audio mode:", e);
        }
      }

      try {
        // Ensure audio is preloaded before playing
        if (!audioPreloaded.value) {
          console.log("[NativeAudio] audio not preloaded, preloading...");
          await preloadAudio();
          audioPreloaded.value = true;
        }

        console.log("[NativeAudio] calling play()");
        await NativeAudio.play({
          assetId: "send-success",
        });
        console.log("[NativeAudio] play() completed");
      } catch (error) {
        console.error("[NativeAudio] play error:", error);
        // Try to preload and play again (non-blocking)
        preloadAudio()
          .then(() => {
            audioPreloaded.value = true;
            return NativeAudio.play({ assetId: "send-success" });
          })
          .catch(() => {
            // Ignore retry errors
          });
      }
    }

    const confettiTriggered = ref(false);
    // Capture new-transaction flag at mount time so query-param changes
    // (e.g. router.replace that strips ?new=true) cannot suppress it.
    const wasNewTransaction = ref(false);

    function launchConfettiIfNew() {
      if (!wasNewTransaction.value || confettiTriggered.value) return;
      confettiTriggered.value = true;

      // Wait for Vue DOM flush, then two paint cycles to guarantee
      // the transaction details are actually visible on screen before
      // drawing confetti over them.
      nextTick(() => {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => launchConfettiVisuals());
        });
      });
    }

    watch(
      () => !!transaction.value && !isLoading.value,
      (ready) => {
        if (ready) {
          launchConfettiIfNew();
        }
      },
      { immediate: true }
    );

    // Fallback: if the watch somehow misses the state transition,
    // try again after every DOM update.
    onUpdated(() => {
      if (!!transaction.value && !isLoading.value) {
        launchConfettiIfNew();
      }
    });

    // Reset the one-shot flag when the txid changes so the component
    // can trigger confetti again if Vue Router re-uses this instance.
    watch(
      () => route.params.txid || props.txid,
      (newTxid, oldTxid) => {
        if (newTxid !== oldTxid) {
          confettiTriggered.value = false;
          const query = route.query || {};
          wasNewTransaction.value = (
            query.new === "true" ||
            (typeof query.category === "string" &&
              query.category.includes("?new=true")) ||
            (window.location.search &&
              window.location.search.includes("new=true"))
          );
        }
      }
    );

    async function launchConfettiVisuals() {
      console.log(
        "[TransactionDetail] launchConfettiVisuals called, platform is iOS:",
        $q.platform.is.ios
      );

      // Play sound for new transaction (non-blocking - don't wait for it)
      // Ensure audio is ready by waiting for next frame (allows preload to complete)
      requestAnimationFrame(() => {
        playSound(true).catch(() => {
          // Ignore sound errors
        });
      });

      // One more RAF to be absolutely sure the browser has painted
      // the transaction details before we draw over them.
      await new Promise((resolve) => requestAnimationFrame(resolve));

      try {
        await confetti({
          particleCount: 100,
          spread: 70,
          origin: { x: 0.5, y: 0.4 },
          startVelocity: 55,
          gravity: 0.8,
          decay: 0.9,
          scalar: 0.8,
          colors: [
            '#ff6b6b',
            '#4ecdc4',
            '#45b7d1',
            '#f9ca24',
            '#6c5ce7',
            '#a29bfe',
            '#fd79a8',
            '#fdcb6e',
          ],
        });
        console.log('[TransactionDetail] Confetti launched successfully');
      } catch (error) {
        console.error('[TransactionDetail] Error launching confetti:', error);
      }
    }

    // Helper function to delay execution (for exponential backoff)
    function delay(ms) {
      return new Promise((resolve) => setTimeout(resolve, ms));
    }

    // Core function to search for transaction
    async function searchTransaction(txid) {
      return walletStore.walletObj.getTransactionById(txid);
    }

    async function fetchTransaction(forceServerFetch = false) {
      const txid = route.params.txid || props.txid;
      console.log('[TransactionDetail] fetchTransaction called', {
        txid,
        routeParamsTxid: route.params.txid,
        propsTxid: props.txid,
        walletHash: walletStore.walletHash ? 'present' : 'missing',
        walletObj: walletStore.walletObj ? 'present' : 'missing'
      });
      if (!txid) {
        loadError.value = t("Transaction ID is required");
        console.log('[TransactionDetail] No txid, setting loadError');
        return;
      }

      if (!walletStore.walletHash || !walletStore.walletObj) {
        loadError.value = t("Wallet not initialized");
        console.log('[TransactionDetail] Wallet not initialized, setting loadError');
        return;
      }

      // Check for preloaded transaction from websocket first
      const websocketTx = preloadedTransaction.value;
      if (websocketTx && websocketTx.txid === txid && !forceServerFetch) {
        transaction.value = websocketTx;
        isLoading.value = false;
        fetchTransaction(true).catch(() => {});
        return;
      }

      // Only set loading state if we don't already have transaction data (not a background refresh)
      if (!forceServerFetch) {
        isLoading.value = true;
      }
      loadError.value = null;

      const maxRetries = 7;
      const websocketFallbackAfterRetries = 2; // Use websocket data after 2 retries
      let retryCount = 0;
      let lastError = null;

      while (retryCount <= maxRetries) {
        try {
          const foundTx = await searchTransaction(txid);

          if (foundTx) {
            transaction.value = foundTx;
            isLoading.value = false;
            return;
          }

          // Transaction not found - check if we should use websocket data as fallback
          if (
            retryCount >= websocketFallbackAfterRetries &&
            websocketTx &&
            websocketTx.txid === txid
          ) {
            // Use websocket data after 2 retries if transaction not found in server
            console.log(
              "Transaction not found in server after retries, using websocket data"
            );
            transaction.value = websocketTx;
            isLoading.value = false;
            return;
          }

          // Continue retrying if we haven't reached max retries
          if (retryCount < maxRetries) {
            const backoffDelay = Math.min(
              1000 * Math.pow(2, retryCount),
              30000
            ); // Cap at 30 seconds
            await delay(backoffDelay);
            retryCount++;
            continue;
          } else {
            // All retries exhausted, check websocket data one more time
            if (websocketTx && websocketTx.txid === txid) {
              console.log(
                "Transaction not found in server, using websocket data as fallback"
              );
              transaction.value = websocketTx;
              isLoading.value = false;
              return;
            }
            // No websocket data available either
            // Only set error if this is not a background refresh
            if (!forceServerFetch) {
              loadError.value = t("Transaction not found");
            }
            isLoading.value = false;
            return;
          }
        } catch (error) {
          console.error(
            `Error fetching transaction (attempt ${retryCount + 1}/${
              maxRetries + 1
            }):`,
            error
          );
          lastError = error;

          // If we've exhausted all retries, try websocket data as fallback
          if (retryCount >= maxRetries) {
            if (websocketTx && websocketTx.txid === txid) {
              console.log(
                "Error fetching transaction, using websocket data as fallback"
              );
              transaction.value = websocketTx;
              isLoading.value = false;
              return;
            }
            // Only set error if this is not a background refresh
            if (!forceServerFetch) {
              loadError.value = t("Failed to load transaction");
            }
            isLoading.value = false;
            return;
          }

          // Retry with exponential backoff
          const backoffDelay = Math.min(1000 * Math.pow(2, retryCount), 30000); // Cap at 30 seconds
          await delay(backoffDelay);
          retryCount++;
        }
      }

      // Fallback (shouldn't reach here, but just in case)
      if (!transaction.value) {
        if (websocketTx && websocketTx.txid === txid) {
          transaction.value = websocketTx;
        } else if (!forceServerFetch) {
          // Only set error if this is not a background refresh
          loadError.value = lastError
            ? t("Failed to load transaction")
            : t("Transaction not found");
        }
      }
      isLoading.value = false;
    }

    function goBack() {
      // Navigate to home page and reload
      window.location.href = "/";
    }

    onMounted(async () => {
      try {
      // Capture the new-transaction flag once at mount time.
      // Query params may be stripped later (e.g. by router.replace),
      // but we still want confetti/audio for this initial view.
      const query = route.query || {};
      wasNewTransaction.value = (
        query.new === "true" ||
        (typeof query.category === "string" &&
          query.category.includes("?new=true")) ||
        (window.location.search &&
          window.location.search.includes("new=true"))
      );
      console.log('[TransactionDetail] wasNewTransaction:', wasNewTransaction.value);

      // Only preload audio for new transactions.
      // iOS audio preload can interrupt other apps' background audio.
      // Don't block on audio errors - confetti should still work.
      if (wasNewTransaction.value && Capacitor.isNativePlatform()) {
        preloadAudio()
          .then(() => {
            audioPreloaded.value = true;
          })
          .catch(() => {
            audioPreloaded.value = false;
          });
      }

      // Check for preloaded transaction first (from websocket)
      if (preloadedTransaction.value) {
        transaction.value = preloadedTransaction.value;
        isLoading.value = false;
        fetchTransaction(true).catch(() => {});
        return;
      }

      // Otherwise fetch the transaction with retries
      fetchTransaction().catch(() => {});
    } catch (error) {
      console.error("[TransactionDetail] Error in onMounted:", error);
      isLoading.value = false;
      if (!loadError.value) {
        loadError.value = t("Failed to load transaction");
      }
    }
  });

    onUnmounted(async () => {
      // Unload sound (only if we preloaded/used it)
      if (audioPreloaded.value) {
        try {
          await NativeAudio.unload({
            assetId: "send-success",
          });
        } catch (error) {
          // Silently fail if unload doesn't work
        }
      }
    });

    const isDarkMode = computed(() => $q.dark.isActive);

    // Safe area padding for iOS and Android status bar
    // Only add safe-area inset, the base 1rem padding is already in CSS
    const headerPaddingStyle = computed(() => {
      if ($q.platform.is.ios || $q.platform.is.android) {
        return "padding-top: calc(1rem + constant(safe-area-inset-top)); padding-top: calc(1rem + env(safe-area-inset-top));";
      }
      return "";
    });

    return {
      isDarkMode,
      headerPaddingStyle,
      transaction,
      loadError,
      isLoading,
      displayTxid,
      displayAmount,
      displayTokenCurrency,
      displayFiatAmount,
      displayFiatCurrency,
      displayLogo,
      displayDate,
      displayMerchantName,
      displayPosName,
      displaySenders,
      explorerLink,
      concatenate,
      copyText,
      hexToRef,
      onImgErrorIpfsSrc,
      goBack,
      formatNumberAutoDecimals,
      formatNumberWithDecimals,
    };
  },
});
</script>
<style lang="scss" scoped>
.transaction-detail-page {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
  justify-content: flex-start;
  align-items: stretch;

  &.bg-brandwhite {
    background-color: $brandlight !important;
  }

  &.bg-dark-page {
    background-color: $dark-page !important;

    .txid-container {
      background: rgba(255, 255, 255, 0.1);

      &:hover {
        background: rgba(255, 255, 255, 0.15);
      }
    }
  }
}

.transaction-header {
  display: flex;
  align-items: center;
  padding: 1rem;

  .back-btn {
    color: $brandblue;
    padding: 0.5rem;
  }

  .header-title {
    flex: 1;
    text-transform: uppercase;
    margin-right: 48px; // Balance for back button
  }
}

.error-container {
  text-align: center;
  padding: 2rem;
  min-height: 200px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;

  .error-text {
    margin-bottom: 1rem;
    color: $brandblue;
    font-size: 1.1rem;
  }
}

.body--dark .error-container {
  background-color: $dark-page;

  .error-text {
    color: white;
  }
}

.transaction-content {
  padding: 1.5rem;
  max-width: 600px;
  margin: 0 auto;
}

.direction-icon-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 1.5rem;

  .direction-icon {
    width: 56px;
    height: 56px;
    border-radius: 50%;
    background: $brandblue;
    color: white;
    font-size: 30px;
    padding: 12px;
    box-sizing: border-box;
  }
}

.amount-section {
  text-align: center;
  margin-bottom: 2rem;

  .amount-row {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 0.75rem;
    margin-bottom: 0;

    .amount-avatar {
      background: rgba(255, 255, 255, 0.1);
    }
  }
}

.reference-id-section {
  text-align: center;
  margin-bottom: 1.5rem;
}

.transaction-id-section {
  text-align: center;
  margin-bottom: 1.5rem;

  .txid-container {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
    border-radius: 8px;
    padding: 0.75rem 1rem;
    margin: 0.5rem 0;
    cursor: pointer;
    transition: background-color 0.2s;
    background: rgba(0, 0, 0, 0.05);

    &:hover {
      background: rgba(0, 0, 0, 0.1);
    }

    .txid-text {
      font-family: monospace;
    }

    .copy-icon {
      color: $brandblue;
    }
  }

  .explorer-link {
    display: flex;
    align-items: center;
    justify-content: center;
    color: $brandblue;
    text-decoration: none;
    margin-top: 0.75rem;
    transition: opacity 0.2s;

    &:hover {
      opacity: 0.8;
    }
  }
}

.date-section {
  text-align: center;
  margin-top: 1rem;
}
</style>
