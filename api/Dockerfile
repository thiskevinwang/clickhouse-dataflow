FROM oven/bun:1.2.15

ENV NODE_ENV=production

WORKDIR /app

COPY package.json .
RUN bun install --production

COPY tsconfig.json .
COPY src ./src

EXPOSE 8000

CMD ["bun", "run", "src/index.ts"]
