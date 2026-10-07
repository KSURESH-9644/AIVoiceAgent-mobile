using Microsoft.AspNetCore.Mvc;

namespace AIVoiceAgentServer.Controllers
{
    public class HealthController : Controller
    {
        public IActionResult Index()
        {
            return View();
        }
    }
}
