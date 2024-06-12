#!/bin/sh

if ! bun check; then
    echo "TypeScript compilation failed. Please fix the errors before committing."
    exit 1
fi

#!/bin/sh

# 获取 commit-msg 钩子传递的参数，即提交信息文件的路径
COMMIT_MSG_FILE="$1"
# 读取提交信息文件的内容
COMMIT_MSG=$(cat "$COMMIT_MSG_FILE")
# 检查提交信息格式
if ! echo "$COMMIT_MSG" | grep -E '^(feat|chore|fix|docs|ci|style|test|pref): ' > /dev/null; then
    echo "ERROR: Commit message does not start with one of the following: feat|chore|fix|docs|ci|style|test|pref"
    echo "Please ensure your commit message starts with one of these prefixes followed by a colon and a space."
    exit 1
fi

exit 0