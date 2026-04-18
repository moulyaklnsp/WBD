# Stage 1: Build the React application
FROM node:18-alpine as build
WORKDIR /app

# Copy package and package-lock files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy application source code
COPY . .

# Build the production application
RUN npm run build

# Stage 2: Serve the application with Nginx
FROM nginx:alpine

# Copy the built assets to Nginx html folder
COPY --from=build /app/build /usr/share/nginx/html

# Expose port 80
EXPOSE 80

# Run nginx purely in the foreground
CMD ["nginx", "-g", "daemon off;"]