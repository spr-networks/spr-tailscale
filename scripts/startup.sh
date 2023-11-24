#!/bin/bash
set -a

TAILSCALE_STATE_DIR=/state/tailscale/tailscaled

tailscaled & >$TAILSCALE_STATE_DIR/stdout.log 2>$TAILSCALE_STATE_DIR/stderr.log

. /scripts/up.sh

/tailscale_plugin
