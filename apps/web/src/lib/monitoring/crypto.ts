import "server-only"

import crypto from "node:crypto"

const PAIRING_CODE_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"

export function normalizePairingCode(value: string) {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, "")
}

export function hashMonitoringSecret(value: string) {
  return crypto.createHash("sha256").update(value).digest("hex")
}

export function generatePairingCode() {
  const bytes = crypto.randomBytes(8)
  let value = ""

  for (const byte of bytes) {
    value += PAIRING_CODE_ALPHABET[byte % PAIRING_CODE_ALPHABET.length]
  }

  return `${value.slice(0, 4)}-${value.slice(4)}`
}

export function generateDeviceToken() {
  return crypto.randomBytes(32).toString("base64url")
}
