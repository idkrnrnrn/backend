FROM python:3.12-slim

WORKDIR /app
COPY services/llm-screening/requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir -r /app/requirements.txt

COPY services/llm-screening/app /app/app

ENV PYTHONUNBUFFERED=1
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8001"]
