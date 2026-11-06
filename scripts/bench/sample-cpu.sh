#!/usr/bin/env bash
set -eu
while :; do
  for service in db app k6; do
    for container in $(docker ps -q --filter label=com.docker.compose.project=bidlock --filter label=com.docker.compose.service="$service"); do
      printf '%s %s %s\n' "$(date -u +%FT%TZ)" "$service" "$container"
      docker exec "$container" sh -c 'cat /sys/fs/cgroup/cpu.stat; cat /sys/fs/cgroup/cpu.max' || true
    done
  done
  sleep 2
done
