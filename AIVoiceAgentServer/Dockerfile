FROM mcr.microsoft.com/dotnet/sdk:8.0 AS build
WORKDIR /src
COPY ["AIVoiceAgentServer/AIVoiceAgentServer.csproj", "AIVoiceAgentServer/"]
RUN dotnet restore "AIVoiceAgentServer/AIVoiceAgentServer.csproj"
COPY . .
WORKDIR "/src/AIVoiceAgentServer"
RUN dotnet publish -c Release -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:8.0 AS base
WORKDIR /app
EXPOSE 8080
COPY --from=build /app/publish .
ENTRYPOINT ["dotnet", "AIVoiceAgentServer.dll"]