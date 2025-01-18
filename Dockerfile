FROM node:20

WORKDIR /app

COPY package*.json ./
COPY app.js .
COPY public ./public
COPY pages ./pages

RUN npm install

EXPOSE 3000

CMD ["node", "app.js"]