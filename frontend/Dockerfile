# Stage 1: Build the React application
FROM node:18-alpine as build
WORKDIR /app

# Copy package and package-lock files
COPY package*.json ./

# Install dependencies
RUN npm ci

# Copy application source code
COPY . .

# Build the production application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the built assets to Nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Configure nginx to:
# - serve the SPA correctly
# - proxy API + Socket.IO to the backend service in the Docker network
# The official nginx image will envsubst templates from /etc/nginx/templates at startup.
ENV BACKEND_URL=http://backend:3001
COPY nginx/default.conf.template /etc/nginx/templates/default.conf.template

# Expose port 80
EXPOSE 80

# Run nginx purely in the foreground
CMD ["nginx", "-g", "daemon off;"]
