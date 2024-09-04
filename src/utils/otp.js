import crypto from 'crypto';

export function generateTOTP(secret, digits = 6, interval = 30, timestamp = null) {
    if (timestamp === null) {
        timestamp = Date.now() / 1000;
    }
    
    const timecode = Math.floor(timestamp / interval).toString();

    const hmac = crypto.createHmac('sha256', Buffer.from(secret, 'utf-8'));
    hmac.update(timecode);

    const hexDigest = hmac.digest('hex');

    const byteCount = maxBytesForDecimalDigits(digits)
    const truncatedHexDigest = hexDigest.substring(hexDigest.length - byteCount * 2)

    const code = parseInt(truncatedHexDigest, 16) % Math.pow(10, digits);
    return code.toString().padStart(digits, '0');
}

function maxBytesForDecimalDigits(n) {
    // Maximum value for n digits
    const maxValue = Math.pow(10, n) - 1;
    
    // Calculate the number of bits required
    const bitsRequired = Math.ceil(Math.log2(maxValue));
    
    // Convert bits to bytes and round up
    const bytesRequired = Math.ceil(bitsRequired / 8);
    
    return bytesRequired;
}