<template>
  <div v-show="innerVal" ref="scannerContainerRef" class="scanner-container">
    <q-btn
      icon="close"
      rounded
      padding="xs"
      size="25px"
      flat
      class="scanner-close-btn"
      :style="{
        'margin-top':
          'calc(20px + constant(safe-area-inset-top)); margin-top: calc(20px + env(safe-area-inset-top))',
      }"
      @click="stopScan"
    />
    <div class="scanner-box">
      <div class="scan-layout-design">
        <div class="scan-design1">
          <div class="line-design1"></div>
        </div>
        <div class="scan-design2">
          <div class="line-design2"></div>
        </div>
        <div class="scan-design3">
          <div class="line-design3"></div>
        </div>
        <div class="scan-design4">
          <div class="line-design4"></div>
        </div>
      </div>
      <span class="scanner-text text-center full-width">{{ text }}</span>
    </div>

    <qrcode-stream
      v-if="!isMobile && innerVal"
      @decode="onScannerDecode"
      @init="onScannerInit"
      :style="{
        position: 'absolute',
        inset: 0,
      }"
    />
  </div>
</template>

<script>
import { i18n } from "src/boot/i18n";
import {
  BarcodeScanner,
  SupportedFormat,
} from "@capacitor-community/barcode-scanner";
import { QrcodeStream } from "vue3-qrcode-reader";
import { useQuasar } from "quasar";
import { ref, computed, onBeforeUnmount, watch } from "vue";

const { t: $t } = i18n.global;

export default {
  components: { QrcodeStream },
  props: {
    modelValue: Boolean,
    text: {
      type: String,
      default: $t("ScanQrCode"),
    },
    toggle: Function,
  },
  emits: ["decode", "error", "update:modelValue"],
  setup(props, { emit: $emit }) {
    const $q = useQuasar();
    const errorMessage = ref(null);
    const innerVal = ref(props.modelValue);
    watch(
      () => [props.modelValue],
      () => (innerVal.value = props.modelValue)
    );
    watch(innerVal, () => $emit("update:modelValue", innerVal.value));

    const isMobile = computed(() => {
      return (
        $q.platform.is.mobile || $q.platform.is.android || $q.platform.is.ios
      );
    });

    watch(innerVal, () => {
      if (innerVal.value && isMobile.value) {
        prepareScanner();
      } else if (!innerVal.value) {
        stopScan();
      }
    });
    onBeforeUnmount(() => stopScan());

    function onScannerDecode(content) {
      $emit("decode", content);
    }

    function onScannerInit(promise) {
      promise
        .then(() => {
          errorMessage.value = "";
        })
        .catch((error) => {
          if (error.name === "NotAllowedError") {
            errorMessage.value = "Permission required to access to camera";
            // this.error = 'Hey! I need access to your camera'
          } else if (error.name === "NotFoundError") {
            errorMessage.value = "No camera found on this device";
            // this.error = 'Do you even have a camera on your device?'
          } else if (error.name === "NotSupportedError") {
            errorMessage.value =
              "Unable to acccess camera in non-secure context";
            // this.error = 'Seems like this page is served in non-secure context (HTTPS, localhost or file://)'
          } else if (error.name === "NotReadableError") {
            errorMessage.value = "Unable to access camera.";
            // this.error = 'Couldn\'t access your camera. Is it already in use?'
          } else if (error.name === "OverconstrainedError") {
            errorMessage.value =
              "Constraints don't match any installed camera. Did you ask for the front camera although there is none?";
          } else {
            errorMessage.value = "Unknown error: " + error.message;
          }

          if (errorMessage.value) {
            $emit("error", errorMessage.value);
          }
        });
    }

    async function prepareScanner() {
      const status = await checkPermission();
      if (status) {
        await BarcodeScanner.prepare({
          targetedFormats: [SupportedFormat.QR_CODE],
        });
        scanBarcode();
      } else {
        $emit("error", "Permission denied");
      }
    }

    async function checkPermission() {
      const status = await BarcodeScanner.checkPermission({ force: true });
      // console.log('PERMISSION STATUS: ', JSON.stringify(status))

      if (status.granted) {
        // user granted permission
        return true;
      }

      if (status.denied) {
        // user denied permission
        return false;
      }

      if (status.asked) {
        // system requested the user for permission during this call
        // only possible when force set to true
        BarcodeScanner.openAppSettings();
      }

      if (status.neverAsked) {
        // user has not been requested this permission before
        // it is advised to show the user some sort of prompt
        // this way you will not waste your only chance to ask for the permission
        // const c = confirm('We need your permission to use your camera to be able to scan QR codes')
        BarcodeScanner.openAppSettings();
      }

      if (status.restricted || status.unknown) {
        // ios only
        // probably means the permission has been denied
        return false;
      }

      // user has not denied permission
      // but the user also has not yet granted the permission
      // so request it
      const statusRequest = await BarcodeScanner.checkPermission({
        force: true,
      });
      // console.log('PERMISSION STATUS 2: ', JSON.stringify(statusRequest))

      if (statusRequest.asked) {
        // system requested the user for permission during this call
        // only possible when force set to true
        if (statusRequest.granted) {
          return true;
        } else {
          return false;
        }
      }

      if (statusRequest.granted) {
        // the user did grant the permission now
        return true;
      }

      // user did not grant the permission, so he must have declined the request
      return false;
    }

    async function scanBarcode() {
      await BarcodeScanner.hideBackground();
      adjustComponentsClasslist(true);

      const res = await BarcodeScanner.startScan({
        targetedFormats: [SupportedFormat.QR_CODE],
      });
      if (res.hasContent) $emit("decode", res.content);
      stopScan();
    }

    function stopScan() {
      BarcodeScanner.showBackground();
      BarcodeScanner.stopScan();
      adjustComponentsClasslist(false);

      innerVal.value = false;
      // if (this.$route?.name === 'transaction-send') this.$router.push({ path: '/send/select-asset' })
    }

    const scannerContainerRef = ref();
    function adjustComponentsClasslist(isScanning) {
      const appContainer = document.getElementById("q-app");
      const scannerUI = scannerContainerRef.value;
      const transparent = "transparent-body";
      const visibilityHidden = "visibility-hide";
      const visibilityVisible = "visibility-visible";
      const scannerActive = "scanner-container--active";

      if (!appContainer) console.warn("Qrscanner: App container DOM not found");
      if (!scannerUI) console.warn("Qrscanner: Scanner UI DOM not found");

      if (isScanning) {
        document.body.classList.add(transparent);
        appContainer?.classList?.add?.(visibilityHidden);
        scannerUI?.classList?.add?.(scannerActive);
        scannerUI?.classList?.add?.(visibilityVisible);
      } else {
        document.body.classList.remove(transparent);
        appContainer?.classList?.remove?.(visibilityHidden);
        scannerUI?.classList?.remove?.(visibilityVisible);
        scannerUI?.classList?.remove?.(scannerActive);
      }
    }

    return {
      innerVal,
      isMobile,
      onScannerDecode,
      onScannerInit,
      stopScan,

      scannerContainerRef,
    };
  },
};
</script>

<style>
.scanner-container {
  position: fixed;
  top: 0;
  bottom: 0;
  left: 0;
  right: 0;
  background: lightcoral;
  z-index: 2999;
  display: flex;
}
.scanner-container--active {
  background: transparent !important;
}
.scanner-close-btn {
  position: absolute;
  top: 0;
  right: 0;
  margin-right: 15px;
  color: #ef4f84;
  z-index: 2022;
}
.scanner-text {
  position: absolute;
  bottom: -30px;
  color: white;
  z-index: 3000;
}
.scanner-box {
  position: relative !important;
  display: flex !important;
  height: 220px !important;
  width: 220px !important;
  border-radius: 16% !important;
  box-shadow: 0px 0px 0px 1000px rgba(0, 0, 0, 0.6);
  vertical-align: middle;
  z-index: 2000 !important;
  align-self: center;
  margin-left: auto;
  margin-right: auto;
}
.hide-section {
  display: none !important;
}
.transparent-body {
  background: transparent !important;
}
.visibility-hide {
  visibility: hidden;
  width: 0;
  height: 0;
  margin: 0;
  padding: 0;
}
.visibility-visible {
  visibility: visible;
  position: fixed !important;
}
</style>
<style scoped>
.scan-design1 {
  position: absolute;
  height: 24px;
  width: 24px;
  left: 10px;
  top: 10px;
  overflow: hidden;
}
.line-design1 {
  height: 150px;
  width: 150px;
  border: 3px solid #3b7bf6;
  border-radius: 15%;
}
.scan-design2 {
  position: absolute;
  height: 24px;
  width: 24px;
  right: 10px;
  top: 10px;
  overflow: hidden;
}
.line-design2 {
  position: absolute;
  height: 150px;
  width: 150px;
  right: 0px;
  top: 0px;
  border: 3px solid #3b7bf6;
  border-radius: 15%;
}
.scan-design3 {
  position: absolute;
  height: 24px;
  width: 24px;
  right: 10px;
  bottom: 10px;
  overflow: hidden;
}
.line-design3 {
  position: absolute;
  height: 150px;
  width: 150px;
  right: 0px;
  bottom: 0px;
  border: 3px solid #3b7bf6;
  border-radius: 15%;
}
.scan-design4 {
  position: absolute;
  height: 24px;
  width: 24px;
  left: 10px;
  bottom: 10px;
  overflow: hidden;
}
.line-design4 {
  position: absolute;
  height: 150px;
  width: 150px;
  left: 0px;
  bottom: 0px;
  border: 3px solid #3b7bf6;
  border-radius: 15%;
}
</style>
