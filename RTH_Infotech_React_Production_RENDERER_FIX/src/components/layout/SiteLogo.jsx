import { Link } from "react-router-dom";
import logo from "@/assets/logos/rth-logo-mark.png";

export default function SiteLogo() {
  return (
    <Link className="site-logo" to="/" aria-label="RTH Infotech home">
      {/* Intrinsic size declared so the browser reserves the right box before
          the PNG decodes (CSS sets the width; height was previously unknown
          until load). alt is empty because the link itself is already labelled
          — otherwise a screen reader announces the brand twice. */}
      <img src={logo} alt="" width="1712" height="860" decoding="async" />
    </Link>
  );
}
