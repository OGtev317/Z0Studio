# syntax=docker/dockerfile:1.7
FROM --platform=linux/amd64 rust:1.97.1-alpine3.23@sha256:83b16fd204613a557527e81ef4f87fd513229187c49635e3c7f96b08dfa43c33 AS build

WORKDIR /src
COPY Cargo.toml Cargo.lock ./
COPY src ./src
RUN cargo build --locked --release --target x86_64-unknown-linux-musl

FROM scratch
COPY --from=build /src/target/x86_64-unknown-linux-musl/release/gigstark-enclave /gigstark-enclave
USER 65532:65532
ENTRYPOINT ["/gigstark-enclave"]
