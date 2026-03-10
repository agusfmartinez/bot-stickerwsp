FROM node:20-alpine

# sharp necesita libvips
RUN apk add --no-cache vips-dev fftw-dev gcc g++ make python3

WORKDIR /app

COPY package*.json ./
RUN npm install --production

COPY src/ ./src/

EXPOSE 8080

CMD ["node", "src/index.js"]
