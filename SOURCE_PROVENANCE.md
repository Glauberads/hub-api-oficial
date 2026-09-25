# MultiZap 5.5 — Source provenance

- Source package: `/root/Multzap/01 FONTE V13.3/Multizap.zip`
- SHA256: `2d98619e21088aac7b534525b7ff1187e2f09d2d9e8cf844dde466aa0841b7cb`
- Version declared by backend, frontend and API Oficial: `5.5`
- Staged on: `2026-09-25` (UTC)
- Immutable extraction: `/home/deploy/gads/source-original`
- Working copy: `/home/deploy/gads/source`

## Deployment adaptations

- Replaced the backend lockfile's SSH transport for `whiskeysockets/libsignal-node` with HTTPS, preserving repository and commit `1c30d7d7e76a3b0aa120b04dc6a26f5a12dccf67`.
- Removed insecure fallback values for backend JWT and Redis secrets.
- Replaced component Dockerfiles with pinned Node 22 / Python 3.12 multi-stage or minimal builds using lockfile installs.
- Replaced the frontend runtime with Nginx in a container listening internally on port 3000.
- Restricted API Oficial CORS and disabled Swagger by default.
- Added isolated PostgreSQL 17 and Redis 7.4 services, persistent volumes, healthchecks and private container networking.
- Added no-new-privileges, bounded logs, restart policies and resource limits.
- Added `requests` as an exact Python dependency because the transcription source imports it directly.
- Added `setuptools==75.8.0`, required by the pinned Gunicorn 20 runtime on Python 3.12.
- Copied the audited Baileys patch script before `npm ci`, because the package declares it as a postinstall hook.
- Added persistent, non-root-writable backend volumes for public uploads, private files and application logs.
- Forced API Oficial port parsing to a number and an explicit internal TCP bind; the original string value created a Unix socket.
- Replaced the API Oficial healthcheck's Fetch call with `http.get`, because Fetch intentionally blocks TCP port 6000.

The official installer was not executed. Host Traefik, Node, PM2, PostgreSQL, Redis, firewall, SSH and cron are outside this deployment.
