#!/bin/bash
set -a
. /configs/base/config.sh
. /configs/spr-tailscale/config.sh

# TS_STATE_DIR is set in docker-compose.yml
tailscaled & >$TAILSCALE_STATE_DIR/stdout.log 2>$TAILSCALE_STATE_DIR/stderr.log

/tailscale_plugin
