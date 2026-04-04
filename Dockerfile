FROM node:20-slim AS builder

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .
RUN npx quasar build

FROM node:20-slim

WORKDIR /app

RUN npm install -g serve

COPY --from=builder /app/dist/spa /app/dist/spa

EXPOSE 8080

CMD ["serve", "-s", "/app/dist/spa", "-l", "8080"]
