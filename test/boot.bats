#!/usr/bin/env bats

load lib

setup_file() {
    build_artifacts >&2
}

_register_tests() {
    local platform feature
    while read -r platform; do
        while read -r feature; do
            bats_test_function --description "$feature: $platform" -- run_test "$platform" "$feature"
        done < <(platform_tests "$platform")
    done < <(platforms)
}
_register_tests
