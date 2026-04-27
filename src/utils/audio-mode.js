import { registerPlugin } from '@capacitor/core'

const AudioMode = registerPlugin('AudioMode', {
  web: () => import('./audio-mode-web').then(m => new m.AudioModeWeb())
})

export default AudioMode
