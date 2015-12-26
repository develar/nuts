FROM mhart/alpine-node:5

WORKDIR app
COPY package.json ./
RUN npm install --production
COPY . ./

ENV PORT 80
EXPOSE 80
ENTRYPOINT ["npm", "start"]