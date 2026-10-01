# ─────────────────────────────────────────────
# Stage 1 : Build
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copie des manifests et du schéma Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Installation de toutes les dépendances (dev inclus pour le build)
RUN npm ci

# Génération du client Prisma
RUN npx prisma generate

# Copie du code source et compilation TypeScript
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 : Production
# ─────────────────────────────────────────────
FROM node:20-alpine AS production

WORKDIR /app

# Dépendances de production uniquement
COPY package*.json ./
RUN npm ci --omit=dev

# Copie du client Prisma généré depuis le stage builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copie du code compilé et du schéma Prisma
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma

# Script de démarrage
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
