# Rin
Rin is a simple, fast web framework for blog.

## Features
- Simple and fast
- OAuth support
- RESTful API
- Friend link & heart check

## Run
### Server
Copy the `.env.example` to `.env` and modify the configuration.

Copy the `docker-compose.yml` and modify the configuration.

Then run the server by:
```bash
$ docker-compose up -d
```

### Client

Fork this repository and deply on Cloudflare Pages.

Set the following parameters in the Cloudflare Pages:
```ini
Build command: bun b
Build output directory: /client/dist
Root directory: /
```

Set the following environment variables in the Cloudflare Pages:
```ini
NAME=Xeu #YOUR_SITE_NAME
DESCRIPTION=杂食动物 #YOUR_SITE_DESCRIPTION
AVATAR=https://avatars.githubusercontent.com/u/36541432 # Your site avatar URL
API_URL=https://rin.xeu.life # Your server API URL
SKIP_DEPENDENCY_INSTALL=true
UNSTABLE_PRE_BUILD=asdf install bun latest && asdf global bun latest && bun i
```


## Setup
Please make sure you have installed [Bun](https://bun.sh/) first.
```bash
$ bun install
```

Then create the database by:
```bash
$ bun g
```

Then run the database migration to create the database by:
```bash
$ bun m
```


Copy the `.env.example` to `.env` and modify the configuration.

Now you can run the server by:
```bash
$ bun dev
```

## Upgarde

### Server
```bash
docker-compose pull
docker-compose up -d
```

### Client

Just sync the forked repository.

# License
```
MIT License

Copyright (c) 2024 Xeu

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```