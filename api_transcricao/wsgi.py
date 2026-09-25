from main import app
from waitress import serve
import os
import logging

port = int(os.getenv("PORT", 4002))

if __name__ == "__main__":
    logging.info(f"Servidor Waitress iniciado na porta {port}")
    serve(app, host="0.0.0.0", port=port, threads=8)