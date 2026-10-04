# ─────────────────────────────────────────────
# Stage 1 : Build
# ─────────────────────────────────────────────
FROM node:22-alpine AS builder

# Prisma utilise OpenSSL pour sélectionner et exécuter son moteur natif.
RUN apk add --no-cache openssl

WORKDIR /app

# Copie des manifests et du schéma Prisma
COPY package*.json ./
COPY prisma ./prisma/

# Installation de toutes les dépendances (dev inclus pour le build)
RUN npm ci
RUN ILA_IP_LOCATION_DB=iptoasn-country ILA_AUTO_UPDATE=false ILA_SILENT=true node node_modules/ip-location-api/script/updatedb.cjs

# Génération du client Prisma
RUN npx --no-install prisma generate

# Copie du code source et compilation TypeScript
COPY . .
RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 : Production
# ─────────────────────────────────────────────
FROM node:22-alpine AS production
ARG APP_REVISION=unknown
LABEL org.opencontainers.image.revision=$APP_REVISION

RUN apk add --no-cache openssl

WORKDIR /app

# Dépendances de production uniquement
COPY package*.json ./
COPY prisma ./prisma/
# Le CLI Prisma est conservé comme peer optionnel du client dans le lockfile.
# Vérifier sa présence pour ne jamais télécharger une autre version au démarrage.
RUN npm ci --omit=dev && npx --no-install prisma --version

# Copie du client Prisma généré depuis le stage builder
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Copie du code compilé et du schéma Prisma
ENV ILA_IP_LOCATION_DB=iptoasn-country ILA_AUTO_UPDATE=false ILA_SILENT=true
COPY --from=builder /app/node_modules/ip-location-api/data ./node_modules/ip-location-api/data
COPY --from=builder /app/dist ./dist

# Script de démarrage
COPY entrypoint.sh ./
RUN chmod +x entrypoint.sh

EXPOSE 3001

ENTRYPOINT ["./entrypoint.sh"]
