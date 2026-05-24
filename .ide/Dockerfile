FROM node:20
WORKDIR /workspace
COPY package.json package-lock.json* ./
RUN npm install --omit=dev
COPY . .
RUN mkdir -p data
ENV LANG=C.UTF-8
