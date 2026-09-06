# OmniQuiz - Multi-Subject CBT Platform
# Production-ready, ultra-lightweight web server container
FROM nginx:alpine

# Copy custom Nginx configuration
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Copy all web application assets to Nginx html directory
COPY . /usr/share/nginx/html/

# Expose standard HTTP port
EXPOSE 80

# Run Nginx in foreground
CMD ["nginx", "-g", "daemon off;"]
