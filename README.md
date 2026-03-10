# 🎉 WhatsApp Sticker Bot

Bot de WhatsApp que convierte imágenes en stickers automáticamente usando **WAHA** + **Node.js** + **sharp**.

## Cómo funciona

```
Usuario envía imagen → WAHA → Webhook → Bot convierte a WebP 512×512 → WAHA → Sticker enviado
```

## Requisitos

- Node.js 18+ (o Docker)
- WAHA corriendo (`devlikeapro/waha`)

---

## 🚀 Inicio rápido con Docker Compose (recomendado)

```bash
# 1. Clona / descarga el proyecto
cd whatsapp-sticker-bot

# 2. Levanta WAHA + el bot
docker compose up -d

# 3. Escanea el QR en el dashboard de WAHA
open http://localhost:3000/dashboard

# 4. Registra el webhook (reemplaza con tu IP local o dominio)
node setup-webhook.js http://TU_IP:8080/webhook
```

---

## 🛠 Inicio manual (sin Docker)

```bash
# 1. Instalar dependencias
npm install

# 2. Configurar variables de entorno
cp .env.example .env
# Edita .env con tu configuración

# 3. Asegúrate de que WAHA esté corriendo en localhost:3000

# 4. Iniciar el bot
npm start

# 5. Registrar el webhook en WAHA
node setup-webhook.js http://localhost:8080/webhook
```

---

## ⚙️ Variables de entorno

| Variable | Default | Descripción |
|---|---|---|
| `WAHA_URL` | `http://localhost:3000` | URL de tu instancia WAHA |
| `WAHA_SESSION` | `default` | Nombre de la sesión WAHA |
| `WAHA_API_KEY` | _(vacío)_ | API Key si la configuraste en WAHA |
| `PORT` | `8080` | Puerto del bot |

---

## 📱 Uso

1. Envía cualquier imagen al número de WhatsApp conectado
2. El bot responde con la imagen convertida en sticker ✅

También responde a `hola`, `help` o `start` con instrucciones.

---

## 🎨 Personalización del sticker

En `src/index.js`, función `convertToSticker()`, puedes ajustar:

- **`fit: "contain"`** → mantiene proporción con padding transparente
- **`fit: "cover"`** → recorta para llenar 512×512
- **`fit: "fill"`** → estira la imagen
- **`quality: 90`** → calidad del WebP (0-100)

---

## 🐛 Troubleshooting

**El bot no recibe mensajes**
→ Verifica que el webhook esté registrado: `node setup-webhook.js`
→ Si usas localhost, WAHA necesita ver tu bot (usa la IP real de tu máquina, no `localhost`)

**Error al descargar la imagen**
→ Comprueba que `WAHA_URL` y `WAHA_SESSION` sean correctos

**Sticker no aparece como sticker**
→ Algunas versiones de WAHA gratuito no soportan `asSticker:true`; prueba con WAHA Plus
