import { ArrowLeft } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

export default function InnerBackButton() {
  const navigate = useNavigate();
  const location = useLocation();

  if (location.pathname === "/") return null;

  const goBack = () => {
    // The catalogue is a top-level page. Its floating control should always
    // return home instead of walking through browser history and potentially
    // looping between catalogue/service routes.
    if (location.pathname === "/services") {
      let restoreScrollY = 0;
      try {
        const saved = Number(sessionStorage.getItem("rthHomeScrollY"));
        if (Number.isFinite(saved)) restoreScrollY = saved;
      } catch {
        /* Storage may be unavailable; Home will open at the top. */
      }
      navigate("/", { state: { restoreScrollY } });
      return;
    }

    const returnTo = location.state?.returnTo;
    if (returnTo?.pathname) {
      navigate(returnTo.pathname, { state: { restoreScrollY: returnTo.scrollY } });
      return;
    }

    const historyIndex = Number(window.history.state?.idx);
    if (location.key !== "default" && Number.isFinite(historyIndex) && historyIndex > 0) {
      navigate(-1);
      return;
    }

    const fallback = location.pathname.startsWith("/services/") ? "/services" : "/";
    navigate(fallback, { replace: true });
  };

  return (
    <button
      type="button"
      className="services-home-link inner-back-button"
      onClick={goBack}
      aria-label={location.pathname === "/services" ? "Go to home page" : "Go back to the previous page"}
    >
      <ArrowLeft size={15} aria-hidden="true" />
      <span>{location.pathname === "/services" ? "HOME" : "BACK"}</span>
    </button>
  );
}
