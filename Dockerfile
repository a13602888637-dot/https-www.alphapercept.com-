# Dockerfile for Python FastAPI service
FROM python:3.11-slim

# Set working directory
WORKDIR /app

# Copy requirements file
COPY python-data-service/requirements.txt .

# Install dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Copy application code
COPY python-data-service/app ./app

# Expose port (Railway will override this with $PORT)
EXPOSE 8000

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD python -c "import requests; requests.get('http://localhost:8000/health')" || exit 1

# Start command (Railway will provide $PORT)
CMD uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}
