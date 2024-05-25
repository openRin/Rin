# use the official Bun image
# see all versions at https://hub.docker.com/r/oven/bun/tags
FROM oven/bun:1 as base
WORKDIR /usr/src

# copy node_modules from temp directory
# then copy all (non-ignored) project files into the image
FROM base AS prerelease
COPY . .
RUN bun install
# [optional] tests & build
ENV NODE_ENV=production
RUN bun m
RUN bun t
RUN bun b

# copy production dependencies and source code into final image
FROM base AS release
COPY --from=prerelease /usr/src/server/build/app .
COPY --from=prerelease /usr/src/server/sqlite.db ./init.db

# run the app
ENV DB_PATH=./data/sqlite.db
USER root
EXPOSE 3001/tcp
ENTRYPOINT [ "/usr/src/app" ]