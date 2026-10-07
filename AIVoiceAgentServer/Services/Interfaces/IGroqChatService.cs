using AIVoiceAgentServer.Models;

namespace AIVoiceAgentServer.Services.Interfaces;

public interface IGroqChatService
{
    Task<string> GenerateResponseAsync(
        string userText,
        string mode,
        string character,
        string model,
        IReadOnlyList<ConversationTurn> history,
        CancellationToken cancellationToken = default);
}