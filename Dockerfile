# Use Node.js 20 as base
FROM node:20-alpine

# Install dumb-init for proper signal handling
RUN apk add --no-cache dumb-init

# Set working directory
WORKDIR /app

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nestjs -u 1001

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies (production only)
RUN npm ci --only=production

# Copy source code
COPY . .

# Build the NestJS application
RUN npm run build

# Change ownership to non-root user
RUN chown -R nestjs:nodejs /app
USER nestjs

# Expose the port
EXPOSE 3000

# Use dumb-init and the production start command
ENTRYPOINT ["dumb-init", "--"]
CMD ["npm", "run", "start:prod"]
