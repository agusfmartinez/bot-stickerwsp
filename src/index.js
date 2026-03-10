require("dotenv").config();
const express = require("express");
const axios = require("axios");
const sharp = require("sharp");

const app = express();
app.use(express.json({ limit: "50mb" }));

const WAHA_URL = process.env.WAHA_BASE_URL || "http://localhost:3000";
const WAHA_SESSION = process.env.WAHA_SESSION || "default";
const WAHA_API_KEY = process.env.WAHA_API_KEY || "";
const PORT = process.env.PORT || 8080;

// Axios instance para WAHA
const waha = axios.create({
  baseURL: WAHA_URL,
  headers: {
    "Content-Type": "application/json",
    ...(WAHA_API_KEY && { "X-Api-Key": WAHA_API_KEY }),
  },
});

// ─── Utilidades ──────────────────────────────────────────────────────────────

/**
 * Descarga el media de un mensaje usando WAHA y lo devuelve como Buffer.
 */
async function downloadMedia(session, messageId, chatId) {
  const response = await waha.get(
    `/api/${session}/messages/${messageId}/download`,
    {
      params: { chatId },
      responseType: "arraybuffer",
    }
  );
  return Buffer.from(response.data);
}

async function downloadMediaFromUrl(url) {
  const response = await axios.get(url, {
    responseType: "arraybuffer",
    headers: {
      ...(WAHA_API_KEY && { "X-Api-Key": WAHA_API_KEY }),
    },
  });
  return Buffer.from(response.data);
}

/**
 * Convierte un buffer de imagen en un sticker WebP 512×512 con fondo transparente.
 * WhatsApp requiere WebP estático para stickers simples.
 */
async function convertToSticker(imageBuffer) {
  const sticker = await sharp(imageBuffer)
    .resize(64, 64, {
      fit: "contain",        // mantiene proporción
      background: { r: 0, g: 0, b: 0, alpha: 0 }, // fondo transparente
    })
    .webp({ quality: 90 })
    .toBuffer();

  return sticker.toString("base64");
}

async function sendText(chatId, text) {
  await waha.post(`/api/sendText`, {
    session: WAHA_SESSION,
    chatId,
    text,
  });
}

async function sendSeen(chatId) {
  await waha.post(`/api/sendSeen`, {
    session: WAHA_SESSION,
    chatId,
  });
}

async function startTyping(chatId) {
  await waha.post(`/api/startTyping`, {
    session: WAHA_SESSION,
    chatId,
  });
}

async function stopTyping(chatId) {
  await waha.post(`/api/stopTyping`, {
    session: WAHA_SESSION,
    chatId,
  });
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typingDelayMs(textLength = 0) {
  const base = 600 + Math.floor(Math.random() * 900);
  const perChar = Math.min(40 * textLength, 2500);
  return base + perChar;
}

async function sendMessage(chatId, reply) {
  try {
      await startTyping(chatId);
      await wait(typingDelayMs(reply.length));
      await stopTyping(chatId);
    } catch (_) {}
  await sendText(chatId, reply);
}

/**
 * Envía un sticker a través de WAHA.
 * WAHA acepta el sticker como imagen con mimetype image/webp y mediatype sticker.
 */
async function sendSticker(chatId, base64Webp) {

  try {
    await startTyping(chatId);
    await wait(typingDelayMs(5000));
    await stopTyping(chatId);
  } catch (_) {}

  // await waha.post(`/api/sendFile`, {
  //   session: WAHA_SESSION,
  //   chatId,
  //   file: {
  //     mimetype: "image/webp",
  //     filename: "sticker.webp",
  //     data: base64Webp,
  //   }
  // });
  await waha.post(`/api/sendFile`, {
    session: WAHA_SESSION,
    chatId,
    file: {
      mimetype: "image/webp",
      filename: null,
      data: base64Webp,
      _dataType: "sticker",
      stickerMessage: null,
    },
    asSticker: true,  // flag especial de WAHA para enviar como sticker
  });
}

// ─── Webhook Handler ─────────────────────────────────────────────────────────

app.post("/webhook", async (req, res) => {
  // Responder 200 inmediatamente para que WAHA no reintente
  res.sendStatus(200);

  const event = req.body;

  console.log("📩 event:", JSON.stringify(req.body, null, 2));

  // Solo procesar eventos de mensajes nuevos
  if (event.event !== "message") return;

  const message = event.payload;
  if (!message) return;

  // Ignorar mensajes propios para evitar loops
  if (message.fromMe) return;

  const chatId = message.from;
  const hasMedia = message.hasMedia;
  const mediaType = message._data?.type; // image, video, document, etc.

  try {
    await wait(1000)
    await sendSeen(chatId);
  } catch (_) {}

  console.log(`📩 Mensaje de ${chatId} | hasMedia: ${hasMedia}`);

  // Solo procesar si es una imagen
  if (!hasMedia && mediaType !== "sticker") {
    // Si el usuario envió algo que no es imagen, explicar qué hacer
    // const body = (message.body || "").trim().toLowerCase();
  
    try {
      const reply =
      "👋 ¡Hola! Soy el *StickerBot* 🎉\n\n" +
      "📸 Envíame cualquier *imagen* y la convertiré en un *sticker* al instante.\n\n" +
      "_Soporta JPG, PNG y otros formatos de imagen._";
      await sendMessage(chatId, reply);
    } catch (_) {}
    return;
  }

  // Notificar que estamos procesando (opcional, mejora la UX)
  try {
    const processingMsg = "⏳ Convirtiendo tu imagen en sticker...";
    await sendMessage(chatId, processingMsg);
  } catch (_) {}

  try {
    // 1. Descargar la imagen
    let imageBuffer;
    if (message.media?.url) {
      imageBuffer = await downloadMediaFromUrl(message.media.url);
    } else if (message._data?.body && mediaType === "image") {
      imageBuffer = Buffer.from(message._data.body, "base64");
    } else {
      imageBuffer = await downloadMedia(
        WAHA_SESSION,
        message.id,
        chatId
      );
    }
    console.log(`✅ Imagen descargada (${Math.round(imageBuffer.length / 1024)} KB)`);

    // 2. Convertir a WebP sticker
    const base64Sticker = await convertToSticker(imageBuffer);
    console.log("✅ Sticker generado");

    // 3. Enviar el sticker
    await sendSticker(chatId, base64Sticker);
    console.log(`✅ Sticker enviado a ${chatId}`);

  } catch (err) {
    console.error("❌ Error al procesar imagen:", err.message);
    try {
      await sendMessage(chatId, "😅 Hubo un error al convertir la imagen. Intenta con otra imagen.");
    } catch (_) {}
  }
});

// ─── Health check ─────────────────────────────────────────────────────────────

app.get("/health", (req, res) => {
  res.json({ status: "ok", session: WAHA_SESSION, wahaUrl: WAHA_URL });
});

// ─── Iniciar servidor ─────────────────────────────────────────────────────────

app.listen(PORT, async () => {
  console.log(`\n🤖 StickerBot iniciado en puerto ${PORT}`);
  console.log(`📡 WAHA URL: ${WAHA_URL}`);
  console.log(`📱 Session: ${WAHA_SESSION}`);
  console.log(`\n➡️  Registra el webhook en WAHA apuntando a:`);
  console.log(`   http://<TU_IP_O_DOMINIO>:${PORT}/webhook\n`);

  // Verificar conexión con WAHA
  try {
    const { data } = await waha.get(`/api/sessions/${WAHA_SESSION}`);
    console.log(`✅ Conexión con WAHA OK | Estado: ${data.status}`);
  } catch (err) {
    console.warn(`⚠️  No se pudo conectar con WAHA: ${err.message}`);
    console.warn("   Asegúrate de que WAHA esté corriendo antes de usar el bot.\n");
  }
});
