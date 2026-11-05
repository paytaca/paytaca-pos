import { ElectrumNetworkProvider } from 'cashscript0.11.5'

// Keep the library's default network/server and reconnection behavior, but
// reuse the connection instead of disconnecting after every block-height read.
export class CardElectrumProvider extends ElectrumNetworkProvider {
  constructor(network, options = {}) {
    super(network, { ...options, manualConnectionManagement: true })
    this.connectionPromise = null
  }

  connect() {
    // Warm-up and a tap may arrive together. The underlying client's connect
    // is also safe to call when already connected or after a dropped connection.
    if (!this.connectionPromise) {
      this.connectionPromise = super.connect().finally(() => {
        this.connectionPromise = null
      })
    }
    return this.connectionPromise
  }

  async performRequest(name, ...parameters) {
    await this.connect()
    return super.performRequest(name, ...parameters)
  }

  warmUp() {
    // Preparation is optional. A failed warm-up must not prevent scanning;
    // the actual chain read will attempt to connect again and fail closed.
    return this.connect().catch(() => {
      console.warn('[CardElectrum] Connection warm-up failed; will retry on chain read.')
    })
  }
}

export const cardElectrumProvider = new CardElectrumProvider()
