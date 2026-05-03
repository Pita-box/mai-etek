"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendPasswordResetEmail = sendPasswordResetEmail;
const env_1 = require("../utils/env");
const RESEND_API_BASE = "https://api.resend.com";
const EMAIL_TIMEOUT_MS = 8000;
function getEmailConfig() {
    const apiKey = (0, env_1.getEnvValue)("RESEND_API_KEY");
    const from = (0, env_1.getEnvValue)("EMAIL_FROM");
    if (!apiKey || !from) {
        return null;
    }
    return { apiKey, from };
}
async function sendPasswordResetEmail(input) {
    const config = getEmailConfig();
    if (!config) {
        throw new Error("Email provider is not configured");
    }
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), EMAIL_TIMEOUT_MS);
    try {
        const response = await fetch(`${RESEND_API_BASE}/emails`, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${config.apiKey}`,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                from: config.from,
                to: input.to,
                subject: "Obnova hesla",
                html: `
          <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #111827;">
            <h1 style="font-size: 22px; margin-bottom: 16px;">Obnova hesla</h1>
            <p>Toto je automatická zpráva. Požádal/a jsi o nastavení nového hesla.</p>
            <p style="margin: 24px 0;">
              <a href="${input.resetUrl}" style="display: inline-block; padding: 12px 18px; background: #be123c; color: #ffffff; text-decoration: none; border-radius: 10px;">
                Nastavit nové heslo
              </a>
            </p>
            <p>Pokud jsi o obnovu hesla nežádal/a, tento e-mail ignoruj.</p>
          </div>
        `,
                text: `Obnova hesla\n\nOtevři odkaz pro nastavení nového hesla:\n${input.resetUrl}\n\nPokud jsi o obnovu hesla nežádal/a, tento e-mail ignoruj.`,
            }),
            signal: controller.signal,
        });
        if (!response.ok) {
            throw new Error(`Email provider returned ${response.status}`);
        }
    }
    finally {
        clearTimeout(timeout);
    }
}
