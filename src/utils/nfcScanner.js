import { Capacitor } from "@capacitor/core";
import { NFC } from '@exxili/capacitor-nfc';

class NFCScanner {
    constructor() {
        this.isScanning = false;
    }

    async startScan() {
        console.log('Attempting to start NFC scan...');
        if (this.isScanning) return;
        this.isScanning = true;

        try {
            // Start NFC scanning (iOS only, android is always scanning NFC in the background)
            if (!Capacitor.isNativePlatform()) return;
            if (Capacitor.getPlatform() === 'ios') {
                await NFC.startScan();
            }
        } catch (error) {
            console.error('Error starting NFC scan:', error);
        }
    }

    async onRead(callback) {
        console.log('onRead:', callback)
        // Listen for NFC tag detection
        NFC.onRead((data) => {
            
            console.log('NFC Tag detected:', data);
            const tag = {}
            const asString = data.string();
            console.log('Records:', asString.messages[0]?.records);

            const info = asString.tagInfo;
            if (info?.fallback) {
                console.log('Reader fallback mode:', info.fallbackMode, 'Reason:', info.reason);
            } else if (info) {
                console.log('Tag UID:', info.uid);
                console.log('Tag technologies:', info.techTypes);
                console.log('Tag type:', info.type);
                if (info.maxSize) {
                    console.log('Max NDEF size:', info.maxSize);
                }
                console.log('Is writable:', info.isWritable);
                tag['uid'] = info.uid;
                tag['techTypes'] = info.techTypes;
                tag['type'] = info.type;
                tag['maxSize'] = info.maxSize;
                tag['isWritable'] = info.isWritable;
            }
            

            const ndefRecords = asString.messages[0]?.records;
            const records = []
            for (const record of ndefRecords) {
                console.log('Record type:', record.type);
                console.log('Record payload:', record.payload);
                const type = record.type === 'U' ? 'uri' : 'text';
                records.push({
                    type,
                    payload: record.payload
                });
            }

            tag['records'] = records;

            callback(tag);
        });

        // Handle NFC errors
        NFC.onError((error) => {
            console.error('NFC Error:', error);
        });
    }

    async stopScan() {
        if (!this.isScanning) return;
        this.isScanning = false;

        try {
            // Stop NFC scanning (iOS only, android is always scanning NFC in the background)
            if (!Capacitor.isNativePlatform()) return;
            if (Capacitor.getPlatform() === 'ios') {
                await NFC.stopScan();
            }
        } catch (error) {
            console.error('Error stopping NFC scan:', error);
        }
    }
}

const nfcScannerInstance = new NFCScanner();
export default nfcScannerInstance;

// Export a function to start NFC scanning and listen for tag detection
export async function startNFCScan(callback) {
    await nfcScannerInstance.startScan();
    await nfcScannerInstance.onRead(callback);
}
