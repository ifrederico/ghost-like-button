FROM node:20-bookworm-slim
WORKDIR /app
COPY package.json ./
RUN npm i --omit=dev
COPY server.js ./
USER node
EXPOSE 8787
ENV PORT=8787
CMD ["node", "server.js"]