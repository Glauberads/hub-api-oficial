module.exports = {
  apps: [
    {
      name: "api-transcricao",
      cwd: "/home/deploy/empresa01/api_transcricao",
      script: "./.venv/bin/gunicorn",
      args: "-b 0.0.0.0:4002 wsgi:app",
      interpreter: "none",
      watch: false,
      env: {
        PYTHONUNBUFFERED: "1"
      }
    }
  ]
}
