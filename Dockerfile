# Evaluation image for the public AppEndO-Release tree:
#   dist/server.cjs   esbuild bundle; npm packages stay external
#   source/           scrubbed platform source (setup, Prisma schema, node_modules)
#   packages/         bundled package zips (present in the snapshot; not imported here)
#
# settings.json is read from process.cwd(). The entrypoint makes that directory
# a folder on the data volume and links node_modules at /opt/appendo so the
# externalized dist/server.cjs can resolve packages.
#
# SQL Server remains the documented production control plane. This image is a
# PostgreSQL evaluation path only, and the process runs as root.

FROM node:22-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends python3 make g++ openssl ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /opt/appendo

COPY source/package.json source/package-lock.json ./source/
WORKDIR /opt/appendo/source
# tsx is a devDependency, and `npm run setup` is `tsx scripts/setup.ts`.
# Production install omits devDependencies, then tsx is added on its own so
# Playwright, Electron, and the rest of the dev tree stay out of the image.
RUN npm ci --omit=dev \
  && npm install --no-save --ignore-scripts tsx@4.23.1

WORKDIR /opt/appendo
COPY dist ./dist
COPY source ./source
COPY packages ./packages
COPY docker/entrypoint.sh docker/prepare-settings.mjs ./docker/
RUN chmod +x /opt/appendo/docker/entrypoint.sh \
  && mkdir -p /var/lib/appendo

ENV NODE_ENV=production
ENV APPENDO_SOURCE_ROOT=/opt/appendo/source
ENV APPENDO_DATA_ROOT=/var/lib/appendo
EXPOSE 3000
ENTRYPOINT ["/opt/appendo/docker/entrypoint.sh"]
