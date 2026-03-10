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
          icon="key"
          :label="$t('ViewEncryptionKey', 'View Encryption Key')"
          class="link-button"
          @click="encryptionKeyPrompt()"
        />

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
  <q-dialog v-model="showEncryptionKeyDialog">
    <q-card style="min-width: 500px; max-width: 90vw">
      <q-card-section>
        <div class="text-h6">{{ $t("EncryptionKey", "Encryption Key") }}</div>
        <div class="row justify-center">
          <QRCode
            v-if="encryptionPublicKey"
            :text="encryptionPublicKey"
            :size="200"
            class="q-mt-md"
          />
        </div>
        <q-input
          v-model="encryptionPublicKey"
          label="Encryption Public Key"
          readonly
          outlined
          class="q-mt-md"
        >
        <template #append>
          <q-btn
            flat
            color="primary"
            icon="content_copy"
            @click="copyToClipboard(encryptionPublicKey, $t('EncryptionKeyCopied', 'Encryption key copied to clipboard'))"
          />
        </template>
        </q-input>
      </q-card-section>
      <q-card-actions align="right">
        <q-btn flat @click="showEncryptionKeyDialog = false" :label="$t('Close')" />
      </q-card-actions>
    </q-card>
  </q-dialog>
</template>
<script>
import Watchtower from "watchtower-cash-js";
import { useWalletStore } from "stores/wallet";
import { useAddressesStore } from "src/stores/addresses";
import { aes, getPubkeyAt } from "src/wallet/utils";
import QRCodeReader from "src/components/QRCodeReader.vue";
import { Device } from "@capacitor/device";
import { defineComponent, ref } from "vue";
import { useI18n } from "vue-i18n";
import { useQuasar, copyToClipboard as qCopyToClipboard } from "quasar";
import { getEncryptionKeypair, getOrGenerateEncryptionKeypair } from "src/nfc/keypair";
import QRCode from "vue-qrcode-component";
import { decryptWithPrivateKey } from "src/utils/ecies";
import { getPrivateKeyWif, savePrivateKeyWif } from "src/nfc/user";

export default defineComponent({
  components: {
    QRCodeReader,
    QRCode,
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
    const encryptionPublicKey = ref("");
    const showEncryptionKeyDialog = ref(false);
    let dialog;

    async function encryptionKeyPrompt() {
      const encryptionKeypair = await getOrGenerateEncryptionKeypair();
      const publicKey = encryptionKeypair.pubkey;
      encryptionPublicKey.value = publicKey;
      showEncryptionKeyDialog.value = true;
    }

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
        const skipDecryption = qrCodeData?.skip || false;

        if (!skipDecryption) {
          const encryptedData = await retrieveLinkCodeData(qrCodeData);
          const { xpubkey, authPrivateKey } = await decryptData(qrCodeData.encryptKey, encryptedData);
          await savePrivateKeyWif(authPrivateKey);
          const verifyingPubkey = generateVerifyingPubkey(xpubkey, qrCodeData.nonce);
          const deviceInfo = await retrieveDeviceInfo();
          await redeemDeviceLinkCode({ qrCodeData, xpubkey, verifyingPubkey, deviceInfo });
        }
      } catch (error) {
        console.error(error);
        return;
      }

      addressesStore.fillAddressSets();
      emit("device-linked");

      dialog.update({
        title: t("DeviceLinked"),
        message: t("PosDeviceLinkedSuccessfully"),
      });
      dialog.update({ persistent: false, progress: false })
    }

    function parseLinkCode(value) {
      let linkCode = "";
      try {
        let url = new URL(value);
        linkCode = url.searchParams.get("code") || "";
      } catch (error) {
        console.error(error);
        linkCode = value;
      }

      try {
        return atob(linkCode);
      } catch (error) {
        console.error(error);
        throw new Error(error);
      }
    }

    function decodeLinkContent(content) {
      try {
        dialog.update({ message: t("DecodingContent") });
        const decodedContent = JSON.parse(content);
        const code = decodedContent.code;
        const encryptKey = decodedContent.encryptKey;
        const nonce = decodedContent.nonce;
        return { code, encryptKey, nonce };
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

    async function decryptData(encryptKey, encryptedData) {
      try {
        dialog.update({ message: t("DecryptingXpubkey") });
        const encryptionKeypair = await getEncryptionKeypair()
        const decryptKey = encryptionKeypair?.privkey
        const result = JSON.parse(decryptWithPrivateKey(encryptedData, encryptKey, decryptKey));
        return { xpubkey: result.xpubkey, authPrivateKey: result.privateKey };
      } catch(error) {
        dialog.update({
          title: t("LinkDeviceError"),
          message: t("UnableToDecryptXpubkey"),
        });
        console.error(error);
        throw new Error(error);
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
        const deviceInfo = await Device.getInfo();
        deviceInfo.uuid = (await Device.getId())?.uuid;
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

    async function copyToClipboard(value, message = "") {
      const text = String(value || "");
      if (!text) return;

      const onCopySuccess = () => {
        $q.notify({
          message: message || t("CopiedToClipboard"),
          timeout: 800,
          icon: "mdi-clipboard-check",
          color: "blue-9",
        });
      };

      const onCopyError = () => {
        $q.notify({
          message: t("FailedToCopy") || "Failed to copy",
          timeout: 1200,
          icon: "error",
          color: "negative",
        });
      };

      try {
        await qCopyToClipboard(text);
        onCopySuccess();
        return;
      } catch (error) {
        console.error("Quasar clipboard copy failed", error);
      }

      if ($copyText) {
        try {
          await $copyText(text);
          onCopySuccess();
          return;
        } catch (error) {
          console.error("vue-clipboard2 copy failed", error);
        }
      }

      onCopyError();
    }

    return {
      walletStore,
      encryptionPublicKey,
      showEncryptionKeyDialog,
      encryptionKeyPrompt,
      linkCodePrompt,
      toggleQrScanner,
      showQrScanner,
      linkToWallet,
      onQrDecode,
      onQrError,
      copyToClipboard
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
