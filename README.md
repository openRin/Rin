# Rin
Rin is a simple, fast web framework for blog.

## Features
- Simple and fast
- OAuth support
- RESTful API

## Setup
Please make sure you have installed [Bun](https://bun.sh/) first.
```bash
$ bun install
```

Then create the database by:
```bash
$ bun gen
```

Then run the database migration to create the database by:
```bash
$ bun mig
```


Copy the `.env.example` to `.env` and modify the configuration.

Now you can run the server by:
```bash
$ bun dev
```