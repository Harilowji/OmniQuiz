# OmniQuiz PRO - Full-Stack CBT Platform
# Production-ready Node.js container with static asset serving & RESTful API
FROM node:20-alpine

WORKDIR /app

# Install dependencies with caching
COPY package*.json ./
RUN npm ci --only=production

# Copy application source code
COPY . .

# Expose application port
EXPOSE 3000

ENV NODE_ENV=production
ENV PORT=3000

# Start Full-Stack Server
CMD ["node", "server.js"]
