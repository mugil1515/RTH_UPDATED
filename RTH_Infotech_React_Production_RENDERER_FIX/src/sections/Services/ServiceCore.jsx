import logo from "@/assets/logos/rth-logo.png";
import { services } from "@/data/services";
export default function ServiceCore(){const aiService=services.find((service)=>service.key==="ai");return <div className="service-core"><span className="core-ring ring-a"/><span className="core-ring ring-b"/><img src={logo} alt=""/><div className="core-divider"/><p>INTELLIGENCE<br/>CORE</p><strong>{aiService?.title?.toUpperCase()}</strong><span className="system-online"><i/>SYSTEM ONLINE</span></div>}
