namespace AIVoiceAgentServer.Models;

public sealed class VoiceChatResponse
{
    public bool Success { get; set; }
    public string UserText { get; set; } = string.Empty;
    public string AiText { get; set; } = string.Empty;
    public string AudioBase64 { get; set; } = string.Empty;
    public string AudioContentType { get; set; } = "audio/wav";
    public string? Error { get; set; }
}