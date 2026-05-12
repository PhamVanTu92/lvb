FROM mcr.microsoft.com/dotnet/aspnet:9.0 AS base
WORKDIR /app
EXPOSE 8080

FROM mcr.microsoft.com/dotnet/sdk:9.0 AS build
WORKDIR /src

COPY ["src/LVB.Portal.API/LVB.Portal.API.csproj", "src/LVB.Portal.API/"]
COPY ["src/LVB.Portal.Application/LVB.Portal.Application.csproj", "src/LVB.Portal.Application/"]
COPY ["src/LVB.Portal.Domain/LVB.Portal.Domain.csproj", "src/LVB.Portal.Domain/"]
COPY ["src/LVB.Portal.Infrastructure/LVB.Portal.Infrastructure.csproj", "src/LVB.Portal.Infrastructure/"]

RUN dotnet restore "src/LVB.Portal.API/LVB.Portal.API.csproj"

COPY . .
WORKDIR "/src/src/LVB.Portal.API"
RUN dotnet build "LVB.Portal.API.csproj" -c Release -o /app/build

FROM build AS publish
RUN dotnet publish "LVB.Portal.API.csproj" -c Release -o /app/publish /p:UseAppHost=false

FROM base AS final
WORKDIR /app
COPY --from=publish /app/publish .
ENTRYPOINT ["dotnet", "LVB.Portal.API.dll"]
