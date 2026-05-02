# Monorepo: API lives in backend/
FROM python:3.12-slim-bookworm
WORKDIR /app

ENV PYTHONUNBUFFERED=1
ENV PIP_NO_CACHE_DIR=1

COPY backend/requirements.txt .
RUN pip install --upgrade pip && pip install -r requirements.txt

COPY backend/ .

RUN mkdir -p uploads/children

EXPOSE 8765
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8765}"]
