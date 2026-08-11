<template>
  <div
    class="column items-center justify-center q-pt-lg"
    style="min-height: 80vh"
  >
    <q-img
      alt="Paytaca logo"
      src="~assets/paytaca-pos-icon.png"
      style="width: 250px; height: 250px"
    />
    <div
      :class="[
        'text-h4 text-center text-weight-medium',
        $q.dark.isActive ? '' : 'text-dark-page',
      ]"
      style="margin-top: -45px; letter-spacing: 0.18rem"
    >
      Paytaca<span class="q-ml-sm" style="font-weight: 575">POS</span>
    </div>
    <div v-if="displayLinkButton || !walletStore.walletHash" class="q-mt-lg">
      <div class="text-h6 text-weight-light text-center q-mb-md">
        {{ $t("LinkToWallet") }}
      </div>
      <div class="link-buttons-container">
        <q-btn
          unelevated
          color="primary"
          icon="mdi-link-variant"
          :label="$t('InputLink')"
          class="link-button"
          @click="linkCodePrompt()"
        />

        <q-btn
          unelevated
          color="primary"
          icon="mdi-qrcode-scan"
          :label="$t('Scan')"
          class="link-button"
          @click="toggleQrScanner"
        />
      </div>
    </div>
  </div>
  <QRCodeReader
    v-model="showQrScanner"
    :text="$t('ScanQrCodeForWalletLink')"
    @decode="onQrDecode"
    @error="onQrError"
  />
</template>
<script>
import Watchtower from "watchtower-cash-js";
import { useWalletStore } from "stores/wallet";
import { useAddressesStore } from "src/stores/addresses";
import { aes, getPubkeyAt } from "src/wallet/utils";
import QRCodeReader from "src/components/QRCodeReader.vue";
import { getDeviceInfo, getDeviceId } from "src/utils/device";
import { defineComponent, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useQuasar } from "quasar";
export default defineComponent({
  components: {
    QRCodeReader,
  },
  emits: ["device-linked"],
  props: {
    displayLinkButton: Boolean,
  },
  setup(props, { emit }) {
    const $q = useQuasar();
    const { t } = useI18n();
    const watchtower = new Watchtower();

    const walletStore = useWalletStore();
    const addressesStore = useAddressesStore();
    let dialog;

    function linkCodePrompt() {
      $q.dialog({
        title: t("WalletLink"),
        message: t("InputWalletLinkCode"),
        prompt: { outlined: true },
        // ok: { color: 'brandblue', flat: true },
        position: "bottom",
        color: "brandblue",
      }).onOk((data) => {
        if (data) onQrDecode(data);
      });
    }

    const showQrScanner = ref(false);
    function toggleQrScanner() {
      showQrScanner.value = !showQrScanner.value;
    }

    function onQrError(error) {
      $q.notify({
        type: "negative",
        message: t("QrScannerError"),
        caption: typeof error === "string" ? error : "",
      });
    }

    function linkToWallet(content = "") {
      return onQrDecode(content);
    }

    async function onQrDecode(content = "") {
      showQrScanner.value = false;
      dialog = $q.dialog({
        title: t("LinkDevice"),
        message: t("LinkingDevice"),
        persistent: true,
        progress: true,
        color: "brandblue",
      });

      try {
        const parsedLinkCode = parseLinkCode(content);
        const qrCodeData = decodeLinkContent(parsedLinkCode);
        const encryptedData = await retrieveLinkCodeData(qrCodeData);
        const xpubkey = await decryptData(qrCodeData.decryptKey, encryptedData);
        const verifyingPubkey = generateVerifyingPubkey(xpubkey, qrCodeData.nonce);
        const deviceInfo = await retrieveDeviceInfo();
        await redeemDeviceLinkCode({ qrCodeData, xpubkey, verifyingPubkey, deviceInfo });
      } catch (error) {
        console.error(error);
        dialog.update({
          title: t("LinkDeviceError"),
          message: error?.message || t("UnableToDecodeQrData"),
        });
        dialog.update({ persistent: false, progress: false });
        return;
      }

      localStorage.setItem('debugIconVisible', 'false');

      addressesStore.fillAddressSets();
      emit("device-linked");

      dialog.update({
        title: t("DeviceLinked"),
        message: t("PosDeviceLinkedSuccessfully"),
      });
      dialog.update({ persistent: false, progress: false })
    }

    function parseLinkCode(value) {
      if (!value || typeof value !== 'string') {
        throw new Error('Link code is empty');
      }

      const trimmed = value.trim();

      // If it looks like JSON, return it directly
      if ((trimmed.startsWith('{') && trimmed.endsWith('}')) || (trimmed.startsWith('[') && trimmed.endsWith(']'))) {
        return trimmed;
      }

      let linkCode = '';
      try {
        const url = new URL(trimmed);
        linkCode = url.searchParams.get('code') || '';
      } catch (_) {
        // Not a URL, treat the whole value as the code
        linkCode = trimmed;
      }

      if (!linkCode) {
        throw new Error('No code found in link URL');
      }

      try {
        // Support both standard base64 and base64url (replace URL-safe chars and fix padding)
        let normalized = linkCode.replace(/-/g, '+').replace(/_/g, '/');
        const padding = normalized.length % 4;
        if (padding) {
          normalized += '='.repeat(4 - padding);
        }
        return atob(normalized);
      } catch (error) {
        console.error(error);
        throw new Error('Invalid link code format');
      }
    }

    function decodeLinkContent(content) {
      try {
        dialog.update({ message: t("DecodingContent") });
        const decodedContent = JSON.parse(content);
        const code = decodedContent.code;
        const decryptKey = {
          password: decodedContent.decryptKey.split(".")[0],
          iv: decodedContent.decryptKey.split(".")[1],
        };
        const nonce = decodedContent.nonce;
        return { code, decryptKey, nonce };
      } catch (error) {
        dialog.update({
          title: t("LinkDeviceError"),
          message: t("UnableToDecodeQrData"),
        });
        console.error(error);
        throw new Error(error);
      }
    }

    async function retrieveLinkCodeData(qrCodeData) {
      try {
        dialog.update({ message: t("RetrievingLinkCodeData") });
        const response = await watchtower.BCH._api.get(
          `paytacapos/devices/link_code_data/`,
          { params: { code: qrCodeData.code } }
        );
        return response?.data;
      } catch(error) {
        let message = t("LinkCodeDataInvalid");
        if (error?.response?.status === 400)
          message = t("LinkCodeDataNotFound");
        dialog.update({ title: t("LinkDeviceError"), message: message });
        console.error(error.response || error);
        throw new Error(error);
      }
    }

    async function decryptData(decryptKey, encryptedData) {
      try {
        dialog.update({ message: t("DecryptingXpubkey") });
        return aes.decrypt(encryptedData, decryptKey.password, decryptKey.iv);
      } catch(error) {
        dialog.update({
          title: t("LinkDeviceError"),
          message: t("UnableToDecryptXpubkey"),
        });
        console.error(error);
        throw error instanceof Error ? error : new Error(String(error));
      }
    }

    function generateVerifyingPubkey(xpubkey, nonce) {
      try {
        dialog.update({ message: t("GeneratingVerifyingXpubkey") });
        const verifyingPubkey = getPubkeyAt(xpubkey, nonce);
        return verifyingPubkey
      } catch(error) {
        dialog.update({
          title: t("LinkDeviceError"),
          message: "Unable to generate verifying pubkey",
        });
        console.error(error);
        throw new Error(error);
      }
    }

    async function retrieveDeviceInfo() {
      try {
        dialog.update({ persistent: true, progress: true, message: "Retrieving device information" });
        const deviceInfo = await getDeviceInfo();
        deviceInfo.uuid = await getDeviceId();
        return deviceInfo;
      } catch(error) {
        dialog.update({
          title: t("LinkDeviceError"),
          message: t("FailedToRetrieveDeviceInformation"),
        });
        console.error(error);
        throw new Error(error);
      }
    }

    async function redeemDeviceLinkCode({
      qrCodeData,
      xpubkey,
      verifyingPubkey,
      deviceInfo,
    }) {
      try {
        dialog.update({ message: t("UpdatingServer") });
        const data = {
          link_code: qrCodeData.code,
          verifying_pubkey: verifyingPubkey,
          name: deviceInfo?.name,
          device_model: deviceInfo?.model,
          os: deviceInfo?.operatingSystem,
          device_id: deviceInfo?.uuid,
        };
        const response = await watchtower.BCH._api.post(
          "paytacapos/devices/redeem_link_device_code/",
          data
        );
        walletStore.$patch((walletStoreState) => {
          if (response?.data?.wallet_hash) {
            walletStoreState.walletHash = response?.data?.wallet_hash;
            walletStoreState.xPubKey = xpubkey;
            walletStoreState.posId = Number(response?.data?.posid);
            walletStoreState.linkCode = data.link_code;
          }
        });
      } catch(error) {
        let message = t("FailedToUpdateServer");
        if (
          Array.isArray(error?.response?.data?.non_field_errors) &&
          error?.response?.data?.non_field_errors?.length
        ) {
          message = error?.response?.data?.non_field_errors.join("<br/>");
        }
        dialog.update({
          title: t("LinkDeviceError"),
          message: message,
          html: true,
        });
        console.error(error.response || error);
        throw new Error(error);
      }
    }

    return {
      walletStore,
      linkCodePrompt,
      toggleQrScanner,
      showQrScanner,
      linkToWallet,
      onQrDecode,
      onQrError,
    };
  },
});
</script>

<style lang="scss" scoped>
.link-buttons-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
  width: 100%;
  max-width: 320px;
  margin: 0 auto;
  padding: 0 16px;
}

.link-button {
  width: 100%;
  padding: 14px 20px;
  border-radius: 12px;
  font-size: 15px;
  font-weight: 500;
  letter-spacing: 0.02em;
}
</style>
