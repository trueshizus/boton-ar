# BotonAr

BotonAr is a moderation bot for Reddit. It uses AI to give a summary of the modqueue and modmail, and to help with responding to users.

## Getting Started

1. Clone the repository

```bash
git clone https://github.com/trueshizus/boton-ar.git
```

2. Start docker compose

```bash
docker compose up -d
```

3. Add a subreddit to the tracked list

```bash
curl -X POST http://localhost:3000/api/subreddit -H "Content-Type: application/json" -d '{"subreddit": "example"}'
```

## Overview

BotonAr uses Reddit's API to interact with Reddit Moderation endpoints.

### Tech Stack

- Bun
- SQLite + Drizzle
- Redis + BullMQ
- Hono

### Dev Tools

- Cursor
- Bruno
- Docker Compose

## Description

### Mod Queue

### Modmail

### Modlog

### Subreddit
