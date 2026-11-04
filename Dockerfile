FROM mirror.gcr.io/library/node:22-slim
WORKDIR /app
# Claude Code CLI, bundled from vendor/ (npm install @anthropic-ai/claude-code there)
COPY vendor/node_modules /opt/cc/node_modules
ENV PATH=/opt/cc/node_modules/.bin:$PATH HOME=/home/node NODE_ENV=production PORT=8080 DISABLE_AUTOUPDATER=1
COPY server.js ./
COPY public ./public
USER node
EXPOSE 8080
CMD ["node", "server.js"]
