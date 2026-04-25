"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.encrypt = encrypt;
exports.decrypt = decrypt;
const crypto_1 = __importDefault(require("crypto"));
const algorithm = 'aes-256-cbc';
// Ensure VAULT_ENCRYPTION_KEY is a 32-byte hex string or generate a fallback for dev
const ENCRYPTION_KEY = process.env.VAULT_ENCRYPTION_KEY
    ? Buffer.from(process.env.VAULT_ENCRYPTION_KEY, 'hex')
    : crypto_1.default.scryptSync('fallback_secret_do_not_use_in_prod', 'salt', 32);
const IV_LENGTH = 16;
function encrypt(text) {
    const iv = crypto_1.default.randomBytes(IV_LENGTH);
    const cipher = crypto_1.default.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
}
function decrypt(text) {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift(), 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = crypto_1.default.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
}
