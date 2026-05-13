#!/bin/bash
set -e

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
ssh -p 10000 18610726373@192.168.88.9 << 'EOF'
sudo docker rm -f aml
sudo docker load < /tmp/aml-workspace-amd64.tar.gz
cd /zspace/aml
sudo docker run -d -p 3000:3000 --env-file .env --name aml aml-workspace:amd64
EOF

echo "✅ 更新完成！访问 `http://192.168.88.9:3000`"
