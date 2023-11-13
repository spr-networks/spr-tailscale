FROM ubuntu:23.04 as builder
ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update
RUN apt-get install -y --no-install-recommends nftables iproute2 netcat-traditional inetutils-ping net-tools nano ca-certificates git curl
RUN mkdir /code
WORKDIR /code
ARG TARGETARCH
RUN curl -O https://dl.google.com/go/go1.21.4.linux-${TARGETARCH}.tar.gz
RUN rm -rf /usr/local/go && tar -C /usr/local -xzf go1.21.4.linux-${TARGETARCH}.tar.gz
ENV PATH="/usr/local/go/bin:$PATH"
COPY code/ /code/

RUN --mount=type=tmpfs,target=/root/go/ (go build -ldflags "-s -w" -o /tailscale_plugin /code/)
#RUN go get
RUN go install github.com/go-delve/delve/cmd/dlv@latest

#RUN (go build -o /tailscale_plugin /code/)

FROM ghcr.io/spr-networks/container_template:latest
ENV DEBIAN_FRONTEND=noninteractive
ENV ENABLE_TAILSCALE=true
RUN curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/lunar.noarmor.gpg | tee /usr/share/keyrings/tailscale-archive-keyring.gpg >/dev/null
RUN curl -fsSL https://pkgs.tailscale.com/stable/ubuntu/lunar.tailscale-keyring.list | tee /etc/apt/sources.list.d/tailscale.list
RUN apt-get update
RUN apt-get install -y --no-install-recommends tailscale
COPY scripts /scripts/
COPY --from=builder /root/go/bin/dlv /
COPY --from=builder /tailscale_plugin /

ENV DEBUG=true
EXPOSE 2345
ENTRYPOINT ["/scripts/startup.sh"]
#ENTRYPOINT ["/bin/bash"]
