# syntax=docker/dockerfile:1

# Runs the Expo dev server with an ngrok tunnel so a dev client on a real
# device can reach Metro over the public internet. See docs/Railway.md.

FROM node:24-slim

# Tools needed to compile native deps (e.g. better-sqlite3) during
# `pnpm install`. Purged after install to keep the image small.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    python3 \
    make \
    g++ \
    ca-certificates \
    git \
  && rm -rf /var/lib/apt/lists/*

# Enable pnpm via corepack, pinned to the version in package.json#packageManager.
ENV PNPM_HOME=/pnpm
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.33.0 --activate

WORKDIR /repo

# Copy workspace manifests first so Docker can cache the install layer.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc ./
COPY patches ./patches
COPY app/package.json ./app/package.json
COPY packages/core/package.json ./packages/core/package.json
COPY packages/schema/package.json ./packages/schema/package.json

# Install the full workspace. devDependencies are required because
# @expo/ngrok (the tunnel provider) lives there.
RUN pnpm install --frozen-lockfile

# Copy the rest of the sources.
COPY . .

WORKDIR /repo/app

# Railway injects $PORT at runtime. Fall back to 8081 for local `docker run`.
ENV PORT=8081
EXPOSE 8081

# `--tunnel` asks Expo to open an ngrok tunnel (using @expo/ngrok from
# node_modules) and print the public URL. `--dev-client` tells the dev
# server to expect connections from the custom dev client build rather
# than Expo Go.
CMD ["sh", "-c", "pnpm expo start --tunnel --dev-client --port ${PORT:-8081}"]
