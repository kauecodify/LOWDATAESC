FROM python:3.11-slim

WORKDIR /app

# Dockerfile.ai_zerotrust
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY ai_zerotrust_engine.py .

EXPOSE 8000

# ------------------------ >>>> alterar se quiser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8000/health || exit 1

CMD ["python", "ai_zerotrust_engine.py"]
