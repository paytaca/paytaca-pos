<template>
  <q-page class="debug-page no-scroll">
    <MainHeader :title="$t('Debug')">
      <template #right-actions>
        <q-btn
          flat
          round
          icon="close"
          size="md"
          @click="handleClose"
          class="q-mr-sm"
        >
          <q-tooltip>Close Debug</q-tooltip>
        </q-btn>
      </template>
    </MainHeader>
    <!-- Terminal Display -->
    <div class="terminal-container" :class="$q.dark.isActive ? 'dark' : ''">
      <div class="terminal-header">
        <span class="terminal-title">Console Logs</span>
        <div>
          <q-btn
            flat
            dense
            round
            icon="content_copy"
            size="sm"
            @click="copyLogs"
            class="q-mr-xs"
          >
            <q-tooltip>Copy Logs</q-tooltip>
          </q-btn>
          <q-btn
            flat
            dense
            round
            icon="clear"
            size="sm"
            @click="clearLogs"
            class="q-mr-xs"
          >
            <q-tooltip>Clear</q-tooltip>
          </q-btn>
        </div>
      </div>
      <div class="terminal-body" ref="terminalBody">
        <div
          v-for="(log, index) in logs"
          :key="index"
          class="log-line"
          :class="`log-${log.type}`"
        >
          <span class="log-time">{{ log.time }}</span>
          <span class="log-type">{{ log.type.toUpperCase() }}</span>
          <span class="log-message">{{ log.message }}</span>
        </div>
        <div v-if="logs.length === 0" class="log-empty">
          No logs yet. Console output will appear here.
        </div>
      </div>
    </div>
  </q-page>
</template>

<script>
import { defineComponent, ref, onMounted, nextTick, watch, inject } from 'vue'
import { useRouter } from 'vue-router'
import { useQuasar } from 'quasar'
import { useI18n } from 'vue-i18n'
import MainHeader from 'src/components/MainHeader.vue'
import { useDebugLogger } from 'src/composables/useDebugLogger'

export default defineComponent({
  name: 'DebugPage',
  components: {
    MainHeader,
  },
  setup() {
    const router = useRouter()
    const $q = useQuasar()
    const { t } = useI18n()
    const terminalBody = ref(null)
    const { logs, clearLogs, stopInterception } = useDebugLogger()
    const $copyText = inject('$copyText', null)

    function formatLogsForCopy() {
      if (logs.value.length === 0) {
        return 'No logs available.'
      }

      return logs.value.map(log => {
        return `[${log.time}] ${log.type.toUpperCase()}: ${log.message}`
      }).join('\n')
    }

    function copyLogs() {
      const logsText = formatLogsForCopy()
      
      if ($copyText) {
        $copyText(logsText).then(() => {
          $q.notify({
            message: t('Copied to clipboard'),
            timeout: 2000,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        }).catch(() => {
          $q.notify({
            message: t('Failed to copy'),
            timeout: 2000,
            icon: 'error',
            color: 'negative'
          })
        })
      } else {
        // Fallback to native clipboard API
        navigator.clipboard?.writeText(logsText).then(() => {
          $q.notify({
            message: t('Copied to clipboard'),
            timeout: 2000,
            icon: 'mdi-clipboard-check',
            color: 'blue-9'
          })
        }).catch(() => {
          $q.notify({
            message: t('Failed to copy'),
            timeout: 2000,
            icon: 'error',
            color: 'negative'
          })
        })
      }
    }

    function handleClose() {
      // Clear the terminal logs
      clearLogs()
      // Stop the global console log interceptor
      stopInterception()
      // Hide the debug icon by updating localStorage
      localStorage.setItem('debugIconVisible', 'false')
      // Navigate back
      router.go(-1)
    }

    // Auto-scroll to bottom when new logs are added
    watch(logs, () => {
      nextTick(() => {
        if (terminalBody.value) {
          terminalBody.value.scrollTop = terminalBody.value.scrollHeight
        }
      })
    }, { deep: true })

    onMounted(() => {
      // Scroll to bottom on mount
      nextTick(() => {
        if (terminalBody.value) {
          terminalBody.value.scrollTop = terminalBody.value.scrollHeight
        }
      })
    })

    return {
      logs,
      terminalBody,
      clearLogs,
      copyLogs,
      handleClose,
    }
  }
})
</script>

<style scoped lang="scss">
.debug-page {
  display: flex;
  flex-direction: column;
  padding: 20px;
  overflow: hidden !important;
}

.terminal-container {
  max-height: 50vh;
  display: flex;
  flex-direction: column;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  background: #1e1e1e;
  color: #d4d4d4;
  font-family: 'Courier New', monospace;
  font-size: 12px;
  line-height: 1.5;
}

.terminal-container.dark {
  background: #0d1117;
  color: #c9d1d9;
}

.terminal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 8px 12px;
  background: #2d2d2d;
  border-bottom: 1px solid #3e3e3e;
}

.terminal-container.dark .terminal-header {
  background: #161b22;
  border-bottom: 1px solid #30363d;
}

.terminal-title {
  font-weight: bold;
  color: #fff;
}

.terminal-body {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
  background: #1e1e1e;
  min-height: 0;
}

.terminal-container.dark .terminal-body {
  background: #0d1117;
}

.log-line {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  word-break: break-word;
  padding: 2px 0;
}

.log-time {
  color: #858585;
  min-width: 80px;
  font-size: 11px;
}

.log-type {
  min-width: 50px;
  font-weight: bold;
  font-size: 10px;
}

.log-message {
  flex: 1;
  white-space: pre-wrap;
}

.log-log .log-type {
  color: #4ec9b0;
}

.log-info .log-type {
  color: #569cd6;
}

.log-warn .log-type {
  color: #dcdcaa;
}

.log-error .log-type {
  color: #f48771;
}

.log-debug .log-type {
  color: #c586c0;
}

.log-empty {
  color: #858585;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

/* Scrollbar styling */
.terminal-body::-webkit-scrollbar {
  width: 8px;
}

.terminal-body::-webkit-scrollbar-track {
  background: #2d2d2d;
}

.terminal-container.dark .terminal-body::-webkit-scrollbar-track {
  background: #161b22;
}

.terminal-body::-webkit-scrollbar-thumb {
  background: #555;
  border-radius: 4px;
}

.terminal-body::-webkit-scrollbar-thumb:hover {
  background: #777;
}
</style>

