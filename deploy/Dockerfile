FROM node:22.21.1-trixie AS base
# Why not use bun? https://github.com/cloudflare/workers-sdk/issues/7196

# build image
# FROM base AS builder

# ARG TARGETARCH

# WORKDIR /workdir

# RUN apt-get update && apt-get install -y curl

# # downloads latest workerd release
# RUN curl -LO \
#     $(curl -s https://api.github.com/repos/cloudflare/workerd/releases/latest \
#     | grep -wo "https.*linux-$([ $TARGETARCH = "arm64" ] && echo "arm64" || echo "64").gz")

# RUN ls -la && gunzip workerd*.gz && mv workerd* workerd && chmod +x workerd

# # copies runtime libraries
# RUN mkdir lib && \
#     cp /lib/*-linux-gnu/libdl.so.2 lib/libdl.so.2 && \
#     cp /lib/*-linux-gnu/librt.so.1 lib/librt.so.1

# install
FROM base AS install

WORKDIR /app

COPY .. /app

RUN cd /app && npm install

RUN npm run b

# container basis workerd
# FROM busybox:glibc

# ENV MINIFLARE_WORKERD_PATH="/usr/bin/workerd"

# COPY --from=builder /workdir/workerd /usr/bin/workerd
# COPY --from=builder /workdir/lib /usr/lib

# WORKDIR /worker

# ENTRYPOINT [ "workerd" ]

# container image
FROM base

# use workerd
# COPY --from=builder /workdir/workerd /usr/bin/workerd
# COPY --from=builder /workdir/lib /usr/lib
# ENV MINIFLARE_WORKERD_PATH="/usr/bin/workerd"

# copy assets
COPY --from=install /app/client /app/client
COPY --from=install /app/docs /app/docs
COPY --from=install /app/deploy /app/deploy
COPY --from=install /app/scripts /app/scripts
COPY --from=install /app/server /app/server
COPY --from=install /app/node_modules /app/node_modules
COPY --from=install /app/package.json /app/package.json
COPY --from=install /app/turbo.json /app/turbo.json
COPY --from=install /app/wrangler.example.toml /app/wrangler.example.toml
COPY --from=install /app/LICENSE /app/LICENSE
COPY --from=install /app/README.md /app/README.md
COPY --from=install /app/.dev.example.vars /app/.dev.example.vars

ENV RIN_APP_SRV_IP=0.0.0.0 RIN_APP_UI_IP=0.0.0.0

WORKDIR /app

ENTRYPOINT [ "/bin/sh", "/app/deploy/entrypoint.sh" ]
