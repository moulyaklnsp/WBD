FROM node:18-alpine AS base

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install all dependencies (used for tests)
RUN npm ci

# Copy the rest of the backend source code
COPY . .

# Test stage (includes devDependencies like Jest)
FROM base AS test
ENV NODE_ENV=test
CMD ["npm", "test"]

FROM node:18-alpine AS prod
WORKDIR /app
COPY package*.json ./
RUN npm ci --omit=dev
COPY . .

# Default runtime configuration
ENV NODE_ENV=production
ENV PORT=3001

# Expose the API port (defaults to 3001; can be overridden via PORT env)
EXPOSE 3001

# Start the application
CMD ["npm", "start"]
