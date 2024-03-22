#!/bin/bash
set -a
. /configs/base/config.sh
. /configs/spr-tailscale/config.sh

TAILSCALE_STATE_DIR=/state/plugins/spr-tailscale/tailscaled
tailscaled & >$TAILSCALE_STATE_DIR/stdout.log 2>$TAILSCALE_STATE_DIR/stderr.log

/tailscale_plugin
