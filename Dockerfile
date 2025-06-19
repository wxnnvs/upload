FROM node:20

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable 

WORKDIR /app

COPY package*.json pnpm-lock.yaml ./

COPY app.js .

RUN pnpm install

EXPOSE 3000

CMD ["node", "app.js"]