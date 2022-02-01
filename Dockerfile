FROM node:16.13.2-alpine
WORKDIR /app
RUN apk add --no-cache git openssh-client curl jq cmake

RUN curl -f https://get.pnpm.io/v6.16.js | node - add --global pnpm@6
COPY package*.json .
RUN pnpm install
COPY . .
RUN pnpm build

RUN curl -fsSL "https://download.docker.com/linux/static/stable/x86_64/docker-20.10.9.tgz" | tar -xzvf - docker/docker -C . --strip-components 1 && mv docker /usr/bin/docker
RUN mkdir -p ~/.docker/cli-plugins/
RUN curl -SL https://github.com/docker/compose/releases/download/v2.2.2/docker-compose-linux-x86_64 -o ~/.docker/cli-plugins/docker-compose
RUN chmod +x ~/.docker/cli-plugins/docker-compose

EXPOSE 3000
CMD ["pnpm", "start"]