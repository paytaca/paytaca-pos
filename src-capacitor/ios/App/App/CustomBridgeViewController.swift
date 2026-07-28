import Capacitor

class CustomBridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SaveToGalleryPlugin())
    }
}
