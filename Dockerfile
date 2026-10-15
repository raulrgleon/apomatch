FROM node:24-bookworm-slim AS base
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
FROM base AS dependencies
COPY package*.json ./
COPY prisma ./prisma
RUN npm ci
FROM dependencies AS build
COPY . .
RUN npm run build
FROM base AS migrations
COPY --from=dependencies /app/node_modules ./node_modules
COPY package*.json ./
COPY prisma ./prisma
COPY scripts/create-admin.ts scripts/cleanup.ts ./scripts/
COPY src/lib/security.ts src/lib/db.ts ./src/lib/
USER node
CMD ["node","node_modules/prisma/build/index.js","migrate","deploy"]
FROM base AS runner
ENV NODE_ENV=production HOSTNAME=0.0.0.0 PORT=3000
COPY --from=build --chown=node:node /app/.next/standalone ./
COPY --from=build --chown=node:node /app/.next/static ./.next/static
COPY --from=build --chown=node:node /app/public ./public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["node","server.js"]
