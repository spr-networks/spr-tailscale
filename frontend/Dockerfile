# NOTE for frontend stuff
FROM node:alpine

COPY . /app
WORKDIR /app
RUN yarn install

USER 1000:1000
EXPOSE 3000
ENTRYPOINT yarn run start

## TODO build
