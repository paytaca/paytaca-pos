<template>
  <q-dialog v-model="innerVal" ref="dialogRef" @hide="onDialogHide" position="bottom" full-height>
    <q-card>
      <q-card-section class="q-pb-none">
        <div class="row items-center q-pb-sm">
          <div class="q-space">
            <div class="text-h5">Chat</div>
            <div class="text-caption text-grey bottom">{{ chatRef }}</div>
          </div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <div class="row column no-wrap" style="height:calc(75vh - 4rem);">
          <q-space/>
          <div ref="messagesPanel" class="q-pa-sm messages-panel" style="overflow:auto;">
            <div class="row justify-center">
              <q-btn
                v-if="hasMoreMessages"
                :loading="fetchingMessages"
                :disable="fetchingMessages"
                flat
                no-caps label="Load more"
                @click="() => getMessages({ append: true })"
                v-element-visibility="() => getMessages({ append: true })"
              />
              <q-spinner
                v-else-if="fetchingMessages && !messages?.length"
                size="3rem"
                class="q-my-sm"
              />
            </div>
            <q-virtual-scroll
              ref="messagesPanel"
              :items="parsedMessages"
              separator
              v-slot="{ item: message }"
            >
              <q-chat-message
                :bg-color="isOwnMessage(message) ? 'grey-7' : 'brandblue'"
                text-color="white"
                :name="message?.name"
                :sent="!isOwnMessage(message)"
                :stamp="formatDateRelative(message?.createdAt)"
                v-element-visibility="(...args) => onMessageVisibility(message, ...args)"
              >
                <template v-slot:stamp>
                  <div>
                    {{ formatDateRelative(message?.createdAt) }}
                    <q-icon v-if="message?.encrypted" name="lock"/>
                    <q-menu class="q-py-xs q-px-sm">
                      {{ formatTimestampToText(message?.createdAt) }}
                    </q-menu>
                  </div>
                </template>
                <span
                  v-if="message?.encrypted && !message?.decryptedMessage"
                  @click="() => decryptMessage(message, true)"
                >
                  Message is encrypted
                </span>
                <span v-else-if="message?.decryptedMessage">
                  {{ message?.decryptedMessage }}
                </span>
                <i v-else-if="message?.hasAttachment">
                  Attachment
                </i>
              </q-chat-message>
              <div
                :class="[
                  'row q-mb-xs',
                  !isOwnMessage(message) ? 'justify-end' : 'justify-start'
                ]"
              >
                <img
                  v-if="message?.attachmentUrl" :src="message?.attachmentUrl"
                  style="max-width:75%;border-radius:4px;"
                  @click="() => openImage(message?.attachmentUrl)"
                />
                <template v-else-if="message?.encryptedAttachmentUrl">
                  <img
                    v-if="message?.decryptedAttachmentFile?.url"
                    :src="message?.decryptedAttachmentFile?.url"
                    style="max-width:75%;border-radius:4px;"
                    @click="() => openImage(message?.decryptedAttachmentFile?.url)"
                  />
                  <div v-else class="row items-center">
                    <div
                      class="text-grey encrypted-attachment-text"
                      @click="() => decryptMessageAttachment(message, true)"
                      v-element-visibility="() => decryptMessageAttachment(message)"
                    >
                      Attachment encrypted
                      <q-spinner v-if="message?.$state?.decryptingAttachment"/>
                    </div>
                  </div>
                </template>
              </div>
            </q-virtual-scroll>
            <div class="bottom-anchor"></div>
          </div>
          <q-input
            outlined
            :disable="sendingMessage"
            :loading="sendingMessage"
            v-model="message"
            autogrow
            :bottom-slots="!attachmentUrl"
          >
            <template v-slot:after>
              <q-btn
                color="brandblue"
                :disable="sendingMessage"
                :loading="sendingMessage"
                icon="send"
                padding="sm"
                @click="() => sendMessage()"
              />
            </template>
            <template v-slot:append>
              <q-btn
                flat
                icon="attach_file"
                padding="sm"
                @click="openFileAttachementField"
              />
            </template>
          </q-input>
          <q-file
            v-show="false"
            ref="fileAttachmentField"
            borderless
            v-model="attachment"
            :filter="files => files.filter(file => file.type?.match(/image\/.*/))"
            @update:model-value="() => resizeAttachment()"
          />
          <div v-if="attachmentUrl" class="row items-start no-wrap q-my-sm">
            <img
              :src="attachmentUrl"
              :style="{
                'cursor': 'pointer',
                'border-radius': '10px',
                'max-height': 'min(10rem, 50vh)',
                'max-width': 'calc(100% - 5rem)',
              }"
              @click="openFileAttachementField"
            >
            <q-btn
              flat icon="cancel"
              padding="sm"
              @click.stop="() => attachment = null"
            />
          </div>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend } from 'src/marketplace/backend'
import { ChatMember, ChatMessage, ChatSession } from 'src/marketplace/objects'
import { formatDateRelative, formatTimestampToText } from 'src/marketplace/utils'
import { connectWebsocket } from 'src/marketplace/webrtc/websocket-utils'
import { resizeImage } from 'src/marketplace/chat/attachment'
import { compressEncryptedMessage, encryptMessage, compressEncryptedImage, encryptImage } from 'src/marketplace/chat/encryption'
import { updateOrCreateKeypair } from 'src/marketplace/chat'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent, debounce, useQuasar } from 'quasar'
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { vElementVisibility } from '@vueuse/components'
import ImageViewerDialog from 'src/components/marketplace/ImageViewerDialog.vue'

export default defineComponent({
  name: 'ChatDialog',
  directives: {
    'element-visibility': vElementVisibility,
  },
  props: {
    modelValue: Boolean,
    chatRef: String,
  },
  emits: [
    'update:modelValue',
    'new-message',

    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  setup(props, { emit: $emit }) {
    const $q = useQuasar()
    const marketplaceStore = useMarketplaceStore()
    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    const user = computed(() => marketplaceStore?.user)
    function isOwnMessage(message=ChatMessage.parse()) {
      return user.value?.id && user.value?.id !== message?.user?.id
    }

    onMounted(() => fetchChatSession())
    watch(() => [props.chatRef], () => fetchChatSession())
    const chatSession = ref(ChatSession.parse())
    const fetchChatSession = debounce(function() {
      if (!props.chatRef) return Promise.resolve('Missing chat ref')
      return backend.get(`chat/sessions/${props.chatRef}/`, { forceSign: true })
        .then(response => {
          chatSession.value.raw = response?.data
        })
    }, 500)

    const hasMoreMessages = computed(() => {
      return parsedMessages.value[0]?.createdAt > chatSession.value.firstMessageAt
    })

    const membersPubkeys = ref([].map(String))
    onMounted(() => fetchMembersPubkeys())
    watch(() => [props.chatRef], () => fetchMembersPubkeys())
    function fetchMembersPubkeys() {
      if (!props.chatRef) return
      backend.get(`chat/sessions/${props.chatRef}/pubkeys/`)
        .then(response => {
          if (!Array.isArray(response?.data)) return Promise.reject({ response })
          membersPubkeys.value = response?.data
          return response
        })
    }

    const fetchingMessages = ref(false)
    const messages = ref([].map(ChatMessage.parse))
    const parsedMessages = computed(() => {
      const sortedMessages = [...messages.value]
        .sort((m1, m2) => m1?.createdAt - m2?.createdAt)
      return sortedMessages
    })

    onMounted(() => innerVal.value ? getMessages() : null)
    watch(() => [props.chatRef], () => {
      messages.value = []
      innerVal.value ? getMessages() : null
    })
    watch(innerVal, () => innerVal.value ? getMessages({ prepend: true }) : null)
    const getMessages = debounce(function (opts={limit: 0, offset: 0, append: false, prepend: false}) {
      const params = {
        chat_ref: props.chatRef,
        limit: opts?.limit || 8,
        offset: opts?.offset || undefined,
        before: opts?.append ? parsedMessages.value[0]?.createdAt : undefined,
        after: opts?.prepend ? parsedMessages.value?.at?.(-1)?.createdAt : undefined,
      }

      if (!params.chat_ref) return Promise.resolve('Missing chat ref')

      fetchingMessages.value = true
      return backend.get(`chat/messages/`, { params, forceSign: true })
        .then(response => {
          if (!Array.isArray(response?.data?.results)) return Promise.reject({ response })

          const parsedMessages = response?.data?.results?.map(ChatMessage.parse)
          if (!parsedMessages.length) return response

          const prevLength = messages.value?.length
          if (opts?.append) messages.value.unshift(...parsedMessages)
          else if (opts?.prepend) messages.value.push(...parsedMessages)
          else messages.value = parsedMessages
          messages.value = messages.value.filter((msg, index, list) => {
            return list.findIndex(_msg => msg?.id === _msg?.id) === index
          })
          decryptMessages()
          const newLength = messages.value?.length 

          if (!opts?.append && prevLength !== newLength) {
            moveMessagesToBottom({ delay: 250 })
            fetchChatMember()
          }
          return response
        })
        .finally(() => {
          fetchingMessages.value = false
        })
    }, 250)


    const keypair = ref({ privkey: '', pubkey: '' })
    onMounted(() => loadKeypair())
    async function loadKeypair() {
      keypair.value = await updateOrCreateKeypair().catch(console.error)
    }
    async function decryptMessages() {
      if (!keypair.value?.privkey) await loadKeypair()
      if (!keypair.value?.privkey) return
      await Promise.all(messages.value.map(message => decryptMessage(message, false)))
    }

    async function decryptMessage(message=ChatMessage.parse(), tryAllKeys=false) {
      if (!keypair.value?.privkey) await loadKeypair()
      if (!keypair.value?.privkey) return
      if (message.decryptedMessage) return
      return message.decryptMessage(keypair.value?.privkey, tryAllKeys)
    }

    async function decryptMessageAttachment(chatMessage = ChatMessage.parse(), tryAllKeys=false) {
      if (!keypair.value?.privkey) await loadKeypair()
      if (!keypair.value?.privkey) return
      if (chatMessage?.decryptedAttachmentFile?.url) return
      return chatMessage.decryptAttachment(keypair.value?.privkey, tryAllKeys)
    }

    function onNewMessage(newMessage=ChatMessage.parse()) {
      $emit('new-message', newMessage)
      const index = messages.value.findIndex(msg => msg?.id === newMessage?.id)
      if (index < 0) {
        messages.value.unshift(newMessage)
        decryptMessages()
        moveMessagesToBottom({ delay: 250 })
      }

      if (newMessage.chatSessionRef == chatSession.value?.ref) {
        if (newMessage.createdAt > chatSession.value.lastMessageAt) {
          chatSession.value.lastMessageAt = newMessage.createdAt
        }
      }

      const userId = chatMember.value?.chatIdentity?.user?.id
      const customerId = chatMember.value?.chatIdentity?.customer?.id
      if (newMessage.user?.id != userId && newMessage.customer?.id != customerId) {
        chatMember.value.unreadCount = (chatMember.value.unreadCount || 0) + 1
      }
    }

    const messagesPanel = ref()
    watch(innerVal, () => {
      if (!innerVal.value) return
      moveMessagesToBottom({ delay: 250 })
    })
    const asyncSleep = duration => new Promise(resolve => setTimeout(resolve, duration))
    async function moveMessagesToBottom(opts={ delay: 250 }) {
      if (Number.isFinite(opts?.delay) && opts?.delay) await asyncSleep(opts?.delay)
      messagesPanel.value?.scrollTo(0, messagesPanel.value?.scrollHeight)
    }

    const sendingMessage = ref(false)
    const message = ref('')
    const attachment = ref(null)
    watch(attachment, (newVal, oldVal) => {
      if (newVal) attachmentUrl.value = URL.createObjectURL(newVal)
      else attachmentUrl.value = ''
      if (oldVal) URL.revokeObjectURL(oldVal)
    })
    const attachmentUrl = ref('')
    const fileAttachmentField = ref()
    function openFileAttachementField(evt) {
      fileAttachmentField.value?.pickFiles?.(evt)
    }

    async function resizeAttachment() {
      attachment.value = await resizeImage({
        file: attachment.value,
        maxWidthHeight: 640, // based on recommended dimensions for mobile
      })
    }

    const sendMessage = debounce(async function() {
      if (!message.value && !attachment.value) return
      let data = {
        chat_session_ref: props.chatRef,
        encrypted: false,
        message: message.value,
      }

      if (!keypair.value?.privkey) await loadKeypair()
      if (keypair.value?.privkey && data?.message) {
        const encryptedMessage = encryptMessage({
          data: data.message,
          privkey: keypair.value.privkey,
          pubkeys: membersPubkeys.value,
        })
        data.message = compressEncryptedMessage(encryptedMessage)
        data.encrypted = true
      }

      if (attachment.value) {
        const encryptedAttachment = await encryptImage({
          file: attachment.value,
          privkey: keypair.value.privkey,
          pubkeys: membersPubkeys.value,
        })
        const compressedEncryptedAttachment = await compressEncryptedImage(encryptedAttachment)
        // data.attachment = await fileToJson(attachment.value)
        // console.log('Request data', data)
        const formData = new FormData()
        formData.set('chat_session_ref', data.chat_session_ref)
        formData.set('encrypted', data.encrypted)
        formData.set('message', data.message)
        formData.set('attachment', compressedEncryptedAttachment)
        formData.set('attachment_encrypted', true)
        data = formData
      }

      sendingMessage.value = true
      return backend.post(`chat/messages/`, data)
        .then(response => {
          if (!response?.data?.id) return Promise.reject({ response })
          message.value = ''
          attachment.value = null
          const newMessage = ChatMessage.parse(response?.data)
          const index = messages.value.findIndex(msg => msg?.id === newMessage?.id)
          if (index < 0) {
            messages.value.unshift(newMessage)
            decryptMessages()
          }
          return response
        })
        .finally(() => {
          sendingMessage.value = false
        })
    }, 250)

    const chatMember = ref(ChatMember.parse())
    onMounted(() => fetchChatMember())
    watch(() => [props.chatRef], () => fetchChatMember())
    const fetchChatMember = debounce(function() {
      if (!props.chatRef) return Promise.resolve('Missing chat ref')

      backend.get(`chat/sessions/${props.chatRef}/chat_member/`, { forceSign: true })
        .then(response => {
          chatMember.value = ChatMember.parse(response?.data)
          return response
        })
    }, 250)

    function updateLastRead() {
      const msgTimestamps = messages.value
        .map(message => message.createdAt * 1)
        .filter(Boolean)
      const latest = Math.max(...msgTimestamps)
      const data = {
        last_read_timestamp: new Date(latest+1000),
      }

      return backend.post(`chat/sessions/${props.chatRef}/chat_member/`, data)
        .then(response => {
          chatMember.value = ChatMember.parse(response?.data)
          return response
        })
    }
    function onMessageVisibility(chatMessage=ChatMessage.parse(), visible) {
      if (!visible) return

      if (chatMessage !== parsedMessages.value.at(-1)) return

      const laterThanLastRead = chatMessage.createdAt > chatMember.value?.lastReadTimestamp
      if (!laterThanLastRead && chatMember.value?.lastReadTimestamp) return
      return updateLastRead()
    }

    const websocket = ref([].map(() => new WebSocket())[0])
    onMounted(() => initWebsocket())
    onUnmounted(() => {
      removeWebsocketEvents()
      websocket.value?.close?.()
    })
    watch(() => [props.chatRef], () => initWebsocket())
    watch(innerVal, () => websocket.value?.readyState !== WebSocket.OPEN ? initWebsocket() : null)
    function initWebsocket() {
      if (!props.chatRef) return Promise.resolve('Missing chat ref')
      const backendUrl = new URL(backend.defaults.baseURL)
      const host = backendUrl.host
      const scheme = backendUrl.protocol === 'https:' ? 'wss' : 'ws'
      const url = `${scheme}://${host}/ws/chat/sessions/${props.chatRef}/`

      return connectWebsocket(url)
        .then(ws => {
          console.log('Websocket connected')
          websocket.value?.close?.()
          removeWebsocketEvents()
          websocket.value = ws
          addWebsocketEvents()
        })
        .catch(error => {
          console.error('Websocket connection failed', error)
          return Promise.reject(error)
        })
    }
    function addWebsocketEvents() {
      websocket.value?.addEventListener?.('message', onWebsocketMessage)
      websocket.value?.addEventListener?.('close', onWebsocketClose)
    }
    function removeWebsocketEvents() {
      websocket.value?.removeEventListener?.('message', onWebsocketMessage)
      websocket.value?.removeEventListener?.('close', onWebsocketClose)
    }

    /**
     * @param {MesssageEvent} evt 
     */
     function onWebsocketMessage(evt) {
      const parsedData = JSON.parse(evt.data)
      console.log('Websocket message', parsedData)
      if (parsedData?.type == 'new_message') {
        const newMessage = ChatMessage.parse(parsedData.data)
        onNewMessage(newMessage)
      } else if (parsedData?.type == 'new_member') {
        parsedData?.data?.pubkeys?.forEach?.(pubkey => {
          if (typeof pubkey !== 'string') return
          if (membersPubkeys.value?.includes(pubkey)) return
          membersPubkeys.value.push(pubkey)
        })
      } else if (parsedData?.type == 'pubkey') {
        if (typeof parsedData?.data === 'string' && !membersPubkeys.value?.includes(parsedData?.data)) {
          membersPubkeys.value.push(parsedData?.data)
        }
      }
    }

    /**
     * @param {CloseEvent} evt
     */
    function onWebsocketClose(evt) {
      console.log('Websocket closed', evt)
      if (evt.target !== websocket.value) return
      removeWebsocketEvents()
      websocket.value = undefined
      initWebsocket()
    }

    function openImage(img) {
      if (!img) return
      $q.dialog({
        component: ImageViewerDialog,
        componentProps: {
          image: img
        }
      })  
    }

    return {
      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      user,
      isOwnMessage,

      hasMoreMessages,
      fetchingMessages,
      messages,
      parsedMessages,
      getMessages,
      decryptMessage,
      decryptMessageAttachment,

      messagesPanel,
      moveMessagesToBottom,

      sendingMessage,
      message,
      attachment,
      attachmentUrl,
      fileAttachmentField,
      openFileAttachementField,
      resizeAttachment,
      sendMessage,

      chatMember,
      fetchChatMember,
      updateLastRead,
      onMessageVisibility,

      openImage,

      formatDateRelative,
      formatTimestampToText,
    }
  },
})
</script>
<style lang="scss" scoped>
.encrypted-attachment-text {
  max-width: 75%;
  text-decoration: underline;
  border: 0.5px solid $grey;
  border-radius: map-get($space-xs, 'x');
  padding: map-get($space-xs, 'y') map-get($space-sm, 'x');
}
.messages-panel {
  overscroll-behavior: contain;
}
.messages-panel * {
  overflow-anchor: none;
}
.messages-panel .bottom-anchor {
  overflow-anchor: auto;
  height: 1px;
}
</style>