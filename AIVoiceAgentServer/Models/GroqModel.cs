namespace AIVoiceAgentServer.Models;

public sealed class GroqModel
{
    public string Id { get; set; } = string.Empty;
    public string Object { get; set; } = string.Empty;
    public long Created { get; set; }
    public string OwnedBy { get; set; } = string.Empty;
    public bool Active { get; set; }
    public int ContextWindow { get; set; }
}