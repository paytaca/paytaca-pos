<template>
    <q-dialog v-model="showDialog" persistent>
        <q-card class="q-pb-md">
            <div v-if="step == 'notice'">
                <q-card-section class="row items-center q-gutter-md q-pa-lg">
                    <q-avatar icon="nfc" size="56px" class="bg-primary text-white" />
                    <div class="col">
                        <div class="text-h6"> Enable NFC Payments </div>
                        <div class="text-subtitle2">Enable NFC payments to make transactions faster and more convenient
                        </div>
                    </div>
                </q-card-section>
                <q-card-actions align="center">
                    <q-btn color="primary" @click="onStartSetup">Get Started</q-btn>
                    <q-btn flat @click="closeDialog">Close</q-btn>
                </q-card-actions>
            </div>
            <div v-if="step == 'encryption-key-transfer'">
                <q-card-section class="q-pa-lg">
                    <div class="text-h6">Encryption Keypair</div>
                    <div class="text-subtitle2 q-mt-sm">
                        Open Paytaca app, navigate to Apps > Merchant Admin.
                        <ol>
                            <li>Select the merchant you want to enable NFC payments for. </li>
                            <li>Create or select this POS device in the "POS Devices" section.</li>
                            <li>Tap on more options (three dots) and select "Enable NFC Payments".</li>
                            <li>Scan the QR code below, or copy the key and input it manually.</li>
                        </ol>
                    </div>
                    <div v-if="!loadingKeypair" class="row justify-center q-mt-md">
                        <div class="row">
                            <QRCode
                                :text="encryptionPublicKey"
                                :size="$q.platform.is.ios ? 275 : 240"
                                color="#253933"
                                error-level="H"
                                class="q-mb-sm"
                                @error="(error) => console.error('[ReceivePage] QRCode component error:', error)"
                            />
                        </div>
                        <div class="row justify-center q-gutter-md q-mt-md">
                        <q-input
                            v-model="encryptionPublicKey"
                            label="Encryption Public Key"
                            readonly
                            outlined
                            class="q-mt-md"
                            style="min-width: 50%;">
                        </q-input>
                        <q-btn color="primary" @click="copyToClipboard(encryptionPublicKey, $t('EncryptionKeyCopied', 'Encryption key copied to clipboard'));updateStep('code-parse')">Copy & Proceed</q-btn>
                        </div>
                    </div>
                    <div v-else class="row justify-center q-mt-md">
                        <q-spinner color="primary" size="50px" />
                    </div>
                </q-card-section>
            </div>
            <div v-if="step == 'code-parse'">
                <q-card-section class="q-pa-lg">
                    <div class="text-h6">Input NFC Setup Code</div>
                    <div class="text-subtitle2 q-mt-sm">
                        Input or scan the NFC setup code displayed in the Paytaca app to complete the setup process. 
                    </div>
                    <div class="row justify-center q-mt-md">
                        <div class="row justify-center q-gutter-md q-mt-md">
                        <q-input
                            v-model="requestCode"
                            label="NFC Setup Code"
                            outlined
                            class="q-mt-md">
                            <template #append>
                                <q-btn
                                    flat
                                    dense
                                    color="primary"
                                    icon="qr_code_scanner"
                                    @click="showDialog= false; showQRScanner = true"
                                />
                            </template>
                        </q-input>
                        <q-btn color="primary" @click="decodeData">Setup</q-btn>
                        </div>
                    </div>
                </q-card-section>
            </div>
        </q-card>
    </q-dialog>
    <QRCodeReader 
      v-model="showQRScanner" 
      @close="onCloseQrScanner" 
      @decode="onQrDecode"
      @error="onQrError" />
</template>

<script>
import { onMounted, ref } from "vue";
import { useWalletStore } from "src/stores/wallet";
import { useQuasar, copyToClipboard as qCopyToClipboard } from "quasar";
import { getEncryptionKeypair, getOrGenerateEncryptionKeypair } from "src/nfc/keypair";
import { decryptWithPrivateKey } from "src/utils/ecies";
import { savePrivateKeyWif } from "src/nfc/user";

import QRCodeReader from "./QRCodeReader.vue";
import QRCode from 'vue-qrcode-component'
import Watchtower from "watchtower-cash-js";

export default {
  name: "EnableNFCPayments",
  components: {
    QRCode,
    QRCodeReader,
  },
  props: {
    show: {
      type: Boolean,
      default: false,
    },
  },
  emits: ["close"],
  setup(props, { emit }) {
    const $q = useQuasar();
    const walletStore = useWalletStore();
    const showDialog = ref(props.show);
    const step = ref("notice");

    const loadingKeypair = ref(false);
    const showQRScanner = ref(false);

    const encryptionPublicKey = ref("");
    const requestCode = ref("");

    const watchtower = new Watchtower();

    onMounted(async () => {
      encryptionPublicKey.value = await getEncryptionKeypair().publicKey;
      console.log('[EnableNFCPayments] Encryption public key:', encryptionPublicKey.value);
      console.log('posid:', walletStore.posId);
    });

    function closeDialog() {
      showDialog.value = false;
      emit("close");
    }

    function updateStep(newStep) {
      step.value = newStep;
    }

    async function onStartSetup() {
        updateStep("encryption-key-transfer");
        loadingKeypair.value = true;
        const keypair = await getOrGenerateEncryptionKeypair();
        encryptionPublicKey.value = keypair.pubkey;
        loadingKeypair.value = false;
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

    const onQrDecode = async () => {
      showQRScanner.value = false;
      showDialog.value = true;
    };

    const onQrError = (error) => {
      console.error("QR code scanning error:", error);
      $q.notify({
        message: "Failed to scan QR code. Please try again.",
        timeout: 1200,
        icon: "error",
        color: "negative",
      });
    };

    const onCloseQrScanner = () => {
      showQRScanner.value = false;
      showDialog.value = true;
    };

    const decryptData = async (encryptKey, encryptedData) => {
      try {
        // dialog.update({ message: t("DecryptingXpubkey") });
        console.log('Encrypt key for decryption:', encryptKey);
        console.log('Encrypted data for decryption:', encryptedData);
        const encryptionKeypair = await getEncryptionKeypair()
        console.log('Encryption keypair for decryption:', encryptionKeypair);
        const decryptKey = encryptionKeypair?.privkey
        console.log('Decryption private key:', decryptKey);
        const result = JSON.parse(decryptWithPrivateKey(encryptedData, encryptKey, decryptKey));
        console.log('Decryption result:', result);
        return { authPrivateKey: result.privateKey };
      } catch(error) {
        // dialog.update({
        //   title: t("LinkDeviceError"),
        //   message: t("UnableToDecryptXpubkey"),
        // });
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

    const decodeData = async () => {
      try {
        const parsedLinkCode = parseLinkCode(requestCode.value);
        const qrCodeData = decodeLinkContent(parsedLinkCode);
        const skipDecryption = qrCodeData?.skip || false;

        if (!skipDecryption) {
          const encryptedData = await retrieveRequestCodeData(qrCodeData);
          const { authPrivateKey } = await decryptData(qrCodeData.encryptKey, encryptedData);
          await savePrivateKeyWif(authPrivateKey);
          const result = await redeemRequestCode(walletStore.posId)
          console.log('Redeem request code result:', result);
          if (result?.success) {
            $q.notify({
              message: "NFC payments enabled successfully!",
              timeout: 1200,
              icon: "check",
              color: "positive",
            });
            emit("close");
          } else {
            $q.notify({
              message: "Failed to enable NFC payments. Please try again.",
              timeout: 1200,
              icon: "error",
              color: "negative",
            });
          }
        }
      } catch (error) {
        console.error(error);
        $q.notify({
          message: "An error occurred while enabling NFC payments. Please try again.",
          timeout: 1200,
          icon: "error",
          color: "negative",
        });
        return;
      }
    };

    const redeemRequestCode = async (posid) => {
      try {
        // dialog.update({ message: t("LinkingDevice") });
        const response = await watchtower.BCH._api.post(
          `paytacapos/devices/${posid}/enable-nfc-payments/`,
        );
        console.log('Redeem request code response:', response.data);
        return {
          success: true,
          ...response.data
        };
        // dialog.update({ title: t("DeviceLinked"), message: t("DeviceLinkedSuccess") });
      } catch (error) {
        // dialog.update({ title: t("LinkDeviceError"), message: t("FailedToLinkDevice") });
        console.error(error.response || error);
        throw new Error(error);
      }
    }

    const parseLinkCode = (value) => {
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

    const decodeLinkContent = (content) =>   {
      try {
        // dialog.update({ message: t("DecodingContent") });
        const decodedContent = JSON.parse(content);
        const code = decodedContent.code;
        const encryptKey = decodedContent.encryptKey;
        const nonce = decodedContent.nonce;
        return { code, encryptKey, nonce };
      } catch (error) {
        // dialog.update({
        //   title: t("LinkDeviceError"),
        //   message: t("UnableToDecodeQrData"),
        // });
        console.error(error);
        throw new Error(error);
      }
    }

    const retrieveRequestCodeData = async (qrCodeData) => {
      try {
        // dialog.update({ message: t("RetrievingRequestCodeData") });
        const response = await watchtower.BCH._api.get(
          `paytacapos/devices/nfc_code_data/`,
          { params: { code: qrCodeData.code } }
        );
        return response?.data;
      } catch(error) {
        // let message = t("RequestCodeDataInvalid");
        // if (error?.response?.status === 400)
        //   message = t("RequestCodeDataNotFound");
        // dialog.update({ title: t("LinkDeviceError"), message: message });
        console.error(error.response || error);
        throw new Error(error);
      }
    }
    
    return {
      showDialog,
      step,
      encryptionPublicKey,
      closeDialog,
      updateStep,
      onStartSetup,
      copyToClipboard,
      loadingKeypair,
      requestCode,
      showQRScanner,
      onQrDecode,
      onQrError,
      onCloseQrScanner,
      decodeData
    };
  },
};
</script>