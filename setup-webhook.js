#!/usr/bin/env node
/**
 * setup-webhook.js
 * Registra automáticamente el webhook del bot en WAHA.
 * Uso: node setup-webhook.js [webhook_url]
 * Ejemplo: node setup-webhook.js http://192.168.1.10:8080/webhook
 */

require("dotenv").config();
const axios = require("axios");

const WAHA_URL = process.env.WAHA_URL || "http://localhost:3000";
const WAHA_SESSION = process.env.WAHA_SESSION || "default";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";

const webhookUrl = process.argv[2] || `http://localhost:${process.env.PORT || 8080}/webhook`;

const waha = axios.create({
  baseURL: WAHA_URL,
  headers: {
    "Content-Type": "application/json",
    ...(WAHA_API_KEY && { "X-Api-Key": WAHA_API_KEY }),
  },
});

async function main() {
  console.log(`\n🔧 Configurando webhook en WAHA...`);
  console.log(`   Session : ${WAHA_SESSION}`);
  console.log(`   Webhook : ${webhookUrl}\n`);

  try {
    // 1. Crear sesión si no existe
    try {
      await waha.post(`/api/sessions/start`, { name: WAHA_SESSION });
      console.log("✅ Sesión iniciada");
    } catch (e) {
      if (e.response?.status === 422 || e.response?.status === 409) {
        console.log("ℹ️  La sesión ya existe");
      } else {
        throw e;
      }
    }

    // 2. Registrar webhook
    await waha.put(`/api/sessions/${WAHA_SESSION}`, {
      webhooks: [
        {
          url: webhookUrl,
          events: ["message"],  // solo eventos de mensajes
          hmac: null,
        },
      ],
    });

    console.log("✅ Webhook registrado correctamente");
    console.log("\n📱 Ahora escanea el QR en:");
    console.log(`   ${WAHA_URL}/dashboard\n`);

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
    process.exit(1);
  }
}

main();
