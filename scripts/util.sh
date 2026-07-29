function sylica() {
  jq -r ".$1" "$PLATFORM_CONF"
}