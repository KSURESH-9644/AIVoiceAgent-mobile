using AIVoiceAgentServer.Configuration;
using AIVoiceAgentServer.Services;
using AIVoiceAgentServer.Services.Interfaces;

var builder =
    WebApplication.CreateBuilder(
        args);

builder.Services
    .AddEndpointsApiExplorer();

builder.Services
    .AddSwaggerGen();

builder.Services
    .Configure<GroqOptions>(
        builder.Configuration
            .GetSection(
                GroqOptions.SectionName));

var groqOptions =
    builder.Configuration
        .GetSection(
            GroqOptions.SectionName)
        .Get<GroqOptions>()
    ?? new GroqOptions();

var groqBaseUrl =
    string.IsNullOrWhiteSpace(
        groqOptions.BaseUrl)
        ? "https://api.groq.com/openai/v1/"
        : groqOptions.BaseUrl;

builder.Services
    .AddHttpClient<
        IGroqModelService,
        GroqModelService>(
        client =>
        {
            client.BaseAddress =
                new Uri(
                    groqBaseUrl);

            client.Timeout =
                TimeSpan.FromSeconds(
                    30);
        });

builder.Services
    .AddHttpClient<
        IGroqSpeechService,
        GroqSpeechService>(
        client =>
        {
            client.BaseAddress =
                new Uri(
                    groqBaseUrl);

            client.Timeout =
                TimeSpan.FromSeconds(
                    90);
        });

builder.Services
    .AddHttpClient<
        IGroqChatService,
        GroqChatService>(
        client =>
        {
            client.BaseAddress =
                new Uri(
                    groqBaseUrl);

            client.Timeout =
                TimeSpan.FromSeconds(
                    60);
        });

builder.Services
    .AddHttpClient<
        IGroqTtsService,
        GroqTtsService>(
        client =>
        {
            client.BaseAddress =
                new Uri(
                    groqBaseUrl);

            client.Timeout =
                TimeSpan.FromSeconds(
                    60);
        });

builder.Services
    .AddControllers();

var app =
    builder.Build();

if (
    app.Environment
        .IsDevelopment())
{
    app.UseSwagger();

    app.UseSwaggerUI();
}

/*
 * IMPORTANT:
 *
 * Android emulator currently calls:
 *
 * http://10.0.2.2:5279/api
 *
 * Therefore do NOT enable HTTPS
 * redirection for this local HTTP
 * development configuration.
 */
// app.UseHttpsRedirection();

app.MapControllers();

app.Run();