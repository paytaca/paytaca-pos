import { WebPlugin } from '@capacitor/core'

export class AudioModeWeb extends WebPlugin {
  async isSilentOrDnd() {
    return { isSilentOrDnd: false }
  }
}
