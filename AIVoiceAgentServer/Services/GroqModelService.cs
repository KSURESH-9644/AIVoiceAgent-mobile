using System.Net.Http.Headers;
using System.Text.Json;
using AIVoiceAgentServer.Configuration;
using AIVoiceAgentServer.Models;
using AIVoiceAgentServer.Services.Interfaces;
using Microsoft.Extensions.Options;

namespace AIVoiceAgentServer.Services;

public sealed class GroqModelService : IGroqModelService
{
    private readonly HttpClient _httpClient;
    private readonly GroqOptions _options;

    private static readonly JsonSerializerOptions JsonOptions = new()
    {
        PropertyNameCaseInsensitive = true
    };

    public GroqModelService(HttpClient httpClient, IOptions<GroqOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<IReadOnlyList<GroqModel>> GetAvailableModelsAsync(CancellationToken cancellationToken = default)
    {
        using var request = new HttpRequestMessage(HttpMethod.Get, "models");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var content = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Groq model request failed. Status: {(int)response.StatusCode}. Response: {content}");
        }

        var result = JsonSerializer.Deserialize<ModelCatalogResponse>(content, JsonOptions);

        return result?.Data
            .Where(x => x.Active)
            .OrderBy(x => x.Id)
            .ToList()
            ?? [];
    }

    public async Task<ModelCatalog> GetCategorizedModelsAsync(CancellationToken cancellationToken = default)
    {
        var models = await GetAvailableModelsAsync(cancellationToken);
        var catalog = new ModelCatalog();

        foreach (var model in models)
        {
            if (IsSpeechToText(model.Id))
            {
                catalog.SpeechToText.Add(model);
            }
            else if (IsTextToSpeech(model.Id))
            {
                catalog.TextToSpeech.Add(model);
            }
            else if (IsChatModel(model.Id))
            {
                catalog.Chat.Add(model);
            }
        }

        return catalog;
    }

    private static bool IsSpeechToText(string modelId)
    {
        return modelId.Contains("whisper", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsTextToSpeech(string modelId)
    {
        var id = modelId.ToLowerInvariant();

        if (id.Contains("arabic") || id.Contains("hindi") || id.Contains("spanish") || id.Contains("french"))
        {
            return false;
        }

        return id.Contains("orpheus", StringComparison.OrdinalIgnoreCase);
    }

    private static bool IsChatModel(string modelId)
    {
        var id = modelId.ToLowerInvariant();

        if (id.Contains("whisper") || id.Contains("orpheus") || id.Contains("guard"))
        {
            return false;
        }

        return id.Contains("llama") ||
               id.Contains("gpt") ||
               id.Contains("qwen") ||
               id.Contains("mistral") ||
               id.Contains("gemma") ||
               id.Contains("deepseek") ||
               id.Contains("kimi");
    }
}