<template>
  <div class="scanner-container">
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
        @click="toggle"
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
import { QrcodeStream } from 'vue3-qrcode-reader'
import { ref } from 'vue'

export default {
  components: { QrcodeStream },
  props: {
    text: {
      type: String,
      default: 'Scan QR code',
    },
    toggle: Function
  },
  emits: ['decode', 'error'],
  setup (props, { emit }) {
    const errorMessage = ref(null)

    function onScannerDecode (content) {
      emit('decode', content)
    }

    function onScannerInit (promise) {
      promise
        .then(() => {
          errorMessage.value = ''
        })
        .catch(error => {
          if (error.name === 'NotAllowedError') {
            errorMessage.value = 'Permission required to access to camera'
            // this.error = 'Hey! I need access to your camera'
          } else if (error.name === 'NotFoundError') {
            errorMessage.value = 'No camera found on this device'
            // this.error = 'Do you even have a camera on your device?'
          } else if (error.name === 'NotSupportedError') {
            errorMessage.value = 'Unable to acccess camera in non-secure context'
            // this.error = 'Seems like this page is served in non-secure context (HTTPS, localhost or file://)'
          } else if (error.name === 'NotReadableError') {
            errorMessage.value = 'Unable to access camera.'
            // this.error = 'Couldn\'t access your camera. Is it already in use?'
          } else if (error.name === 'OverconstrainedError') {
            errorMessage.value = 'Constraints don\'t match any installed camera. Did you ask for the front camera although there is none?'
          } else {
            errorMessage.value = 'Unknown error: ' + error.message
          }

          if (errorMessage.value) {
            emit('error', errorMessage.value)
          }
        })
    }

    return {
      onScannerDecode,
      onScannerInit
    }
  }
}
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
