# Development stage
FROM oven/bun:latest as development
WORKDIR /app

# Copy package.json first
COPY package.json ./

# Install dependencies (this will generate bun.lockb)
RUN bun install

# Copy source code
COPY . .

# Production stage (if needed later)
FROM oven/bun:latest as production
WORKDIR /app
COPY --from=development /app/package.json ./
COPY --from=development /app/bun.lockb ./
COPY --from=development /app/src ./src
RUN bun install --production
CMD ["bun", "run", "src/server.ts"] 