using Microsoft.AspNetCore.Mvc;

namespace AIVoiceAgentServer.Controllers
{
    public class ChatController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
