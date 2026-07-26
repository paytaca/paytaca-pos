<template>
  <q-page class="static-qr-page">
    <q-btn
      flat
      round
      icon="arrow_back"
      class="back-btn"
      @click="$router.push({ name: 'settings' })"
    />
    <div class="standee" ref="standeeRef">
      <div class="standee__inner">
        <div class="standee__header">
          <div class="standee__store-name">{{ merchantName }}</div>
        </div>

        <div class="standee__divider"></div>

        <div class="standee__subtitle">{{ $t('ScanToPayWithBCH') }}</div>

        <div v-if="loading" class="standee__loading">
          <q-spinner size="40px" color="primary" />
        </div>

        <template v-else>
          <div class="standee__qr">
            <QRCode
              :text="qrData"
              color="#000"
              :size="260"
              error-level="H"
            />
            <div class="standee__qr-overlay">
              <img src="/bch-logo.png" alt="BCH" height="28" />
            </div>
          </div>

          <div class="standee__address">
            <span class="standee__address-text">{{ receivingAddress }}</span>
          </div>

          <div class="standee__brand">
            <img src="/paytaca-logo.png" alt="Paytaca" class="standee__brand-logo" />
          </div>
        </template>
      </div>
    </div>

    <div class="standee__actions">
            <q-btn
              outline
              no-caps
              color="primary"
              icon="download"
              :label="$t('SaveImage')"
              :loading="saving"
              @click="saveAsImage"
            />
            <q-btn
              outline
              no-caps
              color="primary"
              :label="$t('Regenerate')"
              @click="regenerateAddress"
              class="q-ml-sm"
            />
          </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, computed, onMounted, nextTick } from 'vue'
import { useWalletStore } from 'stores/wallet'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import QRCode from 'vue-qrcode-component'
import html2canvas from 'html2canvas'
import SaveToGallery from 'src/utils/save-to-gallery'

export default defineComponent({
  name: 'StaticQR',
  components: { QRCode },
  setup() {
    const $q = useQuasar()
    const { t } = useI18n()
    const walletStore = useWalletStore()

    const receivingAddress = ref('')
    const loading = ref(true)
    const saving = ref(false)
    const standeeRef = ref(null)
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

    async function saveAsImage() {
      saving.value = true
      try {
        await nextTick()
        const el = standeeRef.value
        if (!el) return

        const canvas = await html2canvas(el, {
          backgroundColor: '#ffffff',
          scale: 3,
          logging: false,
          useCORS: true,
          allowTaint: true,
        })

        const base64Data = canvas.toDataURL('image/png').split(',')[1]
        const filename = `paytaca-pos-qr-${Date.now()}.png`

        await SaveToGallery.saveImage({ base64Data, filename })

        $q.notify({ type: 'positive', message: t('ImageSaved') })
      } catch (err) {
        console.error('[StaticQR] Error saving image:', err)
        $q.notify({ type: 'negative', message: t('ErrorSavingImage') })
      } finally {
        saving.value = false
      }
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
      saving,
      standeeRef,
      merchantName,
      qrData,
      saveAsImage,
      printPage,
      regenerateAddress,
    }
  },
})
</script>

<style lang="scss" scoped>
.static-qr-page {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 24px 16px;
  padding-top: calc(24px + constant(safe-area-inset-top));
  padding-top: calc(24px + env(safe-area-inset-top));
  padding-bottom: calc(24px + constant(safe-area-inset-bottom));
  padding-bottom: calc(24px + env(safe-area-inset-bottom));
  min-height: 100vh;
  position: relative;
}

.back-btn {
  position: absolute;
  top: calc(8px + constant(safe-area-inset-top));
  top: calc(8px + env(safe-area-inset-top));
  left: 8px;
  z-index: 10;
}

.standee {
  width: 100%;
  max-width: 400px;
  aspect-ratio: 9 / 16;
  margin-top: 16px;

  .standee__inner {
    background: #fff;
    border: 2px solid #e0e0e0;
    border-radius: 20px;
    padding: 28px 24px 20px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.08);
    display: flex;
    flex-direction: column;
    align-items: center;
    height: 100%;
    box-sizing: border-box;
  }

  .standee__header {
    text-align: center;
  }

  .standee__store-name {
    font-size: 22px;
    font-weight: 700;
    color: #222;
  }

  .standee__divider {
    width: 48px;
    height: 3px;
    background: #333;
    margin: 12px 0;
    border-radius: 2px;
  }

  .standee__subtitle {
    font-size: 14px;
    font-weight: 500;
    color: #666;
    margin-top: 8px;
    margin-bottom: 20px;
    text-align: center;
  }

  .standee__loading {
    padding: 60px 0;
  }

  .standee__qr {
    position: relative;
    display: flex;
    justify-content: center;
    align-items: center;
    padding: 20px;
    background: #fafafa;
    border-radius: 16px;
    margin-bottom: 16px;
  }

  .standee__qr-overlay {
    position: absolute;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: #fff;
    border-radius: 50%;
    padding: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .standee__address {
    padding: 10px 14px;
    background: #f5f5f5;
    border-radius: 8px;
    border: 1px solid #eee;
    max-width: 100%;
    width: 100%;
    box-sizing: border-box;
    text-align: center;
    margin-bottom: auto;
  }

  .standee__address-text {
    font-size: 12px;
    font-family: monospace;
    color: #444;
    word-break: break-all;
    line-height: 1.5;
  }

  .standee__brand {
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px 0 4px;
  }

  .standee__brand-logo {
    height: 72px;
    width: auto;
    object-fit: contain;
  }
}

.standee__actions {
  display: flex;
  align-items: center;
  justify-content: center;
  padding-top: 16px;
  flex-wrap: wrap;
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
    max-height: 70vh;
    aspect-ratio: 9 / 16;
    display: flex;
    align-items: center;
    justify-content: center;
    .standee__inner {
      box-shadow: 0 1px 4px rgba(0, 0, 0, 0.1);
      padding: 24px 20px;
      height: 100%;
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
      border-radius: 14px;
      pointer-events: none;
    }
    .standee__subtitle {
      display: none;
    }
    .standee__divider {
      display: none;
    }
    .standee__header {
      display: none;
    }
    .standee__brand-logo {
      opacity: 1;
    }
  }
  .standee__actions {
    display: none;
  }
}
</style>
