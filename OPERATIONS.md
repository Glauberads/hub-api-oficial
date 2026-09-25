# MultiZap 5.5 internal operations

Run commands from `/home/deploy/gads` as root because `.env.production` is intentionally root-only.

## Start

```bash
docker compose -p gads --env-file .env.production up -d
```

## Status

```bash
docker compose -p gads --env-file .env.production ps
```

## Stop without deleting containers or data

```bash
docker compose -p gads --env-file .env.production stop
```

## Recreate after an approved configuration change

```bash
docker compose -p gads --env-file .env.production up -d
```

## Rollback this phase while preserving database/upload volumes

```bash
docker compose -p gads --env-file .env.production down --remove-orphans
```

The six named volumes remain after `down` so rollback is recoverable. Do not add `--volumes` unless permanent deletion of MultiZap data is explicitly approved.

Pre-install evidence and protected configuration copies are stored under `/root/backups-multizap/preinstall-20260925T050635Z`.
