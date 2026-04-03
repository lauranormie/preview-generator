# Use Puppeteer's official Docker image which includes Chrome
FROM ghcr.io/puppeteer/puppeteer:21.6.1

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
# Skip Chromium download since it's already in the base image
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true
RUN npm ci --only=production

# Copy application code
COPY . .

# Expose port (Railway will set PORT env var)
EXPOSE 3456

# Start the server
CMD ["npm", "start"]
