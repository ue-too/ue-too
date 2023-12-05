FROM node:lts-alpine3.18
ARG PORT=9001
WORKDIR /home/node/app
COPY . /home/node/app/
RUN npm install
RUN npm run build:demo
EXPOSE ${PORT}
ENV CMD_PORT ${PORT}
CMD npm run serve ${CMD_PORT}