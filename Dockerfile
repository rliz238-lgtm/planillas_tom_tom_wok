FROM nginx:alpine

# Copiar archivos de la aplicación al directorio por defecto de Nginx
COPY . /usr/share/nginx/html

# Copiar configuración personalizada de Nginx
COPY nginx.conf /etc/nginx/conf.d/default.conf

# Exponder el puerto 80
EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
