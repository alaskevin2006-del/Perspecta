FROM node:22-bookworm-slim
WORKDIR /app
ENV NODE_ENV=production HOST=0.0.0.0 PORT=3001 DEBATE_MODE=mock
COPY --chown=node:node package.json ./
COPY --chown=node:node src ./src
COPY --chown=node:node data ./data
COPY --chown=node:node scripts/health.mjs ./scripts/health.mjs
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 CMD ["node", "-e", "fetch('http://127.0.0.1:'+process.env.PORT+'/api/roles').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["node", "src/server.js"]
