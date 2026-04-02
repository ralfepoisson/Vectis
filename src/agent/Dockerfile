FROM python:3.11-slim

WORKDIR /app

COPY pyproject.toml README.md /app/
COPY agent /app/agent
COPY config /app/config

RUN pip install --no-cache-dir .

EXPOSE 8080

CMD ["vectis-agent", "--config", "config/agent.example.yaml"]
