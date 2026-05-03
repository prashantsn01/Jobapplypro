# server/Dockerfile
# Used for docker-compose (local) and can be used on Render with Docker runtime.
# Render's native Node runtime (render.yaml) is preferred — uses start.sh instead.

FROM node:20-alpine AS base
WORKDIR /app

# Install deps (separate layer for caching)
COPY package.json ./
RUN npm install --omit=dev

# Copy source
COPY . .

# Generate Prisma client (must run after node_modules exist)
RUN npx prisma generate

# Render / Railway / Fly inject PORT at runtime
EXPOSE 3000
ENV NODE_ENV=production

# start.sh handles: migrate → seed → node index.js
RUN chmod +x scripts/start.sh
CMD ["sh", "scripts/start.sh"]
