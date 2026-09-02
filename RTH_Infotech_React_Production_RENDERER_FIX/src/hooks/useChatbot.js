import { useCallback, useEffect, useRef, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { chatbotConfig } from "@/data/chatbot";
import { getServiceBySlug } from "@/data/services";
import { sendChatMessage } from "@/services/chatService";
import { resolveAction } from "@/services/intentEngine";

let messageSeq = 0;
const nextMessageId = () => `rth-ai-${++messageSeq}`;

const NAV_ACTIONS = new Set(["goto-services", "goto-analyzer", "goto-contact", "explore-service"]);
const MIN_THINK_MS = 400;

function scrollToId(hash) {
  const section = document.querySelector(hash);
  if (!section) return;

  // The services section is taller than the viewport (145vh), so aligning its
  // top leaves the flex-centred Intelligence Core near the bottom of the
  // screen. Target the orbit itself and centre it instead.
  const shouldCenter = hash === "#services";
  const el = shouldCenter ? section.querySelector(".service-universe-wrap") || section : section;

  if (window.__rthLenis) {
    const centerOffset = -Math.max(20, (window.innerHeight - el.getBoundingClientRect().height) / 2);
    window.__rthLenis.scrollTo(el, { offset: shouldCenter ? centerOffset : -20 });
  } else {
    el.scrollIntoView({ behavior: "smooth", block: shouldCenter ? "center" : "start" });
  }
}

function navAckText(action) {
  switch (action.type) {
    case "goto-services":
      return "Taking you to the Intelligence Core…";
    case "goto-analyzer":
      return "Opening the Business Analyzer…";
    case "goto-contact":
      return "Heading to Contact…";
    case "explore-service": {
      const service = getServiceBySlug(action.slug);
      return `Opening ${service ? service.title : "the service"}…`;
    }
    default:
      return null;
  }
}

export default function useChatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [hasWelcomed, setHasWelcomed] = useState(false);
  const [messages, setMessages] = useState([]);
  const [isTyping, setIsTyping] = useState(false);
  const [showDiscovery, setShowDiscovery] = useState(false);
  const [isCoreFocused, setIsCoreFocused] = useState(false);
  const [isServiceModalOpen, setIsServiceModalOpen] = useState(false);

  const navigate = useNavigate();
  const location = useLocation();
  const pendingScroll = useRef(null);

  // A dedicated service page (/services/:slug) is its own full-screen experience too.
  const isServiceRoute = location.pathname !== "/services" && location.pathname.startsWith("/services/");
  // Fullscreen service experience: the orbit's pop-out modal, or the dedicated service page.
  const isServiceExperienceOpen = isServiceModalOpen || isServiceRoute;
  // Widget fully hidden during the fullscreen service experience; panel-only minimize
  // (trigger stays) while the Intelligence Core is centered/interactive.
  const hideWidget = isServiceExperienceOpen;
  const forceMinimizePanel = hideWidget || isCoreFocused;

  // Read-only observation of the existing Intelligence Core / service-modal DOM state —
  // does not touch serviceAnimations.js, ServiceUniverse.jsx, or any Core/GSAP logic.
  // ".orbit-stable" is the class the existing orbit scrollTrigger already toggles when the
  // Core is centered and interactive; ".service-modal" is the existing pop-out's own class
  // (portaled onto document.body, so it's queried globally rather than scoped to container).
  useEffect(() => {
    const container = document.querySelector(".service-universe-wrap");
    if (!container) {
      setIsCoreFocused(false);
      setIsServiceModalOpen(false);
      return undefined;
    }
    const update = () => {
      // orbit-stable is scroll-position-derived and can occasionally desync from a fast/instant
      // scroll jump (scrollbar-track click, End key) landing before ScrollTrigger's own layout
      // recalculation settles — cross-check against the container's actual viewport position so
      // a stale class can never permanently force-minimize the chat widget.
      const rect = container.getBoundingClientRect();
      const nearViewport = rect.top < window.innerHeight && rect.bottom > 0;
      setIsCoreFocused(nearViewport && container.classList.contains("orbit-stable"));
      setIsServiceModalOpen(!!document.querySelector(".service-modal"));
    };
    // getBoundingClientRect() forces a style/layout flush, so running `update`
    // straight off the scroll event meant a synchronous layout read on every
    // scroll event of the site's longest page. Coalescing to one read per frame
    // gives the same answer at the same visual cadence without the thrash.
    let frame = 0;
    const scheduleUpdate = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        update();
      });
    };

    update();
    const observer = new MutationObserver(scheduleUpdate);
    observer.observe(container, { attributes: true, attributeFilter: ["class"], childList: true });
    const bodyObserver = new MutationObserver(scheduleUpdate);
    bodyObserver.observe(document.body, { childList: true });
    window.addEventListener("scroll", scheduleUpdate, { passive: true });
    return () => {
      if (frame) cancelAnimationFrame(frame);
      observer.disconnect();
      bodyObserver.disconnect();
      window.removeEventListener("scroll", scheduleUpdate);
    };
  }, [location.pathname]);

  // Never auto-reopen: just make sure the panel isn't left open over the Core/service view.
  useEffect(() => {
    if (forceMinimizePanel) setIsOpen(false);
  }, [forceMinimizePanel]);

  const appendMessage = useCallback((message) => {
    setMessages((prev) => [...prev, { id: nextMessageId(), ...message }]);
  }, []);

  // First open: inject the welcome message once per session.
  useEffect(() => {
    if (!isOpen || hasWelcomed) return;
    setHasWelcomed(true);
    appendMessage({ sender: "assistant", text: chatbotConfig.welcome, suggestions: chatbotConfig.initialSuggestions });
  }, [isOpen, hasWelcomed, appendMessage]);

  // First-visit discovery bubble: once per tab session, after some scroll, auto-retracts.
  useEffect(() => {
    if (isOpen || hasWelcomed) return;
    let alreadyShown = false;
    try {
      alreadyShown = sessionStorage.getItem("rthAiDiscoveryShown") === "1";
    } catch {
      alreadyShown = false;
    }
    if (alreadyShown) return undefined;

    const onScroll = () => {
      if (window.scrollY <= window.innerHeight * 0.6) return;
      setShowDiscovery(true);
      try {
        sessionStorage.setItem("rthAiDiscoveryShown", "1");
      } catch {
        /* ignore storage errors */
      }
      window.removeEventListener("scroll", onScroll);
      setTimeout(() => setShowDiscovery(false), 5000);
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, [isOpen, hasWelcomed]);

  // Cross-route navigation: land on "/" first, then scroll once the route settles.
  // Home's sections mount their own GSAP ScrollTrigger pins after the route change,
  // which can shift document height briefly — scroll again shortly after to correct.
  useEffect(() => {
    if (location.pathname !== "/" || !pendingScroll.current) return undefined;
    const hash = pendingScroll.current;
    pendingScroll.current = null;
    const t1 = setTimeout(() => scrollToId(hash), 350);
    const t2 = setTimeout(() => scrollToId(hash), 750);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [location.pathname]);

  const goToSection = useCallback(
    (hash) => {
      if (location.pathname === "/") scrollToId(hash);
      else {
        pendingScroll.current = hash;
        navigate("/");
      }
    },
    [location.pathname, navigate],
  );

  const executeNavigation = useCallback(
    (action) => {
      switch (action.type) {
        case "goto-services":
          goToSection("#services");
          break;
        case "goto-analyzer":
          goToSection("#analyzer");
          break;
        case "goto-contact":
          if (location.pathname === "/") scrollToId("#contact");
          else navigate("/contact");
          break;
        case "explore-service":
          navigate(`/services/${action.slug}`);
          break;
        default:
          break;
      }
    },
    [goToSection, location.pathname, navigate],
  );

  // These guard on `hideWidget`, NOT on `forceMinimizePanel`. The widget is
  // genuinely off screen for the former, so refusing to open is honest; but
  // `isCoreFocused` only auto-minimizes the panel while leaving the trigger
  // fully visible and clickable, and guarding on it there turned that trigger
  // into a dead button for the whole (145vh) Intelligence Core section. The
  // auto-minimize effect above still runs on the way in — it just no longer
  // overrides a visitor who then deliberately taps the button.
  const open = useCallback(() => {
    if (hideWidget) return;
    setIsOpen(true);
    setShowDiscovery(false);
  }, [hideWidget]);
  const close = useCallback(() => setIsOpen(false), []);
  const toggle = useCallback(() => {
    if (hideWidget) return;
    setIsOpen((v) => !v);
  }, [hideWidget]);

  const handleSuggestion = useCallback(
    (suggestion) => {
      appendMessage({ sender: "user", text: [suggestion.label] });
      const { action } = suggestion;

      if (NAV_ACTIONS.has(action.type)) {
        executeNavigation(action);
        const ack = navAckText(action);
        if (ack) appendMessage({ sender: "assistant", text: [ack] });
        return;
      }

      setIsTyping(true);
      const started = Date.now();
      Promise.resolve(resolveAction(action)).then((content) => {
        const wait = Math.max(0, MIN_THINK_MS - (Date.now() - started));
        setTimeout(() => {
          setIsTyping(false);
          appendMessage({ sender: "assistant", ...content });
        }, wait);
      });
    },
    [appendMessage, executeNavigation],
  );

  const sendText = useCallback(
    (rawText) => {
      const trimmed = rawText.trim();
      if (!trimmed) return;
      appendMessage({ sender: "user", text: [trimmed] });
      setIsTyping(true);
      const started = Date.now();
      sendChatMessage({ message: trimmed, history: messages, context: { path: location.pathname } }).then((res) => {
        const wait = Math.max(0, MIN_THINK_MS - (Date.now() - started));
        setTimeout(() => {
          setIsTyping(false);
          appendMessage({ sender: "assistant", text: res.text, suggestions: res.suggestions, dense: res.dense });
        }, wait);
      });
    },
    [appendMessage, location.pathname, messages],
  );

  return { isOpen, open, close, toggle, messages, isTyping, showDiscovery, handleSuggestion, sendText, hideWidget };
}
