# Dockerfile multi-stage para MediApp.Api.
#
# Stage 1 (build): SDK 8.0 → restore + publish a /app/publish.
# Stage 2 (runtime): aspnet:8.0 (sin SDK, imagen más chica) corriendo el dll publicado.
#
# Build context esperado: directorio backend/ (ver docker-compose.yml).
# Por eso las rutas no llevan prefijo backend/.

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src

# Copio solo el csproj de la API primero para aprovechar layer cache de NuGet restore.
# (No copio la .sln ni el csproj de tests: el build de la imagen no los necesita y
# además tests/ está en .dockerignore.)
COPY src/MediApp.Api/MediApp.Api.csproj src/MediApp.Api/
RUN dotnet restore src/MediApp.Api/MediApp.Api.csproj

# Ahora sí copio todo y publico.
COPY src/ src/
RUN dotnet publish src/MediApp.Api/MediApp.Api.csproj -c Release -o /app/publish --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS runtime
WORKDIR /app

# Variables de entorno por defecto. La connection string y el almacén
# se setean por compose (ConnectionStrings__Default, Almacen__RutaLocal).
ENV ASPNETCORE_URLS=http://+:8080 \
    ASPNETCORE_ENVIRONMENT=Production

COPY --from=build /app/publish ./

# Carpeta para evidencias (se monta volume desde compose).
RUN mkdir -p /app/evidencias

EXPOSE 8080
ENTRYPOINT ["dotnet", "MediApp.Api.dll"]
