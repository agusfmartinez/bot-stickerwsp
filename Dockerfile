FROM node:20-bullseye-slim

# Dependencias de Chromium para puppeteer
RUN apt-get update && apt-get install -y \
    chromium \
    fonts-freefont-ttf \
    ca-certificates \
    --no-install-recommends \
    && rm -rf /var/lib/apt/lists/*

ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

WORKDIR /app

COPY package.json ./package.json
RUN npm install --production

COPY src/index.js ./src/index.js

# Persistir la sesión de WhatsApp
VOLUME ["/app/.wwebjs_auth"]

CMD ["node", "src/index.js"]
