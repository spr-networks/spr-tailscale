FROM ubuntu:24.04 as builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get install -y --no-install-recommends nftables iproute2 netcat-traditional inetutils-ping net-tools nano ca-certificates git curl sudo
RUN mkdir /code
WORKDIR /code
ARG TARGETARCH
RUN curl -O https://dl.google.com/go/go1.21.4.linux-${TARGETARCH}.tar.gz
RUN rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.4.linux-${TARGETARCH}.tar.gz
ENV PATH="/usr/local/go/bin:$PATH"
COPY code/ /code/

ARG USE_TMPFS=true
RUN --mount=type=tmpfs,target=/tmpfs \
    [ "$USE_TMPFS" = "true" ] && ln -s /tmpfs /root/go; \
    go build -ldflags "-s -w" -o /tailscale_plugin /code/

FROM node:18 as builder-ui  
WORKDIR /app
COPY frontend ./  
ARG USE_TMPFS=true
RUN --mount=type=tmpfs,target=/tmpfs \
    [ "$USE_TMPFS" = "true" ] && \
        mkdir /tmpfs/cache /tmpfs/node_modules && \
        ln -s /tmpfs/node_modules /app/node_modules && \
        ln -s /tmpfs/cache /usr/local/share/.cache; \
    yarn install --network-timeout 86400000 && yarn run bundle

FROM ghcr.io/spr-networks/container_template:latest
ENV DEBIAN_FRONTEND=noninteractive
RUN curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
RUN curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/noble.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list
RUN apt-get update
RUN apt-get install -y --no-install-recommends tailscale
COPY scripts /scripts/
COPY --from=builder /tailscale_plugin /
COPY --from=builder-ui /app/build/ /ui/

##TBD split from builder
ENTRYPOINT ["/scripts/startup.sh"]
