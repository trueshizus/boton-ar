# BotonAr

BotonAr is a moderation bot for Reddit.

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

## Description
