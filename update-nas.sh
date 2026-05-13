#!/bin/bash
set -e

echo "请输入极空间 sudo 密码："
read -s NAS_SUDO_PASS

echo "🔄 拉取最新代码..."
git pull

echo "🔧 修正 Dockerfile Node 版本..."
sed -i '' 's/node:18-alpine/node:20-alpine/' Dockerfile 2>/dev/null || \
sed -i 's/node:18-alpine/node:20-alpine/' Dockerfile

echo "🏗️ 构建 AMD64 镜像（约5分钟）..."
docker buildx build --platform linux/amd64 -t aml-workspace:amd64 .

echo "📦 导出镜像..."
docker save aml-workspace:amd64 | gzip > ~/aml-workspace-amd64.tar.gz

echo "📤 传输到极空间..."
scp -P 10000 ~/aml-workspace-amd64.tar.gz 18610726373@192.168.88.9:/tmp/

echo "🚀 更新极空间容器..."
ssh -p 10000 18610726373@192.168.88.9 \
  "echo \"$NAS_SUDO_PASS\" | sudo -S docker rm -f aml 2>/dev/null; \
   echo \"$NAS_SUDO_PASS\" | sudo -S docker load < /tmp/aml-workspace-amd64.tar.gz; \
   echo \"🧩 自动获取 Notion 数据库 ID...\"; \
   echo \"$NAS_SUDO_PASS\" | sudo -S docker run --rm --env-file /zspace/aml/.env \
     aml-workspace:amd64 node scripts/setup-notion-ids.js > /tmp/aml-notion-ids.env; \
   echo \"$NAS_SUDO_PASS\" | sudo -S sh -c 'grep -vE \"^(NOTION_DB_DOCUMENTS|NOTION_DB_ORG|NOTION_DB_KPI|NOTION_DB_SELF_EVAL|NOTION_DB_SUSPICIOUS)=\" /zspace/aml/.env > /tmp/aml-env.cleaned || true; cat /tmp/aml-env.cleaned /tmp/aml-notion-ids.env > /zspace/aml/.env'; \
   cat /tmp/aml-notion-ids.env; \
   echo \"$NAS_SUDO_PASS\" | sudo -S docker run -d -p 3000:3000 \
     --env-file .env --name aml aml-workspace:amd64"

echo "✅ 更新完成！访问 `http://192.168.88.9:3000`"
