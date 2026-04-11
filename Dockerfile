FROM node:20-alpine

# Install Python
RUN apk add --no-cache python3 py3-pip

WORKDIR /app

# Copy files
COPY package*.json ./
COPY requirements.txt ./
COPY *.js ./
COPY *.py ./
COPY .env .env

# Install Node dependencies
RUN npm ci --only=production

# Install Python dependencies
RUN pip install -r requirements.txt

# Start both services
CMD ["sh", "-c", "node bot.js & python monitor.py && wait"]
