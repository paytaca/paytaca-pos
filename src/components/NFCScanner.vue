<template>
  <div>
    <button @click="startScan" :disabled="scanning || !supported">
      {{ scanning ? 'Scanning...' : 'Scan NFC Tag' }}
    </button>
    <p v-if="!supported">This device doesn't have NFC hardware.</p>
    <p v-if="error">{{ error }}</p>
    <p v-if="tagData">Tag data: {{ tagData }}</p>
  </div>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue'
import { NFC } from '@exxili/capacitor-nfc'

const supported = ref(false)
const scanning = ref(false)
const tagData = ref(null)
const error = ref(null)
let offRead = null
let offError = null

onMounted(async () => {
  const result = await NFC.isSupported()
  supported.value = result.supported

  offRead = NFC.onRead((data) => {
    scanning.value = false
    const textView = data.string()
    tagData.value = JSON.stringify(textView)
  })

  offError = NFC.onError((err) => {
    error.value = `Error: ${err.message || err}`
    scanning.value = false
  })
})

onUnmounted(() => {
  offRead?.()
  offError?.()
})

async function startScan() {
  error.value = null
  scanning.value = true
  try {
    await NFC.startScan()
  } catch (err) {
    error.value = `Error: ${err.message}`
    scanning.value = false
  }
}
</script>
