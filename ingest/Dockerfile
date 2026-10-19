# Batch step 1 (Story 1.3a), with Tesseract for the filed documents (Story
# 2.1a). This is the project's one Tesseract image: the spike scripts in
# analysis/ocr/ run against it too, and test/one-tesseract-image.test.ts fails
# on a second Dockerfile that installs Tesseract.
# Both base images are pinned by exact tag, the Tesseract package by exact
# Debian version, the Norwegian model by tessdata_best commit and sha256,
# and the Python dependencies come from the committed uv.lock (`--frozen`).
# Build:  docker build ingest      Run:  pnpm ingest
FROM ghcr.io/astral-sh/uv:0.12.10 AS uv

FROM python:3.14.7-slim-trixie

# Tesseract 5.5 from trixie. No tesseract-ocr-nor: that package is Debian's
# copy of the integer `tessdata` model; the pinned `tessdata_best` model is
# added below.
RUN apt-get update \
 && apt-get install -y --no-install-recommends \
      tesseract-ocr=5.5.0-1+b1 libtesseract5=5.5.0-1+b1 \
 && rm -rf /var/lib/apt/lists/*

# nor.traineddata from tesseract-ocr/tessdata_best at a pinned commit,
# verified in the build. The same hash is NOR_TRAINEDDATA_SHA256 in
# src/peerless_ingest/ocr.py, which image_check compares at run time. It goes
# into the package's own tessdata directory, which also holds the `tsv`
# output config.
ENV TESSDATA_PREFIX=/usr/share/tesseract-ocr/5/tessdata
ADD https://raw.githubusercontent.com/tesseract-ocr/tessdata_best/e12c65a915945e4c28e237a9b52bc4a8f39a0cec/nor.traineddata ${TESSDATA_PREFIX}/nor.traineddata
RUN echo "451d52ba1559aa1aecf163ccbfdeced2b9605fbd49480f5e8a53ace29b9eb0e7  ${TESSDATA_PREFIX}/nor.traineddata" | sha256sum -c - \
 && chmod 0644 ${TESSDATA_PREFIX}/nor.traineddata

COPY --from=uv /uv /uvx /usr/local/bin/

ENV UV_COMPILE_BYTECODE=1 \
    UV_LINK_MODE=copy \
    UV_PYTHON_DOWNLOADS=never \
    UV_PROJECT_ENVIRONMENT=/app/.venv \
    PYTHONUNBUFFERED=1

WORKDIR /app

# Dependencies first, so a source change does not reinstall them.
COPY pyproject.toml uv.lock .python-version ./
RUN uv sync --frozen --no-dev --no-install-project

COPY config.toml ./
COPY src ./src
RUN uv sync --frozen --no-dev

# seed/coverage.json is mounted at run time (pnpm ingest); it lives outside
# this build context.
ENV PEERLESS_INGEST_CONFIG=/app/config.toml \
    PEERLESS_COVERAGE=/seed/coverage.json

# Never root: the step needs no privilege inside the container.
RUN useradd --system --uid 10001 ingest
USER ingest

ENTRYPOINT ["/app/.venv/bin/python", "-m", "peerless_ingest"]
