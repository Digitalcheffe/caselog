# syntax=docker/dockerfile:1

FROM node:20-alpine AS ui-build
WORKDIR /src/ui
COPY src/caselog-ui/package.json ./
RUN npm install
COPY src/caselog-ui/ ./
RUN npm run build

FROM mcr.microsoft.com/dotnet/sdk:8.0 AS api-build
WORKDIR /src
# Copy the full repository into the API build stage so restore/publish can
# resolve any repo-level build config (Directory.Build.*, global.json,
# NuGet.Config) and project references.
COPY . ./
RUN dotnet restore ./src/Caselog.Api/Caselog.Api.csproj
COPY --from=ui-build /src/ui/dist/ ./src/Caselog.Api/wwwroot/
RUN dotnet publish ./src/Caselog.Api/Caselog.Api.csproj -c Release -o /app/publish /p:UseAppHost=false --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:8.0-alpine AS final
WORKDIR /app
ENV CASELOG_PORT=5000
ENV CASELOG_DATA_PATH=/data/caselog.db
ENV CASELOG_DB_PATH=/data/caselog.db
EXPOSE 5000
RUN mkdir -p /data
COPY --from=api-build /app/publish ./
ENTRYPOINT ["dotnet", "Caselog.Api.dll"]
