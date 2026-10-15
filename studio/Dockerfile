# TapIt Studio: self-hosted planning workspace. No external services at build or run time
# apart from the npm registry during `npm ci`.
FROM node:22-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

FROM node:22-alpine AS build
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

FROM node:22-alpine AS run
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3100 HOSTNAME=0.0.0.0 \
    PLANNING_DIR=/planning STUDIO_DATA_DIR=/data
COPY --from=build /app/.next/standalone ./
COPY --from=build /app/.next/static ./.next/static
# The mockups are served through the login-protected API, not from /public.
COPY --from=build /app/prototypes ./prototypes
# /data holds the database and uploads (mount a volume). /planning is the repo's planning folder.
RUN mkdir -p /data /planning && chown -R node:node /data /planning /app
USER node
EXPOSE 3100
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3100/api/health >/dev/null || exit 1
CMD ["node", "server.js"]
