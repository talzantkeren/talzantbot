FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install --only=production

COPY bot.js .
COPY .env .

CMD ["node", "bot.js"]
