#!/bin/bash
set -a
. /configs/base/config.sh
. /configs/spr-tailscale/config.sh

sysctl -q -w net.ipv4.ip_forward=1
if [ -e /proc/sys/net/ipv6/conf/all/forwarding ]; then
    sysctl -q -w net.ipv6.conf.all.forwarding=1
fi

# TS_STATE_DIR is set in docker-compose.yml
tailscaled & >$TAILSCALE_STATE_DIR/stdout.log 2>$TAILSCALE_STATE_DIR/stderr.log

/tailscale_plugin
