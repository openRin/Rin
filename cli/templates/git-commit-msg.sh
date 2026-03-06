#!/bin/sh

if ! bun check; then
    echo "TypeScript compilation failed. Please fix the errors before committing."
    exit 1
fi

COMMIT_MSG_FILE="$1"
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")

if ! echo "$COMMIT_MSG" | grep -E '^(feat|chore|fix|docs|ci|style|test|pref): ' > /dev/null; then
    echo "ERROR: Commit message does not start with one of the following: feat|chore|fix|docs|ci|style|test|pref"
    echo "Please ensure your commit message starts with one of these prefixes followed by a colon and a space."
    exit 1
fi

exit 0
