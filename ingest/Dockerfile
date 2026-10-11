# Batch step 1 (Story 1.3a). Both base images are pinned by exact tag; the
# Python dependencies come from the committed uv.lock (`--frozen`).
# Build:  docker build ingest      Run:  pnpm ingest
FROM ghcr.io/astral-sh/uv:0.12.10 AS uv

FROM python:3.14.7-slim-trixie

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
