# Dockerfile
# Use Node.js 20 as base
FROM node:20

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json (or yarn.lock)
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend code
COPY . .

# Build the app (if you have build step, e.g., TypeScript)
RUN npm run build

# Expose the port your backend runs on
EXPOSE 3000

# Start the backend
CMD ["npm", "start"]