# Use official Node.js image as builder
FROM node:20-alpine AS builder

WORKDIR /app

# Copy package descriptors
COPY package.json ./

# Install dependencies
RUN npm install

# Copy source files
COPY . .

# Build Vite frontend and esbuild backend bundle
RUN npm run build

# Runtime Stage
FROM node:20-alpine

WORKDIR /app

# Copy package.json to manage dependencies
COPY package.json ./

# Install only production dependencies
RUN npm install --omit=dev

# Copy build output and compiled server bundle from builder stage
COPY --from=builder /app/dist ./dist

# Create a default data directory inside container
RUN mkdir -p /app/data

EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000
ENV DATA_DIR=/app/data

# Run the compiled production CJS server
CMD ["node", "dist/server.cjs"]
