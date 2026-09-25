FROM python:3.12.10-slim-bookworm

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates ffmpeg flac \
    && rm -rf /var/lib/apt/lists/* \
    && useradd --system --uid 10001 --home-dir /app --shell /usr/sbin/nologin app
COPY requirements.txt ./
RUN pip install --no-cache-dir --requirement requirements.txt
COPY --chown=app:app main.py wsgi.py ./
USER app
EXPOSE 4002
CMD ["gunicorn", "--bind", "0.0.0.0:4002", "main:app", "--workers", "2", "--log-level", "info", "--timeout", "150"]
