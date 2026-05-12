// index.js
import makeWASocket, {
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  downloadMediaMessage
} from "@whiskeysockets/baileys";

import Pino from "pino";
import qrcode from "qrcode-terminal";
import sharp from "sharp";
import { Sticker, StickerTypes } from "wa-sticker-formatter";
import fs from "fs";
import path from "path";

async function start() {
  const { state, saveCreds } = await useMultiFileAuthState("./auth");
  const { version } = await fetchLatestBaileysVersion();

  const sock = makeWASocket({
    version,
    auth: state,
    printQRInTerminal: true,
    logger: Pino({ level: "info" }),
    browser: ["Chrome (Linux)", "", ""], // 👈 clave
  });

  // Mostrar QR en consola si hace falta
  sock.ev.on("connection.update", (u) => {
    console.log("UPDATE:", u);

    const { connection, qr, lastDisconnect } = u;
    if (qr) {
      console.log("📱 ESCANEÁ ESTE QR:\n");
      qrcode.generate(qr, { small: true });
    }
    if (connection === "close") {
      console.log("❌ conexión cerrada");
      const reason = lastDisconnect?.error?.output?.statusCode;
      if (reason !== DisconnectReason.loggedOut) start(); // reintentar
    } else if (connection === "open") {
      console.log("✅ Bot conectado");
    }
  });

  sock.ev.on("creds.update", saveCreds);

  // Utilidad: convertir imagen a WebP cuadrado 512x512
  const imageToWebpBuffer = async (inputBuffer) => {
    // recorte centrado cuadrado + resize + webp
    return await sharp(inputBuffer)
      .resize(512, 512, { fit: "cover" })
      .webp({ quality: 90, lossless: false })
      .toBuffer();
  };

  // Listener de mensajes
  sock.ev.on("messages.upsert", async ({ messages }) => {
    const m = messages?.[0];
    if (!m || !m.message) return;

    const jid = m.key.remoteJid;
    const isImage =
      !!m.message.imageMessage ||
      (m.message.documentMessage &&
        m.message.documentMessage?.mimetype?.startsWith("image/"));
    const isCmdSticker =
      m.message?.conversation?.trim().toLowerCase() === "!sticker" ||
      m.message?.extendedTextMessage?.text?.trim().toLowerCase() === "!sticker";

    // Dos modos:
    // 1) Le respondés a una imagen con "!sticker"
    // 2) O simplemente le mandás una imagen y el bot te la devuelve como sticker
    if (!isImage && !isCmdSticker) return;

    try {
      // Si el mensaje original es texto "!sticker", buscamos si está respondiendo a una imagen
      let refMsg = m;
      if (isCmdSticker && m.message?.extendedTextMessage?.contextInfo?.quotedMessage) {
        refMsg = { ...m, message: m.message.extendedTextMessage.contextInfo.quotedMessage };
      }

      const hasImage =
        !!refMsg.message?.imageMessage ||
        (refMsg.message?.documentMessage &&
          refMsg.message.documentMessage.mimetype?.startsWith("image/"));

      if (!hasImage) {
        // Pedir que manden imagen si no hay
        if (isCmdSticker) {
          await sock.sendMessage(jid, { text: "Mandame una imagen o respondé una con *!sticker* 📸" }, { quoted: m });
        }
        return;
      }

      // Descargar imagen en buffer
      const mediaBuffer = await downloadMediaMessage(
        { key: m.key, message: refMsg.message },
        "buffer",
        {},
        { logger: Pino({ level: "silent" }) }
      );

      // Convertir a webp 512x512
      const webpBuf = await imageToWebpBuffer(mediaBuffer);

      // Crear Sticker con metadatos (opcional)
      const sticker = new Sticker(webpBuf, {
        pack: "Agus Pack",
        author: "WA Bot",
        type: StickerTypes.FULL, // FULL = cuadrado completo
        quality: 80,
      });

      const stickerBuffer = await sticker.toBuffer();

      // Enviar sticker
      await sock.sendMessage(jid, { sticker: stickerBuffer }, { quoted: m });
      console.log("➡️  Sticker enviado");
    } catch (err) {
      console.error("Error generando sticker:", err);
      await sock.sendMessage(jid, { text: "Ups, no pude convertir esa imagen 😅" }, { quoted: m });
    }
  });
}

start().catch(console.error);