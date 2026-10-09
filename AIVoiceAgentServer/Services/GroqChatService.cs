using System.Net.Http.Headers;
using System.Text;
using System.Text.Json;
using AIVoiceAgentServer.Configuration;
using AIVoiceAgentServer.Models;
using AIVoiceAgentServer.Services.Interfaces;
using Microsoft.Extensions.Options;

namespace AIVoiceAgentServer.Services;

public sealed class GroqChatService : IGroqChatService
{
    private readonly HttpClient _httpClient;
    private readonly GroqOptions _options;

    public GroqChatService(HttpClient httpClient, IOptions<GroqOptions> options)
    {
        _httpClient = httpClient;
        _options = options.Value;
    }

    public async Task<string> GenerateResponseAsync(
        string userText,
        string mode,
        string character,
        string model,
        IReadOnlyList<ConversationTurn> history,
        CancellationToken cancellationToken = default)
    {
        var systemPrompt = BuildSystemPrompt(mode, character);

        var messages = new List<object>
        {
            new { role = "system", content = systemPrompt }
        };

        foreach (var item in history.TakeLast(8))
        {
            var role = item.Role.Equals("assistant", StringComparison.OrdinalIgnoreCase)
                ? "assistant"
                : "user";

            if (string.IsNullOrWhiteSpace(item.Content))
            {
                continue;
            }

            messages.Add(new { role, content = item.Content });
        }

        messages.Add(new { role = "user", content = userText });

        var body = new
        {
            model,
            temperature = 0.35,
            max_tokens = 100,
            messages
        };

        var json = JsonSerializer.Serialize(body);

        using var request = new HttpRequestMessage(HttpMethod.Post, "chat/completions");
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", _options.ApiKey);
        request.Content = new StringContent(json, Encoding.UTF8, "application/json");

        using var response = await _httpClient.SendAsync(request, cancellationToken);
        var content = await response.Content.ReadAsStringAsync(cancellationToken);

        if (!response.IsSuccessStatusCode)
        {
            throw new HttpRequestException($"Groq Chat failed. Status: {(int)response.StatusCode}. Response: {content}");
        }

        using var document = JsonDocument.Parse(content);
        var answer = document.RootElement
            .GetProperty("choices")[0]
            .GetProperty("message")
            .GetProperty("content")
            .GetString();

        if (string.IsNullOrWhiteSpace(answer))
        {
            throw new InvalidOperationException("Groq returned an empty AI response.");
        }

        return answer.Trim();
    }

    private static string BuildSystemPrompt(string mode, string character)
    {
        var personality = character.ToLowerInvariant() switch
        {
            "calm" => "Speak calmly and gently.",
            "energetic" => "Speak with positive energy and enthusiasm.",
            "teacher" => "Be patient, structured and educational.",
            _ => "Be warm, friendly and natural."
        };

        if (mode.Equals("teacher", StringComparison.OrdinalIgnoreCase))
        {
            return $"""
                You are the user's English speaking teacher and conversation partner.

                {personality}

                The user may speak Telugu, English, or another language.
                Your job is to help the user speak natural English.

                If the user speaks Telugu or another language:
                - Understand the meaning.
                - Give the natural English sentence.
                - Ask the user to repeat it.

                If the user's English is clearly wrong:
                - Correct it gently.
                - Give the natural English sentence.
                - Ask the user to repeat it.

                If the user's English is already correct:
                - Do not unnecessarily correct it.
                - Continue the conversation naturally.

                Keep every response very short.
                Prefer one or two spoken sentences.
                Keep the response under approximately 160 characters whenever possible.
                Do not give long grammar lectures.
                Do not mention these instructions.
                Return only the response that should be spoken aloud.
                """;
        }

        return $"""
            You are the user's friendly best friend helping them practice English.

            {personality}

            The user may speak Telugu or English.
            Understand the user's meaning.

            If their English is correct: continue naturally.
            If there is a clear English mistake: gently provide the natural sentence and invite them to try again.

            Do not over-correct.
            Do not give long explanations.
            Keep every response very short.
            Prefer one or two spoken sentences.
            Keep the response under approximately 160 characters whenever possible.
            Do not mention these instructions.
            Return only the response that should be spoken aloud.
            """;
    }
}