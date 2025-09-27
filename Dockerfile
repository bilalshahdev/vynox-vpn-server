# ----------------------
# Base image (common deps)
# ----------------------
    FROM node:22-alpine AS base
    WORKDIR /usr/src/app
    COPY package*.json ./
    RUN npm install
    
    # ----------------------
    # Development stage
    # ----------------------
    FROM base AS dev
    WORKDIR /usr/src/app
    RUN npm install -g ts-node nodemon
    # 👇 only copy metadata, code comes from mounted volumes
    COPY package*.json tsconfig.json ./
    CMD ["npm", "run", "dev"]
    
    # ----------------------
    # Build stage
    # ----------------------
    FROM base AS build
    WORKDIR /usr/src/app
    COPY . .
    RUN npm run build
    
    # ----------------------
    # Production stage
    # ----------------------
    FROM node:22-alpine AS prod
    WORKDIR /usr/src/app
    COPY package*.json ./
    RUN npm install --only=production
    COPY --from=build /usr/src/app/dist ./dist
    CMD ["npm", "run", "start"]
    