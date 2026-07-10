FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

# Install all dependencies including devDependencies to compile TS
RUN npm install

COPY . .

# Compile TypeScript files into the dist/ directory
RUN npm run build

EXPOSE 5000

# Start the server using the compiled JavaScript
CMD ["npm", "start"]
