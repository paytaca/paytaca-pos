<template>
  <q-page class="static-qr-page">
    <q-btn
      flat
      round
      icon="arrow_back"
      class="back-btn"
      @click="$router.push({ name: 'settings' })"
    />
    <div class="standee">
      <div class="standee__inner">
        <div class="standee__header">
          <div class="standee__store-name">{{ merchantName }}</div>
        </div>

        <div class="standee__divider"></div>

        <div class="standee__title">{{ $t('ScanToPayWithBCH') }}</div>

        <div v-if="loading" class="standee__loading">
          <q-spinner size="40px" color="primary" />
        </div>

        <template v-else>
          <div class="standee__qr">
            <QRCode
              :text="qrData"
              color="#000"
              :size="280"
              error-level="H"
            />
            <div class="standee__qr-icon">
              <img src="/bch-logo.png" alt="BCH" height="32" />
            </div>
          </div>

          <div class="standee__address" @click="copyAddress">
            <span class="standee__address-text">{{ receivingAddress }}</span>
            <q-icon name="content_copy" size="16px" class="q-ml-xs" />
          </div>

          <div class="standee__hint">{{ $t('CopyAddressOrScanQR') }}</div>

          <div class="standee__print-logo">
            <img src="/paytaca-logo.png" alt="Paytaca" class="standee__print-logo-img" />
          </div>

          <div class="standee__footer">
            <q-btn
              unelevated
              no-caps
              color="primary"
              icon="print"
              :label="$t('Print')"
              @click="printPage"
            />
            <q-btn
              flat
              no-caps
              :label="$t('Regenerate')"
              @click="regenerateAddress"
              class="q-ml-sm"
            />
          </div>
        </template>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted } from 'vue'
import { useWalletStore } from 'stores/wallet'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import QRCode from 'vue-qrcode-component'

export default defineComponent({
  name: 'StaticQR',
  components: { QRCode },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const walletStore = useWalletStore()

    const receivingAddress = ref('')
    const loading = ref(true)
    const index = ref(Math.floor(Math.random() * 100000) + 1)

    const merchantName = computed(() => {
      return walletStore.merchantInfo?.name || 'Paytaca POS'
    })

    const qrData = computed(() => {
      if (!receivingAddress.value) return ''
      return receivingAddress.value
    })

    async function generateAddress() {
      loading.value = true
      try {
        const wallet = walletStore.walletObj
        if (!wallet) {
          $q.notify({ type: 'negative', message: t('WalletNotReady') })
          return
        }
        index.value = Math.floor(Math.random() * 100000) + 1
        const addressSet = await wallet.generateReceivingAddress(index.value, { skipSubscription: false })
        if (addressSet) {
          receivingAddress.value = addressSet.receiving
        }
      } catch (err) {
        console.error('[StaticQR] Error generating address:', err)
        $q.notify({ type: 'negative', message: t('ErrorGeneratingAddress') })
      } finally {
        loading.value = false
      }
    }

    function copyAddress() {
      if (!receivingAddress.value) return
      $q.copyText({
        text: receivingAddress.value,
        done() {
          $q.notify({ type: 'positive', message: t('CopiedToClipboard') })
        }
      })
    }

    function printPage() {
      window.print()
    }

    function regenerateAddress() {
      generateAddress()
    }

    onMounted(() => {
      generateAddress()
    })

    return {
      receivingAddress,
      loading,
      merchantName,
      qrData,
      copyAddress,
      printPage,
      regenerateAddress,
    }
  },
})
</script>

<style lang="scss" scoped>
.static-qr-page {
  display: flex;
  justify-content: center;
  align-items: flex-start;
  padding: 24px 16px;
  min-height: 100vh;
  position: relative;
}

.back-btn {
  position: absolute;
  top: 8px;
  left: 8px;
  z-index: 10;
}

.standee {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 9 / 16;

  .standee__inner {
    background: #fff;
    border: 2px solid #e0e0e0;
    border-radius: 24px;
    padding: 32px 24px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    box-sizing: border-box;
  }

  .standee__header {
    text-align: center;
    margin-bottom: 8px;
  }

  .standee__store-name {
    font-size: 22px;
    font-weight: 700;
    color: #222;
  }

  .standee__divider {
    width: 60px;
    height: 3px;
    background: #333;
    margin: 16px 0;
    border-radius: 2px;
  }

  .standee__title {
    font-size: 16px;
    font-weight: 600;
    color: #555;
    margin-bottom: 24px;
    text-align: center;
  }

  .standee__loading {
    padding: 60px 0;
  }

  .standee__qr {
    position: relative;
    display: flex;
    justify-content: center;
    margin-bottom: 20px;
    padding: 16px;
    background: #fafafa;
    border-radius: 16px;
  }

  .standee__qr-icon {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border-radius: 8px;
    padding: 4px;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .standee__address {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 12px 16px;
    background: #f5f5f5;
    border-radius: 8px;
    border: 1px solid #e0e0e0;
    cursor: pointer;
    max-width: 100%;
    transition: background 0.2s;

    &:hover {
      background: #eee;
    }
  }

  .standee__address-text {
    font-size: 13px;
    font-family: monospace;
    color: #333;
    word-break: break-all;
    line-height: 1.5;
  }

  .standee__hint {
    font-size: 12px;
    color: #999;
    margin-top: 8px;
  }

  .standee__footer {
    display: flex;
    gap: 8px;
    margin-top: 24px;
  }

  .standee__print-logo {
    display: none;
  }
}

@media print {
  @page {
    size: portrait;
    margin: 0;
  }
  body {
    -webkit-print-color-adjust: exact;
    print-color-adjust: exact;
  }
  .static-qr-page {
    padding: 0;
    align-items: center;
    min-height: 100vh;
  }
  .standee {
    max-width: 100vw;
    max-height: 100vh;
    aspect-ratio: 9 / 16;
    display: flex;
    align-items: center;
    justify-content: center;
    .standee__inner {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      padding: 24px 20px;
      height: auto;
      min-height: 90vh;
      position: relative;
    }
    .standee__inner::after {
      content: '';
      position: absolute;
      top: 8px;
      left: 8px;
      right: 8px;
      bottom: 8px;
      border: 1.5px dashed #ccc;
      border-radius: 18px;
      pointer-events: none;
    }
    .standee__footer {
      display: none;
    }
    .standee__hint {
      display: none;
    }
    .standee__print-logo {
      display: flex;
      align-items: center;
      justify-content: center;
      margin-top: auto;
      padding-top: 20px;
    }
    .standee__print-logo-img {
      height: 32px;
      width: auto;
      object-fit: contain;
    }
  }
}
</style>
