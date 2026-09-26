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

## SMTP / recuperação de senha

O backend utiliza as seguintes configurações para envio de e-mails e recuperação de senha:

- MAIL_HOST
- MAIL_PORT
- MAIL_SECURE
- MAIL_USER
- MAIL_PASS
- MAIL_FROM

Exemplo com Gmail:

MAIL_HOST=smtp.gmail.com
MAIL_PORT=587
MAIL_SECURE=false

A variável MAIL_PASS deve utilizar uma Senha de App do Google.

O backend procura primeiro as configurações SMTP cadastradas na tabela Settings para a empresa correspondente e utiliza as variáveis de ambiente como fallback.

Nunca versionar senhas reais, tokens, chaves ou outras credenciais no Git.
