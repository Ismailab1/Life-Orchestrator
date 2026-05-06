# Stage 1: Build the React application
FROM node:22-alpine AS build

WORKDIR /app

# Copy package.json and package-lock.json first to leverage Docker cache
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy the rest of the application code
COPY . .

# Build the application (API key is NOT injected here — it lives only in the server env)
RUN npm run build

# Stage 2: Production server (Express proxy + static file serving)
# The GEMINI_API_KEY is supplied at runtime via Cloud Run environment variables.
FROM node:22-alpine

WORKDIR /app

# Install only the server's minimal dependencies
COPY server/package.json ./package.json
RUN npm install --omit=dev

# Copy server code and built frontend
COPY server/index.js ./index.js
COPY --from=build /app/dist ./dist/

# Expose Cloud Run's default port
EXPOSE 8080

CMD ["node", "index.js"]
