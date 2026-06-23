import crypto from 'node:crypto'

const IV_LENGTH = 12
const ENCRYPTED_FIELDS = ['ci', 'name', 'phone', 'gender', 'nationality', 'birthday', 'email']

function decryptUserData(encryptedBase64, base64EncodedKey, aad) {
  const decoded = Buffer.from(encryptedBase64, 'base64')
  const key = Buffer.from(base64EncodedKey, 'base64')
  const iv = decoded.subarray(0, IV_LENGTH)
  const ciphertext = decoded.subarray(IV_LENGTH)
  const tag = ciphertext.subarray(ciphertext.length - 16)
  const encrypted = ciphertext.subarray(0, ciphertext.length - 16)

  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv)
  decipher.setAAD(Buffer.from(aad))
  decipher.setAuthTag(tag)

  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString('utf-8')
}

export function isTossDecryptConfigured() {
  return Boolean(process.env.DECRYPTION_KEY_BASE64?.trim() && process.env.AAD_STRING?.trim())
}

export function decryptTossUserInfo(userInfo) {
  const key = process.env.DECRYPTION_KEY_BASE64?.trim()
  const aad = process.env.AAD_STRING?.trim()

  if (!key || !aad || !userInfo) {
    return userInfo
  }

  const decrypted = {}

  for (const field of ENCRYPTED_FIELDS) {
    const value = userInfo[field]
    decrypted[field] =
      typeof value === 'string' ? decryptUserData(value, key, aad) : (value ?? null)
  }

  return {
    ...userInfo,
    ...decrypted,
  }
}
