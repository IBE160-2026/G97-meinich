# Tesseract with the Norwegian model, for the OCR measurements in analysis/.
# The ingestion pipeline will use the same engine, so measurements carry over.
FROM debian:bookworm-slim
RUN apt-get update \
 && apt-get install -y --no-install-recommends tesseract-ocr tesseract-ocr-nor \
 && rm -rf /var/lib/apt/lists/*
WORKDIR /work
ENTRYPOINT ["tesseract"]
