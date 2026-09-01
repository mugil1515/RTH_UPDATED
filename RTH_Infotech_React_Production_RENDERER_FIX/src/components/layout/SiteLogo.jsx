import { Link } from "react-router-dom";
import logo from "@/assets/logos/rth-logo-mark.png";

export default function SiteLogo() {
  return (
    <Link className="site-logo" to="/" aria-label="RTH Infotech home">
      <img src={logo} alt="RTH Infotech" />
    </Link>
  );
}
