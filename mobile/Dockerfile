# Iris Mobile Dockerfile - Ultra Fast Expo Setup
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Install Expo CLI globally
RUN npm install -g @expo/cli

# Copy package files first for better caching
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application code
COPY . .

# Expose port
EXPOSE 8081

# Run the development server
CMD ["npx", "expo", "start", "--tunnel"]
