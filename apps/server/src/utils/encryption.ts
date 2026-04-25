import crypto from 'crypto';

const algorithm = 'aes-256-cbc';
// Ensure VAULT_ENCRYPTION_KEY is a 32-byte hex string or generate a fallback for dev
const ENCRYPTION_KEY = process.env.VAULT_ENCRYPTION_KEY 
  ? Buffer.from(process.env.VAULT_ENCRYPTION_KEY, 'hex')
  : crypto.scryptSync('fallback_secret_do_not_use_in_prod', 'salt', 32); 
const IV_LENGTH = 16;

export function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(algorithm, ENCRYPTION_KEY, iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

export function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv(algorithm, ENCRYPTION_KEY, iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}
