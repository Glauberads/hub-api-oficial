#!/bin/bash

echo "==============================="
echo "    Instalador do App Python    "
echo "==============================="

# Caminho do arquivo de variáveis
ARQUIVO_VARIAVEIS="/root/instalador_single_oficial/VARIAVEIS_INSTALACAO"

# Carrega variáveis da empresa
carregar_variaveis() {
  if [ -f "$ARQUIVO_VARIAVEIS" ]; then
    source "$ARQUIVO_VARIAVEIS"
  else
    empresa="multiflow"
  fi
}
carregar_variaveis

CAMINHO_API="/home/deploy/${empresa:-multiflow}/api_transcricao/main.py"
APP_NAME="api_transcricao"

# Atualizar pacotes
sudo apt update && sudo apt upgrade -y

# Instalar ffmpeg corretamente (remover versão quebrada se existir)
if ffmpeg -version &>/dev/null 2>&1 && ldd /usr/bin/ffmpeg | grep -q "libavdevice"; then
  echo "✅ ffmpeg já instalado e funcional"
else
  echo "📦 Removendo ffmpeg quebrado e reinstalando..."
  sudo apt remove --purge ffmpeg libav* -y
  sudo apt autoremove -y
  sudo apt clean
  sudo rm -rf /var/lib/apt/lists/*
  sudo apt update
  sudo apt install ffmpeg -y
  echo "🔍 Verificando instalação..."
  ldd /usr/bin/ffmpeg | grep libavdevice
  ffmpeg -version
fi

# Verificar e instalar Python3
if command -v python3 &>/dev/null; then
  echo "✅ Python3 já instalado: $(python3 --version)"
else
  echo "📦 Instalando Python3..."
  sudo apt install -y python3
fi

# Verificar e instalar pip3
if command -v pip3 &>/dev/null; then
  echo "✅ pip3 já instalado: $(pip3 --version)"
else
  echo "📦 Instalando pip3..."
  sudo apt install -y python3-pip
fi

# Verificar e instalar venv
if python3 -m venv --help &>/dev/null; then
  echo "✅ python3-venv já instalado"
else
  echo "📦 Instalando python3-venv..."
  sudo apt install -y python3-venv
fi

# Verificar e instalar flac
if command -v flac &>/dev/null; then
  echo "✅ flac já instalado"
else
  echo "📦 Instalando flac..."
  sudo apt install -y flac
fi

# Instalar dependências do Python
pip3 install flask SpeechRecognition pydub ffmpeg-python python-dotenv

# Instalar PM2 (se não tiver)
if command -v pm2 &>/dev/null; then
  echo "✅ PM2 já instalado"
else
  echo "📦 Instalando PM2..."
  sudo npm install -g pm2
fi

# Verificar se o arquivo main.py existe
if [ ! -f "$CAMINHO_API" ]; then
  echo "❌ ERRO: Arquivo não encontrado: $CAMINHO_API"
  exit 1
fi

# Inicia com PM2
pm2 start "$CAMINHO_API" --interpreter python3 --name "$APP_NAME"

# Salvar configuração do PM2
pm2 save

# Ativar PM2 para iniciar junto com o servidor
pm2 startup

echo "=============================================="
echo " Instalação concluída com sucesso! ✅"
echo " App rodando no PM2 com o nome: $APP_NAME"
echo "=============================================="
echo ""
echo "=============================================="
echo "  CREDENCIAIS DE ACESSO PADRÃO"
echo "=============================================="
echo "  Email: admin@admin.com"
echo "  Senha: 123456"
echo "=============================================="
