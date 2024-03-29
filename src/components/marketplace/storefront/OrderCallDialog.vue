<template>
  <q-dialog
    v-model="innerVal"
    ref="dialogRef"
    full-height
    full-width
    position="bottom"
    persistent
    @hide="onDialogHide"
  >
    <q-card>
      <q-card-section>
        <div class="row items-center q-pb-sm">
          <div class="text-h5 q-space">Call</div>
          <q-btn flat icon="close" padding="sm" v-close-popup/>
        </div>
        <div class="q-my-sm">
          <div class="row items-center no-wrap">
            <q-input
              v-if="localIdentity"
              readonly
              borderless dense
              label="Name"
              :model-value="localIdentity.name"
              debounce="1000"
            />
            <q-space/>
            <div class="text-right">
              <AVMedia
                v-if="manager?.localStream?.getAudioTracks?.().length"
                :media="manager?.localStream"
                type="vbar" class="audio-meter"
                style="justify-self: center;align-self: center;"
              />
              <div v-else class="text-grey">
                Mic is turned off
              </div>
              <div v-if="manager?.localPeerId" class="text-caption bottom">
                #{{ manager?.localPeerId }}
              </div>
            </div>
            <div
              v-if="manager?.localStream?.getVideoTracks?.()?.length"
              class="row items-center q-ml-xs"
              style="height:3rem;"
            >
              <video
                :srcObject="manager.localStream"
                autoplay playsinline
                muted
                style="width:100%;height:100%;border-radius: 4px;"
              ></video>
            </div>
            <q-icon v-else :name="manager?.constraints?.audio ? 'mic' : 'mic_off'" size="2rem"/>
          </div>
        </div>
        <div class="row items-center justify-center chat-members-container">
          <q-banner
            v-if="!callRunning && sessionCreateError"
            class="col-12 bg-red text-white q-mb-sm self-start"
            rounded
          >
            {{ sessionCreateError }}
          </q-banner>
          <div
            v-if="fetchingSession || creatingSession || initializingWebsocket || loadingLocalStream"
            class="text-center"
          >
            <q-spinner size="3em"/>
            <div v-if="fetchingSession">Fetching session</div>
            <div v-if="creatingSession">Creating session</div>
            <div v-if="initializingWebsocket">Connecting to server</div>
            <div v-if="loadingLocalStream">Loading devices</div>
          </div>
          <div v-if="callRunning && !manager?.members?.length">
            Waiting for others to join call
          </div>

          <div v-for="member in manager?.members" :key="member.id" class="chat-member-container">
            <div class="chat-member-content">
              <div
                :style="{
                  position: 'absolute',
                  inset:0,
                  display: member.newTrackCtr && member.mediaStream?.getVideoTracks?.().length ? 'unset' : 'none',
                }"
              >
                <video
                  :srcObject="member.mediaStream"
                  autoplay playsinline
                  style="width:100%;height:100%;border-radius:8px;"
                ></video>
              </div>
              <div class="text-center">
                <q-icon
                :name="member.audioEnabled ? 'mic' : 'mic_off'"
                size="3rem"
                />
                <AVMedia
                v-if="member.newTrackCtr && member.mediaStream?.getAudioTracks?.().length"
                :media="member.mediaStream"
                type="vbar" class="audio-meter"
                />
                <div v-if="member.name">{{ member.name }}</div>
                <div v-else >#{{ member.id }}</div>
              </div>
            </div>
          </div>
        </div>
        <div v-if="manager?.callId" class="row items-center justify-around q-mb-md">
          <div class="row items-center justify-around q-mb-md">
            <div class="text-center">
              <q-btn
                round
                :icon="!membersMuted ? 'volume_up' : 'volume_off'"
                color="grey"
                @click="() => {
                  membersMuted = !membersMuted
                }"
              />
              <div>{{ !membersMuted ? 'Mute' : 'Unmute' }}</div>
            </div>
          </div>
          <div class="text-center">
            <q-btn
              round
              icon="local_phone"
              :color="callRunning ? 'red' : 'green'"
              size="lg"
              @click="() => callRunning ? hangUp() : startCall()"
            />
            <div>{{ callRunning ? 'Hang-up' : 'Call' }}</div>
          </div>

          <div class="text-center">
            <q-btn
              round
              :icon="manager?.constraints?.audio ? 'mic' : 'mic_off'"
              color="grey"
              @click="() => {
                manager.constraints.audio = !manager?.constraints?.audio
                manager?.updateStreamConstraints()
              }"
            />
            <div>{{ manager?.constraints?.audio ? 'Mic on' : 'Mic off' }}</div>
          </div>
        </div>
        <div v-else class="row items-center q-gutter-x-sm">
          <template v-if="orderCallSession?.id && !orderCallSession?.endedAt">
            <q-btn
              :disable="fetchingSession || creatingSession"
              outline
              no-caps label="Cancel"
              class="q-space"
              v-close-popup
            />
            <q-btn
              :disable="fetchingSession || creatingSession"
              :loading="fetchingSession || creatingSession"
              no-caps label="Join call"
              color="brandblue"
              class="q-space"
              @click="() => prepareAndStartCall({ create: false })"
            />
          </template>
          <template v-else>
            <q-btn
              :disable="fetchingSession || creatingSession"
              outline
              no-caps label="Cancel"
              class="q-space"
              v-close-popup
            />
            <q-btn
              :disable="fetchingSession || creatingSession"
              :loading="fetchingSession || creatingSession"
              no-caps label="Create call"
              color="brandblue"
              class="q-space"
              @click="() => prepareAndStartCall({ create: true })"
            />
          </template>
        </div>
      </q-card-section>
    </q-card>
  </q-dialog>
</template>
<script>
import { backend, getAuthToken } from 'src/marketplace/backend'
import { OrderCallSession } from 'src/marketplace/objects'
import { useMarketplaceStore } from 'src/stores/marketplace'
import { useDialogPluginComponent } from 'quasar'
import { computed, defineComponent, onMounted, onUnmounted, ref, watch } from 'vue'
import { WebRtcCallManager } from 'src/marketplace/webrtc'
import { AVMedia } from 'vue-audio-visual'
import { errorParser } from 'src/marketplace/utils'

export default defineComponent({
  name: 'OrderCallDialog',
  components: {
    AVMedia,
  },
  emits: [
    'update:modelValue',
    // REQUIRED; need to specify some events that your
    // component will emit through useDialogPluginComponent()
    ...useDialogPluginComponent.emits,
  ],
  props: {
    modelValue: Boolean,
    orderId: [String, Number],
    autoJoin: Boolean,
  },
  setup(props, { emit: $emit }) {
    const marketplaceStore = useMarketplaceStore()

    const { dialogRef, onDialogHide, onDialogOK, onDialogCancel } = useDialogPluginComponent()

    const innerVal = ref(props.modelValue)
    watch(() => [props.modelValue], () => innerVal.value = props.modelValue)
    watch(innerVal, () => $emit('update:modelValue', innerVal.value))

    onMounted(() => onLoadOrShow())
    watch(() => [props.orderId], () => onLoadOrShow())
    watch(innerVal, () => onLoadOrShow())
    function onLoadOrShow() {
      if (!innerVal.value) return
      getOrderCallSession()
        .then(() => {
          if (!orderCallSession.value?.id || !props.autoJoin) return
          startCall()
        })
    }

    onUnmounted(() => hangUp())
    watch(innerVal, () => {
      if (innerVal.value) return
      sessionCreateError.value = ''
      hangUp()
    })

    const orderCallSession = ref(OrderCallSession.parse())
    const fetchingSession = ref(false)
    const creatingSession = ref(false)
    const sessionCreateError = ref('')

    function getOrderCallSession() {
      fetchingSession.value = true
      return backend.get(`connecta/orders/${props.orderId}/call/`)
        .then(response => {
          orderCallSession.value = OrderCallSession.parse(response?.data)
          return response
        })
        .catch(error => {
          if (error?.response?.status == 400) orderCallSession.value = OrderCallSession.parse(response?.data)
          return Promise.reject(error)
        })
        .finally(() => {
          fetchingSession.value = false
        })
    }

    function createCallSession() {
      creatingSession.value = true
      return backend.post(`connecta/orders/${props.orderId}/call/`, { source: 'merchant' })
        .finally(() => sessionCreateError.value = '')
        .then(response => {
          orderCallSession.value = OrderCallSession.parse(response?.data)
        })
        .catch(error => {
          const data = error?.response?.data
          let errorMessage = errorParser.firstElementOrValue(data?.non_field_errors) ||
                            errorParser.firstElementOrValue(data) ||
                            errorParser.firstElementOrValue(data?.detail)

          if (!errorMessage && typeof error?.message === 'string' && error?.message?.length < 200) {
            errorMessage = error?.message
          }
          sessionCreateError.value = errorMessage
        })
        .finally(() => {
          creatingSession.value = false
        })
    }

    async function prepareAndStartCall(opts={ create: false }) {
      if (opts?.create) await createCallSession()
      else await getOrderCallSession()

      if (!orderCallSession.value?.id) return
      return startCall()
    }

    const manager = ref([].map(() => new WebRtcCallManager())[0])
    const callRunning = computed(() => manager.value?.members?.length || manager.value?.signaller?.isWebsocketOpen)
    function initManager() {
      manager.value?.cleanUp?.()
      manager.value = new WebRtcCallManager({
        callId: orderCallSession.value?.id,
        peerId: Date.now(),
        identity: localIdentity.value,
        constraints: { video: false, audio: true },
        signaller: {
          url: async (callId) => {
            const tokenResponse = await getAuthToken()
            const authToken = tokenResponse.value

            const backendUrl = new URL(backend.defaults.baseURL)
            const host = backendUrl.host
            const scheme = backendUrl.protocol === 'https:' ? 'wss' : 'ws'
            const url = `${scheme}://${host}/ws/connecta/order-call-signaller/${callId}/?token=${authToken}`

            return url
          }
        }
      })
      window.m  = manager.value
    }

    const localIdentity = computed(() => {
      return {
        id: marketplaceStore.user?.id,
        type: 'merchant',
        name: [marketplaceStore.user?.firstName, marketplaceStore.user?.lastName].filter(Boolean).join(' '),
      }
    })
    watch(localIdentity, () => {
      if (!manager.value) return
      manager.value.localIdentity = localIdentity.value
    }, { deep: true })

    const initializingWebsocket = ref(false)
    function initWebsocket() {
      initializingWebsocket.value = true
      return manager.value.signaller.connectWs()
        .finally(() => {
          initializingWebsocket.value = false
        })
    }

    const loadingLocalStream = ref(false)
    function loadLocalStream() {
      loadingLocalStream.value = true
      return manager.value.getLocalStream()
        .finally(() => {
          loadingLocalStream.value = false
        })
    }

    const membersMuted = ref(false)
    watch(membersMuted, () => updateMemberAudioStatus())
    function updateMemberAudioStatus() {
      if (!manager.value) return
      manager.value.members.forEach(member => {
        member.mediaStream.getAudioTracks().forEach(track => {
          track.enabled = !Boolean(membersMuted.value)
        })
      })
    }

    async function startCall() {
      await initManager()
      await Promise.all([
        initWebsocket(),
        loadLocalStream(),
      ])
      
      manager.value.joinRoom()
      runSignallerPing()
    }

    function hangUp() {
      manager.value?.cleanUp?.()
      manager.value = null
      membersMuted.value = false
      if (innerVal.value) getOrderCallSession()
    }

    const serverPingIntervalId = ref(false)
    watch(innerVal, () => innerVal.value ? runSignallerPing() : stopSignallerPing())
    onMounted(() => innerVal.value ? runSignallerPing() : stopSignallerPing())
    onUnmounted(() => stopSignallerPing())
    function pingSignaller() {
      if (!manager.value?.signaller?.isWebsocketOpen) return
      manager.value.signaller.sendSignal('server-ping')
    }
    function stopSignallerPing() {
      clearInterval(serverPingIntervalId.value)
      serverPingIntervalId.value = false
      console.log('Stopped signaller ping')
    }

    function runSignallerPing() {
      stopSignallerPing()
      serverPingIntervalId.value = setInterval(() => pingSignaller(), 60 * 1000)
      console.log('Started signaller ping')
    }

    return {

      dialogRef, onDialogHide, onDialogOK, onDialogCancel,
      innerVal,

      orderCallSession,
      fetchingSession,
      creatingSession,
      sessionCreateError,

      getOrderCallSession,
      createCallSession,

      prepareAndStartCall,

      manager,
      callRunning,
      initializingWebsocket,
      localIdentity,
      loadingLocalStream,
      membersMuted,
      startCall,
      hangUp,
    }
  },
})
</script>
<style lang="scss" scoped>
.chat-member-container {
  min-width: min(50%, 150px);
  padding: map-get($space-sm, 'y') map-get($space-sm, 'x');
}
.chat-member-container:not(:only-child.chat-member-container) {
  flex-grow: 1;
}

.chat-member-container .chat-member-content {
  // border: 1px solid grey;
  border-radius: 8px;
  padding: map-get($space-xs, 'y') map-get($space-xs, 'x');
  min-height: min(150px, 30vh);
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
}
.chat-members-container {
  position: relative;
  overflow:auto;
  height:100%;
  height: calc(75vh - 10rem);
  margin-bottom: map-get($space-md, 'y');
  border-radius: 8px;
}
</style>