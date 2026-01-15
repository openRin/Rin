#!/bin/sh
###
 # @Author: Bin
 # @Date: 2026-01-12
 # @FilePath: /Rin/deploy/entrypoint.sh
### 

# migrator data
node --experimental-strip-types ./scripts/dev-migrator.ts

# server start
npm run start
