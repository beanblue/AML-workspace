FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm install
COPY . .
ENV DEPLOY_TARGET=local
RUN npm run build
EXPOSE 3000
CMD ["node", "server/index.js"]
