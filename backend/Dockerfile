FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package.json and package-lock.json
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the backend source code
COPY . .

# Expose the API port (Defaulting to 5000)
EXPOSE 5000

# Start the application
CMD ["npm", "start"]