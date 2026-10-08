FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src

COPY ["AIVoiceAgentServer.csproj", "./"]

RUN dotnet restore "AIVoiceAgentServer.csproj"

COPY . .

RUN dotnet publish "AIVoiceAgentServer.csproj" \
    -c Release \
    -o /app/publish \
    --no-restore

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS base
WORKDIR /app

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080

COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AIVoiceAgentServer.dll"]