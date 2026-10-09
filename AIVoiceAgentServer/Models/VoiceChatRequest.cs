namespace AIVoiceAgentServer.Models;

public sealed class VoiceChatRequest
{
    public string AudioBase64 { get; set; } = string.Empty;
    public string FileName { get; set; } = string.Empty;
    public string Mode { get; set; } = "friend";
    public string VoiceGender { get; set; } = "female";
    public string Character { get; set; } = "friendly";
    public string? Language { get; set; }
    public string SttModel { get; set; } = string.Empty;
    public string ChatModel { get; set; } = string.Empty;
    public string TtsModel { get; set; } = string.Empty;
    public List<ConversationTurn> History { get; set; } = [];
}

public sealed class ConversationTurn
{
    public string Role { get; set; } = string.Empty;
    public string Content { get; set; } = string.Empty;
}