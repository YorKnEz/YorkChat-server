FROM node:15.5.0-alpine3.10

RUN npm install nodemon -g

RUN apk add --no-cache yarn=1.16.0-r0

WORKDIR /usr/src/app

COPY package.json yarn.lock ./
RUN yarn install
COPY . .