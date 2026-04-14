require("dotenv").config();
const { Client, LocalAuth, MessageMedia } = require("whatsapp-web.js");
const sharp = require("sharp");
const qrcode = require("qrcode-terminal");

// ─── Config ──────────────────────────────────────────────────────────────────

const SESSION_PATH = process.env.SESSION_PATH || "./.wwebjs_auth";

// ─── Cliente WhatsApp ────────────────────────────────────────────────────────

const client = new Client({
  authStrategy: new LocalAuth({ dataPath: SESSION_PATH }),
  puppeteer: {
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  },
});

// ─── Utilidades ───────────────────────────────────────────────────────────────

async function convertToSticker(imageBuffer) {
  return await sharp(imageBuffer)
    .resize(512, 512, {
      fit: "contain",
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    })
    .webp({ quality: 90 })
    .toBuffer();
}

function wait(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function typingDelayMs(len = 0) {
  return 600 + Math.floor(Math.random() * 900) + Math.min(40 * len, 2500);
}

async function sendText(chat, text) {
  await chat.sendStateTyping();
  await wait(typingDelayMs(text.length));
  await chat.clearState();
  await chat.sendMessage(text);
}

// ─── Eventos ──────────────────────────────────────────────────────────────────

client.on("qr", (qr) => {
  console.log("\n📱 Escaneá este QR con WhatsApp:\n");
  qrcode.generate(qr, { small: true });
});

client.on("ready", () => {
  console.log("✅ Bot conectado y listo!");
});

client.on("authenticated", () => {
  console.log("🔐 Sesión autenticada");
});

client.on("auth_failure", (msg) => {
  console.error("❌ Error de autenticación:", msg);
});

client.on("disconnected", (reason) => {
  console.warn("⚠️ Desconectado:", reason);
});

client.on("message", async (message) => {
  // Ignorar mensajes propios
  if (message.fromMe) return;

  const chat = await message.getChat();
  const hasMedia = message.hasMedia;
  const type = message.type; // 'image', 'sticker', 'chat', etc.

  console.log(`📩 Mensaje de ${message.from} | tipo: ${type} | hasMedia: ${hasMedia}`);

  // Marcar como visto
  try {
    await chat.sendSeen();
  } catch (_) {}

  // Si es sticker entrante, ignorar
  if (type === "sticker") return;

  // Si no tiene media o no es imagen
  if (!hasMedia || type !== "image") {
    await sendText(
      chat,
      "👋 ¡Hola! Soy el *StickerBot* 🎉\n\n" +
      "📸 Envíame cualquier *imagen* y la convertiré en un *sticker* al instante.\n\n" +
      "_Soporta JPG, PNG y otros formatos de imagen._"
    );
    return;
  }

  // Notificar que estamos procesando
  try {
    await sendText(chat, "⏳ Convirtiendo tu imagen en sticker...");
  } catch (_) {}

  try {
    // 1. Descargar la imagen
    const media = await message.downloadMedia();
    const imageBuffer = Buffer.from(media.data, "base64");
    console.log(`✅ Imagen descargada (${Math.round(imageBuffer.length / 1024)} KB)`);

    // 2. Convertir a WebP
    const stickerBuffer = await convertToSticker(imageBuffer);
    console.log("✅ Sticker generado");

    // 3. Enviar como sticker nativo ✅
    const stickerMedia = new MessageMedia("image/webp", stickerBuffer.toString("base64"), "sticker.webp");
    await message.reply(stickerMedia, null, { sendMediaAsSticker: true });
    console.log(`✅ Sticker enviado a ${message.from}`);

  } catch (err) {
    console.error("❌ Error:", err.message);
    try {
      await sendText(chat, "😅 Hubo un error al convertir la imagen. Intenta con otra.");
    } catch (_) {}
  }
});

// ─── Iniciar ──────────────────────────────────────────────────────────────────

console.log("🤖 Iniciando StickerBot...");
client.initialize();
