#!/usr/bin/env bash
# Vercel 构建脚本：从环境变量生成 js/env.js
# 在 Vercel 项目 Settings → Environment Variables 中设置：
#   SUPABASE_URL, SUPABASE_ANON_KEY

set -e

ENV_FILE="js/env.js"

cat > "$ENV_FILE" <<EOF
// ⚠️ 此文件由构建脚本自动生成，请勿手动编辑或提交到 Git
window.__ENV__ = {
  SUPABASE_URL: '${SUPABASE_URL:-}',
  SUPABASE_ANON_KEY: '${SUPABASE_ANON_KEY:-}',
};
EOF

echo "✅ $ENV_FILE 已生成"
