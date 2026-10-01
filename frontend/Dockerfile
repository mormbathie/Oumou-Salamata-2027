# ─────────────────────────────────────────────
# Stage 1 : Build React avec Vite
# ─────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

COPY package*.json ./
RUN npm ci

COPY . .

# Variables d'environnement baked-in au build time
# Keycloak est accessible depuis le browser via localhost:8080
ARG VITE_KEYCLOAK_URL=http://localhost:8080
ARG VITE_KEYCLOAK_REALM=oumou-salamat
ARG VITE_KEYCLOAK_CLIENT_ID=oumou-salamat-app

ENV VITE_KEYCLOAK_URL=$VITE_KEYCLOAK_URL
ENV VITE_KEYCLOAK_REALM=$VITE_KEYCLOAK_REALM
ENV VITE_KEYCLOAK_CLIENT_ID=$VITE_KEYCLOAK_CLIENT_ID

RUN npm run build

# ─────────────────────────────────────────────
# Stage 2 : Serveur Nginx
# ─────────────────────────────────────────────
FROM nginx:1.27-alpine AS production

# Copie des fichiers buildés
COPY --from=builder /app/dist /usr/share/nginx/html

# Configuration Nginx personnalisée
COPY nginx.conf /etc/nginx/conf.d/default.conf

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
