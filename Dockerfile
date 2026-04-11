FROM node:20-alpine

# Install Python and dependencies
RUN apk add --no-cache python3 py3-pip bash

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY requirements.txt ./

# Install Node dependencies
RUN npm install --only=production

# Install Python dependencies
RUN pip3 install --break-system-packages -r requirements.txt --no-cache-dir

# Copy application files (NOT .env - comes from Railway env vars)
COPY bot.js .
COPY monitor.py .
COPY Procfile .
COPY telegram_session.session .

# Create empty .env for reference (will be overridden by Railway)
RUN echo "# Railway will inject environment variables" > .env

# Expose port for web service (Railway requirement)
EXPOSE 3000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000', (r) => {if (r.statusCode !== 404) throw new Error(r.statusCode)})" || exit 1

# Use honcho to run Procfile services
CMD ["honcho", "-f", "Procfile", "start"]
