import Foundation
import Capacitor
import Photos
import UIKit

@objc(SaveToGalleryPlugin)
public class SaveToGalleryPlugin: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SaveToGalleryPlugin"
    public let jsName = "SaveToGallery"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "saveImage", returnType: CAPPluginReturnPromise)
    ]

    @objc func saveImage(_ call: CAPPluginCall) {
        guard let base64Data = call.getString("base64Data") else {
            call.reject("Must provide base64Data")
            return
        }

        let filename = call.getString("filename") ?? "IMG_\(Date().timeIntervalSince1970).png"

        guard let imageData = Data(base64Encoded: base64Data),
              let image = UIImage(data: imageData) else {
            call.reject("Failed to decode image")
            return
        }

        if #available(iOS 14, *) {
            let status = PHPhotoLibrary.authorizationStatus(for: .addOnly)
            switch status {
            case .authorized, .limited:
                self.saveImageToPhotoLibrary(image: image, filename: filename, call: call)
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization(for: .addOnly) { newStatus in
                    if newStatus == .authorized || newStatus == .limited {
                        self.saveImageToPhotoLibrary(image: image, filename: filename, call: call)
                    } else {
                        call.reject("Photo library permission denied")
                    }
                }
            default:
                call.reject("Photo library permission denied")
            }
        } else {
            let status = PHPhotoLibrary.authorizationStatus()
            switch status {
            case .authorized:
                self.saveImageToPhotoLibrary(image: image, filename: filename, call: call)
            case .notDetermined:
                PHPhotoLibrary.requestAuthorization { newStatus in
                    if newStatus == .authorized {
                        self.saveImageToPhotoLibrary(image: image, filename: filename, call: call)
                    } else {
                        call.reject("Photo library permission denied")
                    }
                }
            default:
                call.reject("Photo library permission denied")
            }
        }
    }

    private func saveImageToPhotoLibrary(image: UIImage, filename: String, call: CAPPluginCall) {
        var localIdentifier: String?

        PHPhotoLibrary.shared().performChanges({
            let creationRequest = PHAssetCreationRequest.forAsset()
            guard let pngData = image.pngData() else {
                call.reject("Failed to encode image")
                return
            }
            creationRequest.addResource(with: .photo, data: pngData, options: nil)
            localIdentifier = creationRequest.placeholderForCreatedAsset?.localIdentifier
        }) { success, error in
            DispatchQueue.main.async {
                if success, let identifier = localIdentifier {
                    call.resolve([
                        "filePath": identifier
                    ])
                } else {
                    let errorMessage = error?.localizedDescription ?? "Unknown error"
                    call.reject("Failed to save image to photo library: \(errorMessage)")
                }
            }
        }
    }
}
