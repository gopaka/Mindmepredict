# ==============================================================================
# MindMePredict — Nifty StrangleCopilot Institutional Docker Image
# Multi-platform support: linux/amd64 (x86_64) and linux/arm64 (AWS Graviton)
# ==============================================================================

FROM python:3.11-slim

# Prevent Python from writing .pyc files and enable unbuffered streaming stdout/stderr
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# Install minimal OS dependencies for health checking and C-extensions
RUN apt-get update && apt-get install -y --no-install-recommends \
    curl \
    gcc \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Create dedicated non-root operational user for secure EC2 hosting
RUN groupadd -r trader && useradd -r -g trader -u 1000 -d /home/trader -m trader

WORKDIR /app

# Install Python dependencies first to leverage Docker layer caching
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip \
    && pip install --no-cache-dir -r requirements.txt

# Copy application sources
COPY engine/ ./engine/
COPY static/ ./static/
COPY main.py .

# Create persistent storage folder for session keys and broker tokens
RUN mkdir -p /app/data && chown -R trader:trader /app

# Switch to non-root user
USER trader

# Expose default HTTP application port
EXPOSE 8000

# Container Healthcheck (pings root static dashboard)
HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
    CMD curl -f http://localhost:${PORT}/ || exit 1

# Launch production ASGI server (1 worker ensures unified 1-minute background worker & SSE queue)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000", "--workers", "1"]

