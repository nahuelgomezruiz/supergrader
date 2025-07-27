FROM python:3.11-slim

# Disable Python cache for smaller image
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Copy backend code
COPY backend/ backend/

# Install dependencies
RUN cd backend && pip install --no-cache-dir -r requirements.txt

# Create data directory
RUN mkdir -p backend/data/caveats

EXPOSE 8000

# Run from backend directory
WORKDIR /app/backend
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"] 